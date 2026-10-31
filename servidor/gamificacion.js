import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import { evaluarAlertas } from './alertas.js';

// Memoria para limitar intentos por hora por usuario: usuarioId -> Array<timestamp>
const intentosPorHora = new Map();

/**
 * Obtiene el valor de una propiedad en base a una ruta con puntos (ej. "detalle.simulacionId")
 */
function obtenerCampo(obj, ruta) {
  if (!obj || typeof obj !== 'object') return undefined;
  const partes = ruta.split('.');
  let actual = obj;
  for (const p of partes) {
    if (actual == null) return undefined;
    actual = actual[p];
  }
  return actual;
}

/**
 * Verifica y actualiza el límite de intentos por hora en memoria
 */
function verificarLimiteHora(usuarioId, limite) {
  const ahora = Date.now();
  const unaHoraMs = 60 * 60 * 1000;
  let timestamps = intentosPorHora.get(usuarioId) || [];
  timestamps = timestamps.filter((t) => ahora - t < unaHoraMs);

  if (timestamps.length >= limite) {
    const err = new Error('Límite de intentos por hora superado');
    err.estado = 429;
    throw err;
  }

  timestamps.push(ahora);
  intentosPorHora.set(usuarioId, timestamps);
}

/**
 * Procesa un intento de actividad, calcula puntos, gestiona logros y evalúa insignias
 * @param {Object} usuario Usuario en sesión
 * @param {Object} datos Datos del intento { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function procesarIntento(usuario, datos = {}) {
  if (!usuario || !usuario.id) {
    const err = new Error('Sesión requerida');
    err.estado = 401;
    throw err;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const limiteHora = typeof reglas.limiteIntentosHora === 'number' ? reglas.limiteIntentosHora : 60;
  verificarLimiteHora(usuario.id, limiteHora);

  const { actividad, temaId } = datos;

  // 1. Validar actividad existente en reglas.puntos
  if (!actividad || typeof reglas.puntos?.[actividad] !== 'number') {
    const err = new Error(`Actividad '${actividad}' no válida`);
    err.estado = 400;
    throw err;
  }

  // 2. Validar puntaje y maximo: 0 <= puntaje <= maximo y maximo > 0
  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);

  if (isNaN(puntaje) || isNaN(maximo) || maximo <= 0 || puntaje < 0 || puntaje > maximo) {
    const err = new Error('Puntaje o valor máximo inválido');
    err.estado = 400;
    throw err;
  }

  // 3. Validar acceso al tema si viene temaId
  if (temaId) {
    const temas = await almacen.leer('temas');
    const tema = temas.find((t) => t.id === temaId);
    if (!tema) {
      const err = new Error('Tema no encontrado');
      err.estado = 404;
      throw err;
    }

    const asig = await acceso.asignaturaDeTema(temaId);
    if (!asig) {
      const err = new Error('Asignatura del tema no encontrada');
      err.estado = 404;
      throw err;
    }

    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const tieneAcceso = misAsignaturas.some((a) => a.id === asig.id);
    if (!tieneAcceso) {
      const err = new Error('No tienes acceso al tema especificado');
      err.estado = 403;
      throw err;
    }
  }

  // 4. Cálculo base de puntos y bono sin errores
  const basePuntos = Math.round((reglas.puntos[actividad] * puntaje) / maximo);
  const tieneBono = datos.errores === 0 && puntaje === maximo;
  const bono = tieneBono ? (reglas.bonoSinErrores || 0) : 0;
  const puntosCalculados = basePuntos + bono;

  // 5. Verificar si el intento debe registrarse sin puntos
  const todosIntentos = await almacen.leer('intentos');
  const intentosPrevios = todosIntentos.filter((i) => i.usuarioId === usuario.id);

  let esSinPuntos = false;

  // a) Actividades únicas: ya existe un intento con puntos para la misma clave
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const camposClave = reglas.unicas[actividad];
    const yaExisteConPuntos = intentosPrevios.some((i) => {
      if (i.actividad !== actividad || !(i.puntos > 0)) return false;
      return camposClave.every((campo) => {
        const valI = obtenerCampo(i, campo);
        const valD = obtenerCampo(datos, campo);
        return valI !== undefined && valD !== undefined && String(valI) === String(valD);
      });
    });
    if (yaExisteConPuntos) {
      esSinPuntos = true;
    }
  }

  // b) Requiere aprobado y detalle.aprobado !== true
  if (Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (datos.detalle?.aprobado !== true) {
      esSinPuntos = true;
    }
  }

  // c) Límite diario de intentos con puntos
  if (reglas.maxDiario && typeof reglas.maxDiario[actividad] === 'number') {
    const hoy = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = intentosPrevios.filter(
      (i) => i.actividad === actividad && (i.puntos || 0) > 0 && i.fecha && i.fecha.slice(0, 10) === hoy
    );
    if (intentosHoyConPuntos.length >= reglas.maxDiario[actividad]) {
      esSinPuntos = true;
    }
  }

  const puntosGanados = esSinPuntos ? 0 : puntosCalculados;

  // 6. Guardar intento
  const nuevoIntento = {
    usuarioId: usuario.id,
    actividad,
    temaId: temaId || null,
    nivel: datos.nivel !== undefined ? datos.nivel : null,
    puntaje,
    maximo,
    errores: typeof datos.errores === 'number' ? datos.errores : 0,
    duracionSeg: typeof datos.duracionSeg === 'number' ? datos.duracionSeg : 0,
    detalle: datos.detalle || {},
    puntos: puntosGanados
  };

  const intentoGuardado = await almacen.agregar('intentos', nuevoIntento);

  // 7. Actualizar logros
  const todosLogros = await almacen.leer('logros');
  let logro = todosLogros.find((l) => l.usuarioId === usuario.id);
  let esNuevoLogro = false;

  if (!logro) {
    logro = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
    esNuevoLogro = true;
  } else {
    if (typeof logro.puntos !== 'number') logro.puntos = 0;
    if (!Array.isArray(logro.insignias)) logro.insignias = [];
    if (!logro.nivelQuiz || typeof logro.nivelQuiz !== 'object') logro.nivelQuiz = {};
  }

  logro.puntos += puntosGanados;

  // Si es quiz aprobado, registrar el nivel alcanzado en el tema
  if (actividad === 'quiz' && temaId && datos.nivel && datos.detalle?.aprobado === true) {
    const nivelNum = Number(datos.nivel);
    const nivelActual = Number(logro.nivelQuiz[temaId] || 0);
    if (nivelNum > nivelActual) {
      logro.nivelQuiz[temaId] = nivelNum;
    }
  }

  // 8. Evaluar insignias no obtenidas
  const todosIntentosUsuario = [...intentosPrevios, intentoGuardado];
  const insigniasObtenidasIds = new Set((logro.insignias || []).map((ins) => ins.id));
  const catalogoInsignias = await almacen.leer('insignias');
  const insigniasNuevas = [];

  for (const ins of catalogoInsignias) {
    if (insigniasObtenidasIds.has(ins.id)) continue;

    const condicion = ins.condicion;
    if (!condicion || !condicion.tipo) continue;

    let cumple = false;

    // a) Conteo: cuenta intentos (en actividades únicas, claves distintas)
    if (condicion.tipo === 'conteo') {
      const act = condicion.actividad;
      const intentosAct = todosIntentosUsuario.filter((i) => i.actividad === act);
      if (reglas.unicas && Array.isArray(reglas.unicas[act])) {
        const campos = reglas.unicas[act];
        const clavesDistintas = new Set();
        for (const i of intentosAct) {
          const valores = campos.map((c) => obtenerCampo(i, c));
          if (valores.every((v) => v !== undefined)) {
            clavesDistintas.add(valores.map(String).join('::'));
          }
        }
        cumple = clavesDistintas.size >= (condicion.minimo || 1);
      } else {
        cumple = intentosAct.length >= (condicion.minimo || 1);
      }
    }

    // b) sinErrores: intento sin errores en la actividad indicada
    else if (condicion.tipo === 'sinErrores') {
      const act = condicion.actividad;
      cumple = todosIntentosUsuario.some(
        (i) => i.actividad === act && Number(i.errores) === 0 && Number(i.puntaje) > 0
      );
    }

    // c) puntos: puntos totales alcanzados
    else if (condicion.tipo === 'puntos') {
      cumple = logro.puntos >= (condicion.minimo || 0);
    }

    // d) nivelQuiz: aprobación de nivel en cualquier tema
    else if (condicion.tipo === 'nivelQuiz') {
      const niveles = Object.values(logro.nivelQuiz || {});
      cumple = niveles.some((n) => Number(n) >= Number(condicion.nivel));
    }

    // e) racha: días consecutivos con intentos hasta hoy
    else if (condicion.tipo === 'racha') {
      const diasRequeridos = condicion.dias || 1;
      const fechas = new Set();
      for (const i of todosIntentosUsuario) {
        if (i.fecha) {
          fechas.add(new Date(i.fecha).toISOString().slice(0, 10));
        }
      }
      let racha = 0;
      const cursor = new Date();
      while (true) {
        const fechaStr = cursor.toISOString().slice(0, 10);
        if (fechas.has(fechaStr)) {
          racha++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
      cumple = racha >= diasRequeridos;
    }

    if (cumple) {
      const nueva = {
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono
      };
      insigniasNuevas.push(nueva);
      logro.insignias.push({
        id: ins.id,
        fecha: new Date().toISOString()
      });
      insigniasObtenidasIds.add(ins.id);
    }
  }

  // 9. Guardar logros
  if (esNuevoLogro) {
    await almacen.agregar('logros', logro);
  } else {
    await almacen.actualizar('logros', logro.id, {
      puntos: logro.puntos,
      insignias: logro.insignias,
      nivelQuiz: logro.nivelQuiz
    });
  }

  // 10. Evaluar alertas dentro de try/catch
  try {
    await evaluarAlertas(intentoGuardado, usuario);
  } catch (err) {
    console.error('Error al evaluar alertas:', err.message);
  }

  return {
    puntosGanados,
    puntosTotales: logro.puntos,
    insigniasNuevas
  };
}

