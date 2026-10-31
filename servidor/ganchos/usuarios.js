export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    return lista.map(({ claveHash, ...resto }) => resto);
  },

  async antesDeGuardar(datos, usuario, anterior) {
    const { claveHash, correo, ...limpios } = datos || {};

    if (anterior && usuario && anterior.id === usuario.id) {
      if (limpios.rol !== undefined && limpios.rol !== anterior.rol) {
        const err = new Error('Un administrador no puede modificar su propio rol');
        err.estado = 400;
        throw err;
      }

      if (limpios.activo !== undefined && limpios.activo === false && anterior.activo === true) {
        const err = new Error('Un administrador no puede desactivarse a sí mismo');
        err.estado = 400;
        throw err;
      }
    }

    return limpios;
  }
};

