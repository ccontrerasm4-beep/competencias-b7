import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];

    if (usuario.rol === 'estudiante') {
      return lista.filter((n) => n.estado === 'publicado');
    }

    return lista;
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error('Sesión requerida');
      err.estado = 401;
      throw err;
    }

    // Al crear fija autorId
    if (!anterior) {
      datos.autorId = usuario.id;
    } else {
      datos.autorId = anterior.autorId || usuario.id;
    }

    // Fija fechaPublicacion cuando el estado pasa a "publicado"
    if (datos.estado === 'publicado') {
      if (!anterior || anterior.estado !== 'publicado') {
        datos.fechaPublicacion = new Date().toISOString();
      } else if (anterior && anterior.fechaPublicacion) {
        datos.fechaPublicacion = anterior.fechaPublicacion;
      }
    } else if (anterior && anterior.fechaPublicacion && !datos.fechaPublicacion) {
      datos.fechaPublicacion = anterior.fechaPublicacion;
    }

    return datos;
  },

  async despuesDeGuardar(reg, usuario, anterior) {
    // Cuando una noticia pasa a "publicado", notifica a los estudiantes
    const acabaDePublicarse =
      reg.estado === 'publicado' && (!anterior || anterior.estado !== 'publicado');
    if (!acabaDePublicarse) return;

    try {
      let idsEstudiantes = new Set();

      if (reg.temaId) {
        const asig = await acceso.asignaturaDeTema(reg.temaId);
        if (asig) {
          const distributivo = await almacen.leer('distributivo');
          const gruposAsig = distributivo.filter((g) => g.asignaturaId === asig.id);
          for (const g of gruposAsig) {
            if (Array.isArray(g.estudiantes)) {
              for (const eId of g.estudiantes) {
                idsEstudiantes.add(eId);
              }
            }
          }
        }
      }

      // Si no tiene tema o no tiene estudiantes asignados, notificar a todos los estudiantes
      if (idsEstudiantes.size === 0) {
        const usuarios = await almacen.leer('usuarios');
        const estudiantes = usuarios.filter((u) => u.rol === 'estudiante' && u.activo !== false);
        for (const e of estudiantes) {
          idsEstudiantes.add(e.id);
        }
      }

      const mensaje = `Nueva noticia: ${reg.titulo}`;
      const enlace = `/paginas/noticia.html?id=${reg.id}`;

      for (const eId of idsEstudiantes) {
        await notificar(eId, { tipo: 'noticia', mensaje, enlace });
      }
    } catch (err) {
      console.warn('Error al enviar notificaciones de noticia publicada:', err);
    }
  }
};
