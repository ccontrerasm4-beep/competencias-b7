import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];

    // Los estudiantes nunca leen esta colección
    if (usuario.rol === 'estudiante') {
      return [];
    }

    if (usuario.rol === 'admin') {
      return lista;
    }

    if (usuario.rol === 'docente') {
      const grupos = await acceso.gruposDe(usuario);
      const idsAsignaturas = new Set(grupos.map((g) => g.asignaturaId).filter(Boolean));

      const todasUnidades = await almacen.leer('unidades');
      const idsUnidadesDocente = new Set(
        todasUnidades.filter((u) => idsAsignaturas.has(u.asignaturaId)).map((u) => u.id)
      );

      const todosTemas = await almacen.leer('temas');
      const idsTemasDocente = new Set(
        todosTemas.filter((t) => idsUnidadesDocente.has(t.unidadId)).map((t) => t.id)
      );

      return lista.filter((p) => idsTemasDocente.has(p.temaId));
    }

    return [];
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error('Sesión requerida');
      err.estado = 401;
      throw err;
    }

    const temaId = datos.temaId || anterior?.temaId;
    if (!temaId) {
      const err = new Error('temaId es obligatorio');
      err.estado = 400;
      throw err;
    }

    const asignatura = await acceso.asignaturaDeTema(temaId);
    if (!asignatura) {
      const err = new Error('Tema o asignatura no encontrada');
      err.estado = 404;
      throw err;
    }

    // Verificar con puedeEditarAsignatura
    const puede = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
    if (!puede) {
      const err = new Error('No tienes permiso para gestionar preguntas de esta asignatura');
      err.estado = 403;
      throw err;
    }

    // Validar campos de la pregunta
    if (datos.nivel !== undefined) {
      datos.nivel = Math.min(5, Math.max(1, parseInt(datos.nivel, 10) || 1));
    } else if (!anterior) {
      datos.nivel = 1;
    }

    if (datos.tipo) {
      const tiposValidos = ['opcion', 'vf', 'completar'];
      if (!tiposValidos.includes(datos.tipo)) {
        datos.tipo = 'opcion';
      }
    } else if (!anterior) {
      datos.tipo = 'opcion';
    }

    if (datos.enunciado !== undefined) {
      datos.enunciado = String(datos.enunciado || '').trim();
      if (!datos.enunciado) {
        const err = new Error('El enunciado de la pregunta es obligatorio');
        err.estado = 400;
        throw err;
      }
    }

    if (!anterior) {
      datos.origen = datos.origen || 'manual';
      datos.estado = datos.estado || 'aprobado';
    } else {
      if (datos.estado) datos.estado = String(datos.estado);
      if (datos.origen) datos.origen = String(datos.origen);
    }

    return datos;
  }
};
