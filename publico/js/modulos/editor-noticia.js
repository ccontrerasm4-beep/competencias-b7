import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: "Editor de Noticia", roles: ["docente", "admin"] });

const contenido = document.getElementById('contenido');
const noticiaId = util.parametro('id');

if (contenido) {
  contenido.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-2xl);">
      <div class="cargando" role="status" aria-label="Cargando editor"></div>
    </div>
  `;

  iniciarEditorNoticia();
}

async function iniciarEditorNoticia() {
  let noticia = null;
  let temas = [];

  try {
    const listaTemas = await api.listar('temas');
    temas = Array.isArray(listaTemas) ? listaTemas : [];

    if (noticiaId) {
      noticia = await api.obtener('noticias', noticiaId);
      if (!noticia) throw new Error('Noticia no encontrada');
    }
  } catch (err) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        ${ui.escapar(err.message || 'Error al cargar la noticia.')}
        <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Noticias
        </a>
      </div>
    `;
    return;
  }

  const esEdicion = Boolean(noticia);
  let urlImagenActual = noticia?.imagen || null;

  contenido.innerHTML = `
    <div class="editor-noticia-cabecera">
      <div>
        <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno" style="margin-bottom: var(--espacio-xs);">
          ← Volver a Noticias
        </a>
        <h1 style="margin: 0; font-size: var(--tamano-2xl);">
          ${esEdicion ? 'Editar Noticia' : 'Nueva Noticia'}
        </h1>
      </div>
      <div class="fila" style="gap: var(--espacio-s);">
        <button type="button" class="btn btn--secundario" id="btnVistaPrevia">
          👁️ Vista Previa
        </button>
        <button type="button" class="btn btn--primario" id="btnGuardarNoticia">
          💾 ${esEdicion ? 'Actualizar Noticia' : 'Publicar Noticia'}
        </button>
      </div>
    </div>

    <form id="formNoticia" class="pila tarjeta" novalidate style="max-width: 760px; margin: 0 auto;">
      <div class="campo">
        <label for="titulo">Título de la Noticia</label>
        <input type="text" id="titulo" value="${ui.escapar(noticia?.titulo || '')}" placeholder="Ej. Lanzamiento de la Misión Emprende" required>
        <span class="campo__error" id="errorTitulo"></span>
      </div>

      <div class="campo">
        <label for="resumen">Resumen breve (hasta 200 caracteres)</label>
        <textarea id="resumen" rows="2" maxlength="200" placeholder="Breve introducción para las tarjetas de noticias...">${ui.escapar(noticia?.resumen || '')}</textarea>
        <div class="contador-caracteres" id="contadorResumen">0 / 200 caracteres</div>
        <span class="campo__error" id="errorResumen"></span>
      </div>

      <div class="campo">
        <label for="cuerpo">Cuerpo de la Noticia</label>
        <textarea id="cuerpo" rows="8" placeholder="Contenido completo. Admite **negrita**, listas (- elemento) y párrafos separados por líneas en blanco.">${ui.escapar(noticia?.cuerpo || '')}</textarea>
        <span class="campo__error" id="errorCuerpo"></span>
      </div>

      <div class="campo">
        <label for="inputFotoArchivo">Imagen de Portada</label>
        <div class="fila" style="gap: var(--espacio-s); align-items: center;">
          <input type="file" id="inputFotoArchivo" accept="image/jpeg,image/png,image/webp">
          <button type="button" class="btn btn--secundario btn--pequeno" id="btnQuitarImagen" style="${urlImagenActual ? '' : 'display: none;'}">
            Quitar imagen
          </button>
        </div>
        <div id="contenedorPreviewImagen">
          ${
            urlImagenActual
              ? `<img src="${ui.escapar(urlImagenActual)}" alt="Portada de la noticia" class="imagen-noticia-preview" id="imgPreview">`
              : ''
          }
        </div>
      </div>

      <div class="fila" style="gap: var(--espacio-m); flex-wrap: wrap;">
        <div class="campo" style="flex: 1; min-width: 200px;">
          <label for="categoria">Categoría</label>
          <select id="categoria">
            <option value="Institucional" ${noticia?.categoria === 'Institucional' ? 'selected' : ''}>Institucional</option>
            <option value="Académica" ${noticia?.categoria === 'Académica' ? 'selected' : ''}>Académica</option>
            <option value="Eventos" ${noticia?.categoria === 'Eventos' ? 'selected' : ''}>Eventos</option>
            <option value="Logros" ${noticia?.categoria === 'Logros' ? 'selected' : ''}>Logros</option>
          </select>
        </div>

        <div class="campo" style="flex: 1; min-width: 200px;">
          <label for="temaId">Tema relacionado (opcional)</label>
          <select id="temaId">
            <option value="">Ninguno</option>
            ${
              temas.map((t) => `
                <option value="${t.id}" ${noticia?.temaId === t.id ? 'selected' : ''}>
                  ${ui.escapar(t.titulo)}
                </option>
              `).join('')
            }
          </select>
        </div>

        <div class="campo" style="flex: 1; min-width: 140px;">
          <label for="estado">Estado</label>
          <select id="estado">
            <option value="publicado" ${noticia?.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
            <option value="borrador" ${noticia?.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
          </select>
        </div>
      </div>

      <div class="campo" style="flex-direction: row; align-items: center; gap: var(--espacio-s); margin-top: var(--espacio-s);">
        <input type="checkbox" id="destacada" ${noticia?.destacada ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--color-primario);">
        <label for="destacada" style="cursor: pointer; margin: 0;">Marcar como Noticia Destacada (aparecerá al inicio)</label>
      </div>
    </form>
  `;

  // Controles
  const inputTitulo = document.getElementById('titulo');
  const inputResumen = document.getElementById('resumen');
  const contadorResumen = document.getElementById('contadorResumen');
  const inputCuerpo = document.getElementById('cuerpo');
  const inputFotoArchivo = document.getElementById('inputFotoArchivo');
  const btnQuitarImagen = document.getElementById('btnQuitarImagen');
  const contenedorPreviewImagen = document.getElementById('contenedorPreviewImagen');
  const selectCategoria = document.getElementById('categoria');
  const selectTemaId = document.getElementById('temaId');
  const selectEstado = document.getElementById('estado');
  const checkDestacada = document.getElementById('destacada');

  const errorTitulo = document.getElementById('errorTitulo');
  const errorResumen = document.getElementById('errorResumen');
  const errorCuerpo = document.getElementById('errorCuerpo');

  function actualizarContadorResumen() {
    const longitud = inputResumen.value.length;
    contadorResumen.textContent = `${longitud} / 200 caracteres`;
    if (longitud >= 190) {
      contadorResumen.className = 'contador-caracteres contador-caracteres--alerta';
    } else {
      contadorResumen.className = 'contador-caracteres';
    }
  }

  inputResumen.addEventListener('input', actualizarContadorResumen);
  actualizarContadorResumen();

  // Subida de imagen
  inputFotoArchivo.addEventListener('change', async () => {
    const file = inputFotoArchivo.files && inputFotoArchivo.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      ui.aviso('La imagen excede el límite de 2 MB', 'advertencia');
      inputFotoArchivo.value = '';
      return;
    }

    try {
      ui.aviso('Subiendo imagen de portada...', 'info');
      const res = await api.subir(file);
      urlImagenActual = res.url;
      contenedorPreviewImagen.innerHTML = `<img src="${ui.escapar(urlImagenActual)}" alt="Portada de la noticia" class="imagen-noticia-preview">`;
      btnQuitarImagen.style.display = 'inline-block';
      ui.aviso('Imagen subida correctamente', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al subir imagen', 'error');
    }
  });

  btnQuitarImagen.addEventListener('click', () => {
    urlImagenActual = null;
    inputFotoArchivo.value = '';
    contenedorPreviewImagen.innerHTML = '';
    btnQuitarImagen.style.display = 'none';
  });

  // Vista Previa Modal
  document.getElementById('btnVistaPrevia').addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim() || 'Título de ejemplo';
    const resumen = inputResumen.value.trim() || 'Resumen de ejemplo de la noticia.';
    const cuerpo = inputCuerpo.value.trim() || 'Cuerpo de la noticia.';
    const categoria = selectCategoria.value;
    const esDestacada = checkDestacada.checked;

    const divModal = document.createElement('div');
    divModal.className = 'vista-previa-noticia-modal';

    divModal.innerHTML = `
      ${urlImagenActual ? `<img src="${ui.escapar(urlImagenActual)}" alt="Portada">` : ''}
      <div class="fila" style="gap: var(--espacio-s); align-items: center;">
        <span class="insignia insignia--primario">${ui.escapar(categoria)}</span>
        ${esDestacada ? `<span class="insignia insignia--acento">★ Destacada</span>` : ''}
      </div>
      <h2 style="margin: 0; color: var(--color-primario);">${ui.escapar(titulo)}</h2>
      <p style="font-style: italic; color: var(--color-texto-suave); margin: 0;">${ui.escapar(resumen)}</p>
      <hr style="border: 0; border-top: 1px solid var(--color-borde); width: 100%;">
      <div style="line-height: var(--interlineado-base); color: var(--color-texto);">
        ${ui.limpiar(util.formatoBasico(cuerpo))}
      </div>
    `;

    await ui.modal({
      titulo: 'Vista Previa de la Noticia',
      contenido: divModal,
      acciones: [{ texto: 'Cerrar', valor: null, clase: 'btn--secundario' }]
    });
  });

  // Guardar Noticia
  document.getElementById('btnGuardarNoticia').addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim();
    const resumen = inputResumen.value.trim();
    const cuerpo = inputCuerpo.value.trim();
    const categoria = selectCategoria.value;
    const temaSeleccionado = selectTemaId.value || null;
    const estado = selectEstado.value;
    const destacada = checkDestacada.checked;

    let valido = true;

    if (!titulo) {
      errorTitulo.textContent = 'El título de la noticia es obligatorio.';
      valido = false;
    } else {
      errorTitulo.textContent = '';
    }

    if (!resumen) {
      errorResumen.textContent = 'El resumen es obligatorio.';
      valido = false;
    } else if (resumen.length > 200) {
      errorResumen.textContent = 'El resumen no puede exceder los 200 caracteres.';
      valido = false;
    } else {
      errorResumen.textContent = '';
    }

    if (!cuerpo) {
      errorCuerpo.textContent = 'El cuerpo de la noticia es obligatorio.';
      valido = false;
    } else {
      errorCuerpo.textContent = '';
    }

    if (!valido) return;

    const datosNoticia = {
      titulo,
      resumen,
      cuerpo,
      imagen: urlImagenActual,
      categoria,
      temaId: temaSeleccionado,
      destacada,
      estado
    };

    try {
      ui.aviso('Guardando noticia...', 'info');

      if (esEdicion) {
        await api.actualizar('noticias', noticia.id, datosNoticia);
        ui.aviso('Noticia actualizada con éxito', 'exito');
      } else {
        await api.crear('noticias', datosNoticia);
        ui.aviso('Noticia creada con éxito', 'exito');
      }

      setTimeout(() => {
        window.location.href = '/paginas/noticias.html';
      }, 500);
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar noticia', 'error');
    }
  });
}

