import * as almacen from '../almacen.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];
    if (usuario.rol === 'admin') return lista;

    return lista.filter((l) => l.usuarioId === usuario.id);
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario || !usuario.id) {
      const err = new Error('Sesión requerida');
      err.estado = 401;
      throw err;
    }

    datos.usuarioId = usuario.id;

    const noticiaId = datos.noticiaId || anterior?.noticiaId;
    if (!noticiaId) {
      const err = new Error('El campo noticiaId es obligatorio');
      err.estado = 400;
      throw err;
    }

    const lecturas = await almacen.leer('lecturas-noticias');
    const idAnterior = anterior ? anterior.id : null;
    const duplicado = lecturas.some(
      (l) => l.usuarioId === datos.usuarioId && l.noticiaId === noticiaId && l.id !== idAnterior
    );

    if (duplicado) {
      const err = new Error('La lectura de esta noticia ya ha sido registrada previamente');
      err.estado = 400;
      throw err;
    }

    return datos;
  }
};

