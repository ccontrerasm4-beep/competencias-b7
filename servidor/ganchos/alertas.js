import * as almacen from '../almacen.js';

export default {
  async filtrarLista(lista, usuario) {
    if (!Array.isArray(lista)) return lista;
    if (!usuario) return [];

    if (usuario.rol === 'admin') {
      return lista;
    }

    if (usuario.rol === 'docente') {
      const distributivo = await almacen.leer('distributivo');
      const misGruposIds = new Set(
        distributivo.filter((g) => g.docenteId === usuario.id).map((g) => g.id)
      );

      return lista.filter(
        (a) => a.docenteId === usuario.id || (a.grupoId && misGruposIds.has(a.grupoId))
      );
    }

    return [];
  },

  async antesDeGuardar(datos, usuario, anterior) {
    if (!usuario) {
      const err = new Error('Sesión requerida');
      err.estado = 401;
      throw err;
    }

    // Al actualizar: solo se permite cambiar el campo estado ("activa" | "atendida")
    if (anterior) {
      if (datos.estado && datos.estado !== 'activa' && datos.estado !== 'atendida') {
        const err = new Error('Estado inválido. Solo se permite "activa" o "atendida"');
        err.estado = 400;
        throw err;
      }

      // Proteger todos los demás campos manteniendo los originales de anterior
      return {
        ...anterior,
        estado: datos.estado || anterior.estado
      };
    }

    return datos;
  }
};

