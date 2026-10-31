import * as almacen from './almacen.js';

export async function limpiarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date().toISOString();
    const activas = sesiones.filter((s) => s.expira > ahora);
    if (activas.length !== sesiones.length) {
      await almacen.escribir('sesiones', activas);
    }
  } catch (err) {
    console.error('Error al limpiar sesiones vencidas:', err);
  }
}

// Al cargarse borra las sesiones vencidas
await limpiarSesionesVencidas();

export async function cargarUsuario(req, res, next) {
  req.usuario = null;
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const sesiones = await almacen.buscar('sesiones', { token });
    if (!sesiones || sesiones.length === 0) {
      return next();
    }

    const sesion = sesiones[0];
    const ahora = new Date().toISOString();

    if (sesion.expira <= ahora) {
      // Sesión expirada
      await almacen.eliminar('sesiones', sesion.id);
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === sesion.usuarioId);

    if (usuario && usuario.activo) {
      req.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol
      };
    }
  } catch (err) {
    console.error('Error en cargarUsuario:', err);
  }

  next();
}

export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso no permitido para este rol' });
    }

    next();
  };
}

