import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];
    if (usuario.rol === 'admin') return lista;

    if (usuario.rol === 'estudiante') {
      return lista.filter((p) => p.usuarioId === usuario.id);
    }

    if (usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(usuario.id);
      const idsEstudiantes = new Set(estudiantes.map((e) => e.id));
      return lista.filter((p) => idsEstudiantes.has(p.usuarioId));
    }

    return [];
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario || !usuario.id) {
      const err = new Error('Sesión requerida');
      err.estado = 401;
      throw err;
    }

    datos.usuarioId = usuario.id;

    const temaId = datos.temaId || anterior?.temaId;
    if (!temaId) {
      const err = new Error('El temaId es obligatorio');
      err.estado = 400;
      throw err;
    }

    const existentes = await almacen.leer('progreso-temas');
    const idAnterior = anterior ? anterior.id : null;
    const duplicado = existentes.some(
      (p) => p.usuarioId === datos.usuarioId && p.temaId === temaId && p.id !== idAnterior
    );

    if (duplicado) {
      const err = new Error('El progreso para este tema ya se encuentra registrado');
      err.estado = 400;
      throw err;
    }

    return datos;
  }
};

