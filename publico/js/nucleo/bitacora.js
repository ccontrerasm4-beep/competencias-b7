import * as api from './api.js';

export async function registrarEvento(tipo, recurso) {
  try {
    return await api.llamar('POST', '/api/eventos', { tipo, recurso });
  } catch (err) {
    // Si falla el registro del evento en bitácora, no interrumpimos la experiencia del usuario
    console.warn('No se pudo registrar evento en bitácora:', err);
    return null;
  }
}

