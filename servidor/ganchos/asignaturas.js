import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];
    if (usuario.rol === 'admin') return lista;

    const asignaturas = await acceso.asignaturasDe(usuario);
    const permitidos = new Set(asignaturas.map((a) => a.id));
    return lista.filter((a) => permitidos.has(a.id));
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error('Sesión requerida');
      err.estado = 401;
      throw err;
    }

    if (usuario.rol === 'admin') {
      return datos;
    }

    if (usuario.rol === 'docente') {
      if (!anterior) {
        const err = new Error('Solo el administrador puede crear nuevas asignaturas');
        err.estado = 403;
        throw err;
      }

      const puede = await acceso.puedeEditarAsignatura(usuario, anterior.id);
      if (!puede) {
        const err = new Error('No tienes permiso para modificar esta asignatura');
        err.estado = 403;
        throw err;
      }

      if (datos.id && datos.id !== anterior.id) {
        const err = new Error('No se puede modificar el identificador de la asignatura');
        err.estado = 400;
        throw err;
      }

      return datos;
    }

    const err = new Error('No tienes permiso para modificar asignaturas');
    err.estado = 403;
    throw err;
  }
};
