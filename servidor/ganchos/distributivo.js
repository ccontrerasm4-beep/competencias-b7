export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];
    if (usuario.rol === 'admin') return lista;

    if (usuario.rol === 'docente') {
      return lista.filter((g) => g.docenteId === usuario.id);
    }

    if (usuario.rol === 'estudiante') {
      return lista.filter(
        (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
      );
    }

    return [];
  }
};

