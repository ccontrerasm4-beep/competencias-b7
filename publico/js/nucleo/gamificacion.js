import * as api from './api.js';
import * as ui from './ui.js';

/**
 * Registra un intento de actividad en el servidor, procesa los logros
 * y presenta la retroalimentación visual al usuario.
 * @param {Object} datos { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array }>}
 */
export async function registrarIntento(datos = {}) {
  const resultado = await api.llamar('POST', '/api/intentos', datos);
  await mostrarLogros(resultado);
  return resultado;
}

/**
 * Presenta las recompensas obtenidas: aviso de puntos, modales de celebración
 * por insignias y actualización del indicador en el encabezado.
 * @param {Object} resultado { puntosGanados, puntosTotales, insigniasNuevas }
 */
export async function mostrarLogros(resultado = {}) {
  const puntosGanados = Number(resultado.puntosGanados || 0);

  // 1. Mostrar aviso con los puntos ganados si son más de 0
  if (puntosGanados > 0) {
    ui.aviso(`+${puntosGanados} puntos ganados`, 'exito');
  }

  // 2. Actualizar el elemento #puntos-usuario en el encabezado
  if (typeof resultado.puntosTotales === 'number') {
    const elemPuntos = document.getElementById('puntos-usuario');
    if (elemPuntos) {
      elemPuntos.textContent = `${resultado.puntosTotales} pts`;
      elemPuntos.title = `${resultado.puntosTotales} puntos acumulados`;
    }
  }

  // 3. Modal de celebración por cada insignia nueva obtenida
  if (Array.isArray(resultado.insigniasNuevas) && resultado.insigniasNuevas.length > 0) {
    for (const ins of resultado.insigniasNuevas) {
      const cuerpoModal = document.createElement('div');
      cuerpoModal.className = 'celebracion';
      cuerpoModal.innerHTML = `
        <div class="celebracion__icono" aria-hidden="true">${ui.escapar(ins.icono || '🏆')}</div>
        <h3 class="celebracion__nombre">${ui.escapar(ins.nombre || 'Nueva Insignia')}</h3>
        <p class="celebracion__desc">¡Felicidades! Has completado el desafío y desbloqueado esta insignia.</p>
      `;

      await ui.modal({
        titulo: '¡Insignia Desbloqueada!',
        contenido: cuerpoModal,
        acciones: [{ texto: '¡Continuar!', valor: true, clase: 'btn btn--primario' }]
      });
    }
  }
}

/**
 * Consulta los logros del usuario indicado (por defecto "yo").
 * @param {string} usuarioId ID del usuario o "yo"
 * @returns {Promise<{ puntos: number, insignias: Array, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = 'yo') {
  try {
    const id = encodeURIComponent(usuarioId || 'yo');
    return await api.llamar('GET', `/api/logros/${id}`);
  } catch {
    return {
      usuarioId,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  }
}

