import * as api from './api.js';

export function token() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem('token');
}

export function usuarioActual() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function registrar(datos) {
  return await api.llamar('POST', '/api/auth/registro', datos);
}

export async function iniciar(correo, clave) {
  const respuesta = await api.llamar('POST', '/api/auth/login', { correo, clave });

  if (respuesta && respuesta.token && respuesta.usuario) {
    sessionStorage.setItem('token', respuesta.token);
    sessionStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
    return respuesta.usuario;
  }

  throw new Error('Respuesta de autenticación incompleta');
}

export async function cerrar() {
  try {
    await api.llamar('POST', '/api/auth/logout');
  } catch {
    // Si falla la red, cerramos la sesión localmente de todas formas
  } finally {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
  }
}

export function exigirRol(roles = []) {
  if (typeof window === 'undefined') return true;

  if (!roles || roles.length === 0 || roles.includes('publico')) {
    return true;
  }

  const usuario = usuarioActual();

  // Sin sesión → redirigir a ingreso.html
  if (!usuario) {
    window.location.href = '/paginas/ingreso.html';
    return false;
  }

  // Con sesión pero verificación genérica de 'sesion'
  if (roles.includes('sesion')) {
    return true;
  }

  // Rol no permitido → redirigir a index.html con aviso guardado
  if (!roles.includes(usuario.rol)) {
    sessionStorage.setItem('aviso_pendiente', JSON.stringify({
      texto: 'No tienes los permisos requeridos para acceder a esta sección.',
      tipo: 'error'
    }));
    window.location.href = '/index.html';
    return false;
  }

  return true;
}

