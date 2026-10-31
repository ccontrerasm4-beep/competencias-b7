import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];

    let filtrada = lista;

    if (usuario.rol !== 'admin') {
      const unidades = await almacen.leer('unidades');
      const unidadAsigMap = new Map(unidades.map((u) => [u.id, u.asignaturaId]));
      const asignaturas = await acceso.asignaturasDe(usuario);
      const permitidos = new Set(asignaturas.map((a) => a.id));

      filtrada = filtrada.filter((t) => {
        const asigId = unidadAsigMap.get(t.unidadId);
        return asigId && permitidos.has(asigId);
      });
    }

    if (usuario.rol === 'estudiante') {
      filtrada = filtrada.filter((t) => t.estado === 'publicado');
    }

    return filtrada;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    const unidadId = datos.unidadId || anterior?.unidadId;
    if (!unidadId) {
      const err = new Error('Se requiere unidadId');
      err.estado = 400;
      throw err;
    }

    const unidades = await almacen.leer('unidades');
    const unidad = unidades.find((u) => u.id === unidadId);
    if (!unidad) {
      const err = new Error('Unidad no encontrada');
      err.estado = 400;
      throw err;
    }

    const puede = await acceso.puedeEditarAsignatura(usuario, unidad.asignaturaId);
    if (!puede) {
      const err = new Error('No tiene permiso para editar temas en esta asignatura');
      err.estado = 403;
      throw err;
    }

    return datos;
  }
};

