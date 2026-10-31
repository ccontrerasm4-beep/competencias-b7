import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_DATOS = path.resolve(__dirname, '../datos');

const colas = new Map();
let respaldoPromesa = null;

function validarNombreCol(col) {
  if (typeof col !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9_-]+)?$/.test(col)) {
    throw new Error(`Nombre de colección inválido: ${col}`);
  }
}

function validarNombreArchivo(archivo) {
  if (typeof archivo !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9_-]+)?(\.jsonl|\.json)?$/.test(archivo)) {
    throw new Error(`Nombre de archivo inválido: ${archivo}`);
  }
}

function rutaColeccion(col) {
  return path.join(DIR_DATOS, `${col}.json`);
}

function rutaArchivoLineas(archivo) {
  validarNombreArchivo(archivo);
  const conExt = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  return path.join(DIR_DATOS, conExt);
}

function encolar(ruta, tarea) {
  const colaActual = colas.get(ruta) || Promise.resolve();
  const siguiente = colaActual.then(() => tarea()).finally(() => {
    if (colas.get(ruta) === siguiente) {
      colas.delete(ruta);
    }
  });
  colas.set(ruta, siguiente);
  return siguiente;
}

async function asegurarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  const dirRespaldos = path.join(DIR_DATOS, 'respaldos');
  const dirRespaldoHoy = path.join(dirRespaldos, hoy);

  try {
    await fs.access(dirRespaldoHoy);
    return;
  } catch {
    // Si no existe, continúa para crearlo
  }

  if (respaldoPromesa) return respaldoPromesa;

  respaldoPromesa = (async () => {
    try {
      await fs.mkdir(DIR_DATOS, { recursive: true });
      await fs.mkdir(dirRespaldoHoy, { recursive: true });

      const entradas = await fs.readdir(DIR_DATOS, { withFileTypes: true });
      for (const entrada of entradas) {
        if (entrada.name === 'respaldos') continue;
        const origen = path.join(DIR_DATOS, entrada.name);
        const destino = path.join(dirRespaldoHoy, entrada.name);
        await fs.cp(origen, destino, { recursive: true });
      }

      // Conservar solo los 14 más recientes
      const carpetas = (await fs.readdir(dirRespaldos, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
        .map((d) => d.name)
        .sort();

      if (carpetas.length > 14) {
        const sobrantes = carpetas.slice(0, carpetas.length - 14);
        for (const carpeta of sobrantes) {
          await fs.rm(path.join(dirRespaldos, carpeta), { recursive: true, force: true });
        }
      }
    } catch (err) {
      console.error('Error al generar respaldo diario:', err);
    } finally {
      respaldoPromesa = null;
    }
  })();

  return respaldoPromesa;
}

async function guardarColeccion(col, lista) {
  const ruta = rutaColeccion(col);
  await asegurarRespaldoDiario();
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  const contenido = JSON.stringify(lista, null, 2);
  const rutaTmp = `${ruta}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(rutaTmp, contenido, 'utf-8');
  await fs.rename(rutaTmp, ruta);
}

function generarId(col, lista) {
  const segmento = col.split('/')[0];
  const letras = segmento.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 3);
  const prefijo = (letras || 'rec').padEnd(3, 'x');
  const regex = new RegExp(`^${prefijo}_(\\d+)$`);

  let mayor = 0;
  if (Array.isArray(lista)) {
    for (const item of lista) {
      if (item && item.id) {
        const match = String(item.id).match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > mayor) mayor = num;
        }
      }
    }
  }

  const siguiente = String(mayor + 1).padStart(6, '0');
  return `${prefijo}_${siguiente}`;
}

export async function leer(col) {
  validarNombreCol(col);
  const ruta = rutaColeccion(col);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    if (!contenido.trim()) return [];
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function escribir(col, lista) {
  validarNombreCol(col);
  const ruta = rutaColeccion(col);
  return encolar(ruta, () => guardarColeccion(col, lista));
}

export async function agregar(col, reg) {
  validarNombreCol(col);
  const ruta = rutaColeccion(col);
  return encolar(ruta, async () => {
    const lista = await leer(col);
    const id = reg.id || generarId(col, lista);
    const fecha = reg.fecha || new Date().toISOString();
    const nuevoReg = { ...reg, id, fecha };
    lista.push(nuevoReg);
    await guardarColeccion(col, lista);
    return nuevoReg;
  });
}

export async function actualizar(col, id, cambios) {
  validarNombreCol(col);
  const ruta = rutaColeccion(col);
  return encolar(ruta, async () => {
    const lista = await leer(col);
    const idx = lista.findIndex((item) => item.id === id);
    if (idx === -1) {
      const err = new Error(`Registro no encontrado: ${id}`);
      err.estado = 404;
      throw err;
    }
    const actualizado = { ...lista[idx], ...cambios, id };
    lista[idx] = actualizado;
    await guardarColeccion(col, lista);
    return actualizado;
  });
}

export async function eliminar(col, id) {
  validarNombreCol(col);
  const ruta = rutaColeccion(col);
  return encolar(ruta, async () => {
    const lista = await leer(col);
    const idx = lista.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    lista.splice(idx, 1);
    await guardarColeccion(col, lista);
    return true;
  });
}

export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  if (!filtro || Object.keys(filtro).length === 0) return lista;
  return lista.filter((item) => {
    for (const [clave, valor] of Object.entries(filtro)) {
      if (String(item[clave]) !== String(valor)) return false;
    }
    return true;
  });
}

export async function anexarLinea(archivo, obj) {
  const ruta = rutaArchivoLineas(archivo);
  await asegurarRespaldoDiario();
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  const linea = JSON.stringify(obj) + '\n';
  return encolar(ruta, () => fs.appendFile(ruta, linea, 'utf-8'));
}

export async function leerLineas(archivo) {
  const ruta = rutaArchivoLineas(archivo);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    if (!contenido.trim()) return [];
    return contenido
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function leerConfig(nombre) {
  if (typeof nombre !== 'string' || !/^[a-z0-9-]+$/.test(nombre)) {
    throw new Error(`Nombre de configuración inválido: ${nombre}`);
  }
  const ruta = path.join(DIR_DATOS, 'config', `${nombre}.json`);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    if (!contenido.trim()) return {};
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function guardarConfig(nombre, datos) {
  if (typeof nombre !== 'string' || !/^[a-z0-9-]+$/.test(nombre)) {
    throw new Error(`Nombre de configuración inválido: ${nombre}`);
  }
  const dirConfig = path.join(DIR_DATOS, 'config');
  await fs.mkdir(dirConfig, { recursive: true });
  const ruta = path.join(dirConfig, `${nombre}.json`);
  await fs.writeFile(ruta, JSON.stringify(datos, null, 2), 'utf-8');
  return datos;
}


