import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];
    if (usuario.rol === 'admin') return lista;

    const asignaturasUsuario = await acceso.asignaturasDe(usuario);
    const idsAsignaturas = new Set(asignaturasUsuario.map((a) => a.id));

    const cancionesFiltradas = [];
    for (const c of lista) {
      if (!c.temaId) continue;
      const asig = await acceso.asignaturaDeTema(c.temaId);
      if (asig && idsAsignaturas.has(asig.id)) {
        cancionesFiltradas.push(c);
      }
    }

    return cancionesFiltradas;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error('Sesión requerida');
      err.estado = 401;
      throw err;
    }

    const temaId = datos.temaId || anterior?.temaId;
    if (!temaId) {
      const err = new Error('El campo temaId es obligatorio');
      err.estado = 400;
      throw err;
    }

    const asignatura = await acceso.asignaturaDeTema(temaId);
    if (!asignatura) {
      const err = new Error('Tema o asignatura no encontrada');
      err.estado = 400;
      throw err;
    }

    const puede = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
    if (!puede) {
      const err = new Error('No tiene permiso para gestionar canciones en esta asignatura');
      err.estado = 403;
      throw err;
    }

    // Validación de campos obligatorios
    if (!anterior) {
      if (!datos.titulo || !datos.titulo.trim()) {
        const err = new Error('El título de la canción es obligatorio');
        err.estado = 400;
        throw err;
      }
      if (!datos.audio || !datos.audio.trim()) {
        const err = new Error('El archivo de audio MP3 es obligatorio');
        err.estado = 400;
        throw err;
      }
      if (!datos.autoria || !datos.autoria.trim()) {
        const err = new Error('La autoría es obligatoria');
        err.estado = 400;
        throw err;
      }
      if (!datos.licencia || !datos.licencia.trim()) {
        const err = new Error('La licencia es obligatoria');
        err.estado = 400;
        throw err;
      }
    }

    return datos;
  }
};

