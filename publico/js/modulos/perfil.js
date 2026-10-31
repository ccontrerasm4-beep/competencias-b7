import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { logrosDe } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: "Mi Perfil", roles: ["sesion"] });

function actualizarAvatarEncabezado(usr) {
  if (!usr || !usr.foto) return;
  const enlacePerfil = document.querySelector('.encabezado .fila a[href*="perfil.html"]');
  if (enlacePerfil) {
    let img = enlacePerfil.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.style.width = '28px';
      img.style.height = '28px';
      img.style.borderRadius = 'var(--radio-completo)';
      img.style.objectFit = 'cover';
      img.style.border = '1px solid var(--color-borde)';
      img.alt = `Foto de ${usr.nombre || 'usuario'}`;
      enlacePerfil.prepend(img);
    }
    img.src = usr.foto;
  }
}

const contenido = document.getElementById('contenido');
if (contenido) {
  let usuario = null;

  try {
    usuario = await api.llamar('GET', '/api/auth/yo');
    const sesionActual = usuarioActual() || {};
    sessionStorage.setItem('usuario', JSON.stringify({ ...sesionActual, ...usuario }));
    actualizarAvatarEncabezado(usuario);
  } catch (err) {
    ui.aviso('No se pudo cargar la información del perfil', 'error');
    usuario = usuarioActual();
  }

  let urlFotoActual = usuario?.foto || null;
  let archivoFotoPendiente = null;
  const inicialNombre = (usuario?.nombre ? usuario.nombre[0] : 'U').toUpperCase();
  const tieneFoto = Boolean(urlFotoActual);

  contenido.innerHTML = `
    <div class="perfil-contenedor">
      <section class="tarjeta">
        <h2>Datos Personales</h2>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
          Actualiza tu nombre, apellido e imagen de perfil en la plataforma.
        </p>

        <form id="formPerfil" class="pila" novalidate>
          <div class="perfil-avatar-bloque">
            <div id="avatarPreviewContainer">
              ${
                tieneFoto
                  ? `<img src="${ui.escapar(urlFotoActual)}" alt="Foto de perfil" class="perfil-avatar-img" id="imgAvatar">`
                  : `<div class="perfil-avatar-placeholder" id="placeholderAvatar">${ui.escapar(inicialNombre)}</div>`
              }
            </div>

            <div class="campo" style="max-width: 320px;">
              <label for="campoFoto">Cambiar foto de perfil</label>
              <input type="file" id="campoFoto" accept="image/jpeg, image/png, image/webp">
              <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
                Formatos JPG, PNG o WEBP (máximo 2 MB).
              </span>
            </div>
          </div>

          <div class="campo">
            <label for="nombre">Nombre</label>
            <input type="text" id="nombre" name="nombre" value="${ui.escapar(usuario?.nombre || '')}" required>
            <span class="campo__error" id="errorNombre"></span>
          </div>

          <div class="campo">
            <label for="apellido">Apellido</label>
            <input type="text" id="apellido" name="apellido" value="${ui.escapar(usuario?.apellido || '')}" required>
            <span class="campo__error" id="errorApellido"></span>
          </div>

          <div class="campo">
            <label for="correo">Correo Electrónico (Solo lectura)</label>
            <input type="email" id="correo" value="${ui.escapar(usuario?.correo || '')}" disabled>
          </div>

          <div class="fila" style="justify-content: flex-end; margin-top: var(--espacio-s);">
            <button type="submit" class="btn btn--primario" id="btnGuardarPerfil">Guardar Cambios</button>
          </div>
        </form>
      </section>

      <section class="tarjeta">
        <h2>Seguridad y Contraseña</h2>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
          Modifica tu contraseña de acceso institucional.
        </p>

        <form id="formClave" class="pila" novalidate>
          <div class="campo">
            <label for="claveActual">Contraseña Actual</label>
            <input type="password" id="claveActual" name="actual" required autocomplete="current-password">
            <span class="campo__error" id="errorClaveActual"></span>
          </div>

          <div class="campo">
            <label for="claveNueva">Nueva Contraseña</label>
            <input type="password" id="claveNueva" name="nueva" placeholder="Mínimo 8 caracteres (letras y números)" required autocomplete="new-password">
            <span class="campo__error" id="errorClaveNueva"></span>
          </div>

          <div class="campo">
            <label for="claveRepetir">Repetir Nueva Contraseña</label>
            <input type="password" id="claveRepetir" name="repetir" placeholder="Confirma tu nueva contraseña" required autocomplete="new-password">
            <span class="campo__error" id="errorClaveRepetir"></span>
          </div>

          <div class="fila" style="justify-content: flex-end; margin-top: var(--espacio-s);">
            <button type="submit" class="btn btn--primario" id="btnCambiarClave">Actualizar Contraseña</button>
          </div>
        </form>
      </section>

      <!-- Sección de logros (se completará en el Sprint 5) -->
      <section id="logros"></section>
    </div>
  `;

  // Gestión de formulario de perfil
  const formPerfil = document.getElementById('formPerfil');
  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const inputFoto = document.getElementById('campoFoto');
  const btnGuardarPerfil = document.getElementById('btnGuardarPerfil');
  const errorNombre = document.getElementById('errorNombre');
  const errorApellido = document.getElementById('errorApellido');
  const avatarPreviewContainer = document.getElementById('avatarPreviewContainer');

  // Previsualización y subida al seleccionar imagen
  inputFoto.addEventListener('change', async () => {
    const file = inputFoto.files && inputFoto.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      ui.aviso('La imagen seleccionada supera el límite de 2 MB', 'advertencia');
      inputFoto.value = '';
      archivoFotoPendiente = null;
      return;
    }

    archivoFotoPendiente = file;
    const previewUrl = URL.createObjectURL(file);
    avatarPreviewContainer.innerHTML = `<img src="${previewUrl}" alt="Previsualización de foto" class="perfil-avatar-img">`;

    try {
      ui.aviso('Subiendo foto de perfil...', 'info');
      const subida = await api.subir(file);
      urlFotoActual = subida.url;
      archivoFotoPendiente = null;

      const actualizado = await api.llamar('PUT', '/api/auth/perfil', { foto: urlFotoActual });

      const sesionActual = usuarioActual() || {};
      const sesionNueva = {
        ...sesionActual,
        foto: actualizado.foto
      };
      sessionStorage.setItem('usuario', JSON.stringify(sesionNueva));

      usuario = actualizado;
      avatarPreviewContainer.innerHTML = `<img src="${ui.escapar(actualizado.foto)}" alt="Foto de perfil" class="perfil-avatar-img">`;
      actualizarAvatarEncabezado(actualizado);
      ui.aviso('Foto de perfil guardada con éxito', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al subir la imagen', 'error');
    }
  });

  formPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = inputNombre.value.trim();
    const apellido = inputApellido.value.trim();

    let valido = true;
    if (!nombre) {
      errorNombre.textContent = 'El nombre es obligatorio.';
      valido = false;
    } else {
      errorNombre.textContent = '';
    }

    if (!apellido) {
      errorApellido.textContent = 'El apellido es obligatorio.';
      valido = false;
    } else {
      errorApellido.textContent = '';
    }

    if (!valido) return;

    btnGuardarPerfil.disabled = true;
    btnGuardarPerfil.textContent = 'Guardando...';

    try {
      let fotoUrl = urlFotoActual;

      // Si hay un archivo pendiente de subida
      const fileToUpload = archivoFotoPendiente || (inputFoto.files && inputFoto.files[0]);
      if (fileToUpload) {
        ui.aviso('Subiendo foto de perfil...', 'info');
        const subida = await api.subir(fileToUpload);
        fotoUrl = subida.url;
        urlFotoActual = subida.url;
        archivoFotoPendiente = null;
      }

      const cambios = { nombre, apellido };
      if (fotoUrl) {
        cambios.foto = fotoUrl;
      }

      const actualizado = await api.llamar('PUT', '/api/auth/perfil', cambios);

      const sesionActual = usuarioActual() || {};
      const sesionNueva = {
        ...sesionActual,
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
        foto: actualizado.foto
      };
      sessionStorage.setItem('usuario', JSON.stringify(sesionNueva));

      usuario = actualizado;
      urlFotoActual = actualizado.foto;
      if (usuario.foto) {
        avatarPreviewContainer.innerHTML = `<img src="${ui.escapar(usuario.foto)}" alt="Foto de perfil" class="perfil-avatar-img">`;
        actualizarAvatarEncabezado(usuario);
      }
      ui.aviso('Perfil actualizado correctamente', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al actualizar el perfil', 'error');
    } finally {
      btnGuardarPerfil.disabled = false;
      btnGuardarPerfil.textContent = 'Guardar Cambios';
    }
  });

  // Gestión de cambio de clave
  const formClave = document.getElementById('formClave');
  const inputClaveActual = document.getElementById('claveActual');
  const inputClaveNueva = document.getElementById('claveNueva');
  const inputClaveRepetir = document.getElementById('claveRepetir');
  const btnCambiarClave = document.getElementById('btnCambiarClave');

  const errorClaveActual = document.getElementById('errorClaveActual');
  const errorClaveNueva = document.getElementById('errorClaveNueva');
  const errorClaveRepetir = document.getElementById('errorClaveRepetir');

  formClave.addEventListener('submit', async (e) => {
    e.preventDefault();

    const actual = inputClaveActual.value;
    const nueva = inputClaveNueva.value;
    const repetir = inputClaveRepetir.value;

    let valido = true;
    if (!actual) {
      errorClaveActual.textContent = 'Debes ingresar tu contraseña actual.';
      valido = false;
    } else {
      errorClaveActual.textContent = '';
    }

    if (!nueva) {
      errorClaveNueva.textContent = 'Ingresa la nueva contraseña.';
      valido = false;
    } else if (nueva.length < 8 || !/[a-zA-Z]/.test(nueva) || !/\d/.test(nueva)) {
      errorClaveNueva.textContent = 'Debe tener al menos 8 caracteres y contener letras y números.';
      valido = false;
    } else {
      errorClaveNueva.textContent = '';
    }

    if (nueva !== repetir) {
      errorClaveRepetir.textContent = 'Las contraseñas no coinciden.';
      valido = false;
    } else {
      errorClaveRepetir.textContent = '';
    }

    if (!valido) return;

    btnCambiarClave.disabled = true;
    btnCambiarClave.textContent = 'Actualizando...';

    try {
      await api.llamar('POST', '/api/auth/clave', { actual, nueva });
      ui.aviso('Contraseña actualizada con éxito', 'exito');
      formClave.reset();
    } catch (err) {
      ui.aviso(err.message || 'Error al cambiar la contraseña', 'error');
    } finally {
      btnCambiarClave.disabled = false;
      btnCambiarClave.textContent = 'Actualizar Contraseña';
    }
  });

  // Montaje de la sección de logros para estudiantes (P05.3)
  await montarSeccionLogros(usuario);
}

/**
 * Renderiza los logros, vitrina de insignias y estado del certificado de cumplimiento
 * @param {Object} usr Datos del usuario autenticado
 */
async function montarSeccionLogros(usr) {
  const seccionLogros = document.getElementById('logros');
  if (!seccionLogros) return;

  // Solo estudiantes tienen sección de logros y certificados
  if (usr?.rol !== 'estudiante') {
    seccionLogros.innerHTML = '';
    seccionLogros.style.display = 'none';
    return;
  }

  seccionLogros.style.display = 'block';
  seccionLogros.innerHTML = `
    <div class="tarjeta pila" style="gap: var(--espacio-l);">
      <div class="fila" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
        <div>
          <h2>Logros y Recompensas</h2>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
            Tus puntos acumulados, vitrina de insignias y certificado de cumplimiento.
          </p>
        </div>
        <div class="logros-puntos-badge" aria-label="Puntos acumulados">
          <span class="logros-puntos-badge__icono" aria-hidden="true">⭐</span>
          <div>
            <span class="logros-puntos-badge__valor" id="perfilPuntosValor">0</span>
            <span class="logros-puntos-badge__etiqueta">pts</span>
          </div>
        </div>
      </div>

      <!-- Vitrina de insignias -->
      <section class="pila" style="gap: var(--espacio-s);">
        <h3>Vitrina de Insignias</h3>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
          Desbloquea insignias participando en actividades, superando quices y explorando contenidos.
        </p>
        <div class="insignias-vitrina-grid" id="insigniasVitrinaGrid">
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">Cargando insignias...</p>
        </div>
      </section>

      <!-- Certificado de cumplimiento -->
      <section class="pila" style="gap: var(--espacio-m);">
        <div>
          <h3>Certificado de Cumplimiento</h3>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
            Requisitos de avance para obtener el diploma oficial de la plataforma.
          </p>
        </div>

        <div class="pila" id="certificadoCondicionesLista" style="gap: var(--espacio-m);">
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">Evaluando requisitos...</p>
        </div>

        <div class="fila" style="justify-content: flex-end; margin-top: var(--espacio-s);">
          <button type="button" class="btn btn--primario" id="btnDescargarCertificado" disabled>
            Descargar certificado
          </button>
        </div>
      </section>
    </div>
  `;

  try {
    const [logros, catalogoInsignias, estadoCert] = await Promise.all([
      logrosDe('yo'),
      api.listar('insignias'),
      api.llamar('GET', '/api/certificados/estado')
    ]);

    // 1. Puntos totales (logrosDe())
    const elemPuntos = document.getElementById('perfilPuntosValor');
    if (elemPuntos) {
      elemPuntos.textContent = logros?.puntos || 0;
    }

    // 2. Vitrina de insignias obtenidas y bloqueadas
    const contenedorInsignias = document.getElementById('insigniasVitrinaGrid');
    if (contenedorInsignias) {
      const mapaObtenidas = new Map(
        (logros?.insignias || []).map((ins) => [ins.id, ins.fecha])
      );

      if (!Array.isArray(catalogoInsignias) || catalogoInsignias.length === 0) {
        contenedorInsignias.innerHTML = `<p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">No hay insignias registradas en el catálogo.</p>`;
      } else {
        contenedorInsignias.innerHTML = catalogoInsignias
          .map((ins) => {
            const obtenida = mapaObtenidas.has(ins.id);
            const fechaIso = mapaObtenidas.get(ins.id);
            const claseModificador = obtenida
              ? 'insignia-tarjeta--obtenida'
              : 'insignia-tarjeta--bloqueada';

            const subtituloHtml = obtenida
              ? `<p class="insignia-tarjeta__fecha">${ui.escapar(util.fechaLarga(fechaIso) || 'Obtenida')}</p>`
              : `<p class="insignia-tarjeta__condicion">${ui.escapar(ins.descripcion || 'Bloqueada')}</p>`;

            return `
              <article class="insignia-tarjeta ${claseModificador}" tabindex="0" title="${ui.escapar(ins.nombre)}: ${ui.escapar(ins.descripcion || '')}">
                <div class="insignia-tarjeta__icono" aria-hidden="true">${ui.escapar(ins.icono || '🏅')}</div>
                <div class="insignia-tarjeta__info">
                  <h4 class="insignia-tarjeta__nombre">${ui.escapar(ins.nombre)}</h4>
                  ${subtituloHtml}
                </div>
              </article>
            `;
          })
          .join('');
      }
    }

    // 3. Certificado de cumplimiento: una barra .progreso por condición
    const contenedorCondiciones = document.getElementById('certificadoCondicionesLista');
    const btnDescargar = document.getElementById('btnDescargarCertificado');

    if (contenedorCondiciones) {
      const condiciones = Array.isArray(estadoCert?.condiciones) ? estadoCert.condiciones : [];
      if (condiciones.length === 0) {
        contenedorCondiciones.innerHTML = `<p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">No hay condiciones configuradas para el certificado.</p>`;
      } else {
        contenedorCondiciones.innerHTML = condiciones
          .map((c) => {
            const req = Number(c.requerido) || 1;
            const act = Number(c.actual) || 0;
            const pct = Math.min(100, Math.max(0, Math.round((act / req) * 100)));
            const esPct = c.nombre.toLowerCase().includes('porcentaje') || c.nombre.includes('%');
            const textoValores = `${act}${esPct ? '%' : ''} / ${req}${esPct ? '%' : ''}`;

            return `
              <div class="certificado-condicion">
                <div class="certificado-condicion__cabecera">
                  <span class="certificado-condicion__nombre">
                    ${c.cumple ? '<span class="certificado-condicion__check" aria-hidden="true">✓ </span>' : ''}
                    ${ui.escapar(c.nombre)}
                  </span>
                  <span class="certificado-condicion__valores">
                    <strong>${ui.escapar(textoValores)}</strong>
                  </span>
                </div>
                <div class="progreso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${ui.escapar(c.nombre)}">
                  <span class="progreso__barra" style="width: ${pct}%;"></span>
                </div>
              </div>
            `;
          })
          .join('');
      }
    }

    if (btnDescargar) {
      const cumple = Boolean(estadoCert?.cumple);
      btnDescargar.disabled = !cumple;
      if (!cumple) {
        btnDescargar.title = 'Aún no cumples todos los requisitos para descargar el certificado';
      } else {
        btnDescargar.title = 'Descargar certificado oficial en formato PDF';
      }

      btnDescargar.addEventListener('click', async () => {
        try {
          btnDescargar.disabled = true;
          const textoOriginal = btnDescargar.textContent;
          btnDescargar.textContent = 'Generando certificado...';
          ui.aviso('Generando tu certificado de cumplimiento...', 'info');

          await generarDiploma({ tipo: 'cumplimiento' });
          ui.aviso('¡Certificado descargado con éxito!', 'exito');
          btnDescargar.textContent = textoOriginal;
          btnDescargar.disabled = false;
        } catch (err) {
          ui.aviso(err.message || 'No se pudo generar el diploma', 'error');
          btnDescargar.disabled = false;
          btnDescargar.textContent = 'Descargar certificado';
        }
      });
    }
  } catch (err) {
    ui.aviso('No se pudieron cargar los datos de logros y certificado', 'error');
  }
}
