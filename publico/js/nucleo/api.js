function obtenerCabeceras(incluirContentType = true) {
  const cabeceras = {};
  if (incluirContentType) {
    cabeceras['Content-Type'] = 'application/json';
  }
  if (typeof sessionStorage !== 'undefined') {
    const token = sessionStorage.getItem('token');
    if (token) {
      cabeceras['Authorization'] = `Bearer ${token}`;
    }
  }
  return cabeceras;
}

function manejar401() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
  }
  if (typeof window !== 'undefined' && window.location) {
    const ruta = window.location.pathname || '';
    if (!ruta.endsWith('ingreso.html') && !ruta.endsWith('registro.html')) {
      window.location.href = '/paginas/ingreso.html';
    }
  }
}

async function procesarRespuesta(res) {
  if (res.status === 401) {
    manejar401();
    throw new Error('Sesión no autorizada');
  }

  let datos = null;
  const tipoContenido = res.headers.get('content-type') || '';
  if (tipoContenido.includes('application/json')) {
    try {
      datos = await res.json();
    } catch {
      datos = null;
    }
  }

  if (datos && typeof datos === 'object' && datos.error) {
    throw new Error(datos.error);
  }

  if (!res.ok) {
    const mensaje = (datos && datos.error) || res.statusText || `Error HTTP ${res.status}`;
    throw new Error(mensaje);
  }

  return datos;
}

export async function llamar(metodo, ruta, cuerpo = null) {
  const metodoMayus = metodo.toUpperCase();
  const opciones = {
    method: metodoMayus,
    headers: obtenerCabeceras(true)
  };

  if (cuerpo !== null && cuerpo !== undefined && metodoMayus !== 'GET' && metodoMayus !== 'HEAD') {
    opciones.body = JSON.stringify(cuerpo);
  }

  const url = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const res = await fetch(url, opciones);
  return await procesarRespuesta(res);
}

export async function listar(col, filtros = {}) {
  let ruta = `/api/${col}`;
  if (filtros && typeof filtros === 'object' && Object.keys(filtros).length > 0) {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null) {
        params.append(clave, valor);
      }
    }
    const query = params.toString();
    if (query) {
      ruta += `?${query}`;
    }
  }
  return await llamar('GET', ruta);
}

export async function obtener(col, id) {
  return await llamar('GET', `/api/${col}/${id}`);
}

export async function crear(col, datos) {
  return await llamar('POST', `/api/${col}`, datos);
}

export async function actualizar(col, id, cambios) {
  return await llamar('PUT', `/api/${col}/${id}`, cambios);
}

export async function eliminar(col, id) {
  return await llamar('DELETE', `/api/${col}/${id}`);
}

export async function subir(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const cabeceras = obtenerCabeceras(false);
  const res = await fetch('/api/subidas', {
    method: 'POST',
    headers: cabeceras,
    body: formData
  });

  return await procesarRespuesta(res);
}

export async function ia(tarea, datos) {
  return await llamar('POST', `/api/ia/${tarea}`, datos);
}

