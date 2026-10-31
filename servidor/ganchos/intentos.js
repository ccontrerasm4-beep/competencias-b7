import * as acceso from '../acceso.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];
    if (usuario.rol === 'admin') return lista;

    if (usuario.rol === 'estudiante') {
      return lista.filter((i) => i.usuarioId === usuario.id);
    }

    if (usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(usuario.id);
      const idsEstudiantes = new Set(estudiantes.map((e) => e.id));
      return lista.filter((i) => idsEstudiantes.has(i.usuarioId));
    }

    return [];
  }
};

