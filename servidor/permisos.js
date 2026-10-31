import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_PERMISOS = path.resolve(__dirname, '../datos/config/permisos.json');

function obtenerReglasPermisos() {
  try {
    const contenido = fs.readFileSync(RUTA_PERMISOS, 'utf-8');
    return JSON.parse(contenido);
  } catch {
    return {};
  }
}

export function puede(usuario, accion, col, registro) {
  if (!col || !accion) return false;

  const reglas = obtenerReglasPermisos();
  const clave = reglas[col] ? col : col.split('/')[0];
  const reglaCol = reglas[clave];

  if (!reglaCol || !Array.isArray(reglaCol[accion])) {
    return false;
  }

  const permitidos = reglaCol[accion];

  for (const rolPermitido of permitidos) {
    if (rolPermitido === 'servidor') {
      // "servidor" nunca se permite desde la API
      continue;
    }

    if (rolPermitido === 'publico') {
      return true;
    }

    if (rolPermitido === 'sesion') {
      if (usuario && usuario.id) return true;
    }

    if (usuario && usuario.rol && rolPermitido === usuario.rol) {
      return true;
    }

    if (rolPermitido === 'propio') {
      if (!registro) {
        if (usuario && usuario.id) return true;
      } else if (usuario && usuario.id) {
        if (registro.usuarioId === usuario.id || (clave === 'usuarios' && registro.id === usuario.id)) {
          return true;
        }
      }
    }
  }

  return false;
}

