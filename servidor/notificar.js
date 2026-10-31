import * as almacen from './almacen.js';

/**
 * Crea una nueva notificación para un usuario con leida: false.
 * @param {string} usuarioId ID del destinatario
 * @param {Object} datos Datos { tipo, mensaje, enlace }
 * @returns {Promise<Object>} Registro creado con id, fecha y leida: false
 */
export async function notificar(usuarioId, { tipo = 'sistema', mensaje = '', enlace = '' } = {}) {
  if (!usuarioId) {
    throw new Error('usuarioId es obligatorio para notificar');
  }

  const registro = {
    usuarioId,
    tipo: tipo || 'sistema',
    mensaje: mensaje || '',
    enlace: enlace || '',
    leida: false
  };

  return await almacen.agregar('notificaciones', registro);
}

