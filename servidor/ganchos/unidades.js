import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];

    let filtrada = lista;

    if (usuario.rol !== 'admin') {
      const asignaturas = await acceso.asignaturasDe(usuario);
      const permitidos = new Set(asignaturas.map((a) => a.id));
      filtrada = filtrada.filter((u) => permitidos.has(u.asignaturaId));
    }

    if (usuario.rol === 'estudiante') {
      filtrada = filtrada.filter((u) => u.visible !== false);
    }

    return filtrada;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    const asignaturaId = datos.asignaturaId || anterior?.asignaturaId;
    if (!asignaturaId) {
      const err = new Error('Se requiere asignaturaId');
      err.estado = 400;
      throw err;
    }

    const puede = await acceso.puedeEditarAsignatura(usuario, asignaturaId);
    if (!puede) {
      const err = new Error('No tiene permiso para editar unidades en esta asignatura');
      err.estado = 403;
      throw err;
    }

    return datos;
  }
};

