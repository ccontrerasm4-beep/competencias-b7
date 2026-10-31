import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_GANCHOS = path.resolve(__dirname, 'ganchos');

const ganchosPorCol = new Map();

export async function cargarGanchos() {
  ganchosPorCol.clear();
  try {
    const archivos = await fs.readdir(DIR_GANCHOS);
    for (const archivo of archivos) {
      if (!archivo.endsWith('.js')) continue;
      const col = archivo.slice(0, -3);
      const rutaCompleta = path.join(DIR_GANCHOS, archivo);
      const modulo = await import(pathToFileURL(rutaCompleta).href);
      ganchosPorCol.set(col, modulo.default || modulo);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error al cargar ganchos:', err);
    }
  }
}

export async function aplicar(col, nombre, ...args) {
  const clave = col.includes('/') ? col.split('/')[0] : col;
  const gancho = ganchosPorCol.get(col) || ganchosPorCol.get(clave);

  if (gancho && typeof gancho[nombre] === 'function') {
    return await gancho[nombre](...args);
  }

  return args[0];
}

// Carga inicial al importar el módulo
await cargarGanchos();

