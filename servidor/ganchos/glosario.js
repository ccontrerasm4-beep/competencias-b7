import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];

    let filtrada = lista;

    if (usuario.rol !== 'admin') {
      const asignaturas = await acceso.asignaturasDe(usuario);
      const permitidos = new Set(asignaturas.map((a) => a.id));

      const temasGlosario = new Set(filtrada.map((g) => g.temaId).filter(Boolean));
      const mapaTemaAsignatura = new Map();

      for (const temaId of temasGlosario) {
        const asig = await acceso.asignaturaDeTema(temaId);
        if (asig) {
          mapaTemaAsignatura.set(temaId, asig.id);
        }
      }

      filtrada = filtrada.filter((g) => {
        const asigId = mapaTemaAsignatura.get(g.temaId);
        return asigId && permitidos.has(asigId);
      });
    }

    if (usuario.rol === 'estudiante') {
      filtrada = filtrada.filter((g) => g.estado === 'aprobado');
    }

    return filtrada;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    const temaId = datos.temaId || anterior?.temaId;
    if (!temaId) {
      const err = new Error('Se requiere temaId');
      err.estado = 400;
      throw err;
    }

    const asignatura = await acceso.asignaturaDeTema(temaId);
    if (!asignatura) {
      const err = new Error('Tema no encontrado');
      err.estado = 400;
      throw err;
    }

    const puede = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
    if (!puede) {
      const err = new Error('No tiene permiso para editar glosario en esta asignatura');
      err.estado = 403;
      throw err;
    }

    return datos;
  }
};

