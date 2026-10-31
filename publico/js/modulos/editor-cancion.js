import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: "Editor de Canción Educativa", roles: ["docente", "admin"] });

const contenido = document.getElementById('contenido');
const cancionId = util.parametro('id');

if (contenido) {
  contenido.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-2xl);">
      <div class="cargando" role="status" aria-label="Cargando editor"></div>
    </div>
  `;

  iniciarEditorCancion();
}

async function iniciarEditorCancion() {
  let cancion = null;
  let temas = [];

  try {
    const listaTemas = await api.listar('temas');
    temas = Array.isArray(listaTemas) ? listaTemas : [];

    if (cancionId) {
      cancion = await api.obtener('canciones', cancionId);
      if (!cancion) throw new Error('Canción no encontrada');
    }
  } catch (err) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        ${ui.escapar(err.message || 'Error al cargar los datos.')}
        <a href="/paginas/canciones.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Canciones
        </a>
      </div>
    `;
    return;
  }

  const esEdicion = Boolean(cancion);
  let urlAudioActual = cancion?.audio || null;

  // Analizar licencia existente
  let licenciaTipo = 'Propia';
  let licenciaDesc = '';
  if (cancion?.licencia) {
    if (['Propia', 'CC BY', 'CC BY-SA'].includes(cancion.licencia)) {
      licenciaTipo = cancion.licencia;
    } else if (cancion.licencia.startsWith('Otra:')) {
      licenciaTipo = 'Otra';
      licenciaDesc = cancion.licencia.replace('Otra:', '').trim();
    } else {
      licenciaTipo = 'Otra';
      licenciaDesc = cancion.licencia;
    }
  }

  contenido.innerHTML = `
    <div class="editor-cancion-cabecera">
      <div>
        <a href="/paginas/canciones.html" class="btn btn--secundario btn--pequeno" style="margin-bottom: var(--espacio-xs);">
          ← Volver a Canciones
        </a>
        <h1 style="margin: 0; font-size: var(--tamano-2xl);">
          ${esEdicion ? 'Editar Canción' : 'Nueva Canción Educativa'}
        </h1>
      </div>
      <button type="button" class="btn btn--primario" id="btnGuardarCancion">
        💾 ${esEdicion ? 'Actualizar Canción' : 'Guardar Canción'}
      </button>
    </div>

    <form id="formCancion" class="pila tarjeta" novalidate style="max-width: 760px; margin: 0 auto;">
      <div class="campo">
        <label for="titulo">Título de la Canción</label>
        <input type="text" id="titulo" value="${ui.escapar(cancion?.titulo || '')}" placeholder="Ej. El Ritmo de los Costos y Gastos" required>
        <span class="campo__error" id="errorTitulo"></span>
      </div>

      <div class="campo">
        <label for="temaId">Tema Curricular</label>
        <select id="temaId" required>
          <option value="">Selecciona un tema...</option>
          ${
            temas.map((t) => `
              <option value="${t.id}" ${cancion?.temaId === t.id ? 'selected' : ''}>
                ${ui.escapar(t.titulo)}
              </option>
            `).join('')
          }
        </select>
        <span class="campo__error" id="errorTema"></span>
      </div>

      <div class="campo">
        <label for="inputAudioArchivo">Archivo de Audio MP3</label>
        <div class="fila" style="gap: var(--espacio-s); align-items: center;">
          <input type="file" id="inputAudioArchivo" accept="audio/mp3,audio/mpeg,audio/*">
          <input type="url" id="audioUrlManual" value="${ui.escapar(urlAudioActual || '')}" placeholder="O ingresa la URL del audio..." style="flex: 1;">
        </div>
        <span class="campo__error" id="errorAudio"></span>

        <div id="contenedorPreviewAudio" class="audio-preview-bloque" style="${urlAudioActual ? '' : 'display: none;'}">
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Preescucha del audio:</span>
          <audio controls id="audioElemento" src="${ui.escapar(urlAudioActual || '')}"></audio>
        </div>
      </div>

      <div class="campo">
        <label for="letra">Letra de la Canción</label>
        <textarea id="letra" rows="8" placeholder="Escribe o pega aquí la letra completa de la canción...">${ui.escapar(cancion?.letra || '')}</textarea>
        <span class="campo__error" id="errorLetra"></span>
      </div>

      <div class="campo">
        <label for="lrc">Letra Sincronizada LRC (Opcional)</label>
        <textarea id="lrc" rows="6" placeholder="Formato estándar [mm:ss.xx] Texto de la estrofa&#10;Ejemplo:&#10;[00:04.20] Bienvenidos al Guabo a emprender&#10;[00:08.50] Si vendes bolos tienes que aprender">${ui.escapar(cancion?.lrc || '')}</textarea>
        <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
          Permite resaltar automáticamente la línea que suena en el reproductor.
        </span>
      </div>

      <div class="fila" style="gap: var(--espacio-m); flex-wrap: wrap;">
        <div class="campo" style="flex: 1; min-width: 240px;">
          <label for="autoria">Autoría (Obligatoria)</label>
          <input type="text" id="autoria" value="${ui.escapar(cancion?.autoria || '')}" placeholder="Nombre del autor o compositor..." required>
          <span class="campo__error" id="errorAutoria"></span>
        </div>

        <div class="campo" style="flex: 1; min-width: 200px;">
          <label for="licenciaTipo">Licencia (Obligatoria)</label>
          <select id="licenciaTipo" required>
            <option value="Propia" ${licenciaTipo === 'Propia' ? 'selected' : ''}>Propia</option>
            <option value="CC BY" ${licenciaTipo === 'CC BY' ? 'selected' : ''}>CC BY (Reconocimiento)</option>
            <option value="CC BY-SA" ${licenciaTipo === 'CC BY-SA' ? 'selected' : ''}>CC BY-SA (Compartir igual)</option>
            <option value="Otra" ${licenciaTipo === 'Otra' ? 'selected' : ''}>Otra (especificar)</option>
          </select>
        </div>
      </div>

      <div class="campo" id="campoOtraLicencia" style="${licenciaTipo === 'Otra' ? '' : 'display: none;'}">
        <label for="licenciaDescripcion">Descripción de la Licencia</label>
        <input type="text" id="licenciaDescripcion" value="${ui.escapar(licenciaDesc)}" placeholder="Indica los términos o atribución de la licencia...">
        <span class="campo__error" id="errorLicenciaDesc"></span>
      </div>
    </form>
  `;

  const inputTitulo = document.getElementById('titulo');
  const selectTema = document.getElementById('temaId');
  const inputAudioArchivo = document.getElementById('inputAudioArchivo');
  const inputAudioUrlManual = document.getElementById('audioUrlManual');
  const contenedorPreviewAudio = document.getElementById('contenedorPreviewAudio');
  const audioElemento = document.getElementById('audioElemento');
  const inputLetra = document.getElementById('letra');
  const inputLrc = document.getElementById('lrc');
  const inputAutoria = document.getElementById('autoria');
  const selectLicenciaTipo = document.getElementById('licenciaTipo');
  const campoOtraLicencia = document.getElementById('campoOtraLicencia');
  const inputLicenciaDesc = document.getElementById('licenciaDescripcion');

  const errorTitulo = document.getElementById('errorTitulo');
  const errorTema = document.getElementById('errorTema');
  const errorAudio = document.getElementById('errorAudio');
  const errorAutoria = document.getElementById('errorAutoria');
  const errorLicenciaDesc = document.getElementById('errorLicenciaDesc');

  selectLicenciaTipo.addEventListener('change', () => {
    campoOtraLicencia.style.display = selectLicenciaTipo.value === 'Otra' ? 'block' : 'none';
  });

  inputAudioUrlManual.addEventListener('input', () => {
    const val = inputAudioUrlManual.value.trim();
    if (val) {
      urlAudioActual = val;
      audioElemento.src = val;
      contenedorPreviewAudio.style.display = 'block';
    } else {
      urlAudioActual = null;
      contenedorPreviewAudio.style.display = 'none';
    }
  });

  inputAudioArchivo.addEventListener('change', async () => {
    const file = inputAudioArchivo.files && inputAudioArchivo.files[0];
    if (!file) return;

    try {
      ui.aviso('Subiendo archivo MP3...', 'info');
      const res = await api.subir(file);
      urlAudioActual = res.url;
      inputAudioUrlManual.value = res.url;
      audioElemento.src = res.url;
      contenedorPreviewAudio.style.display = 'block';
      ui.aviso('Audio subido con éxito', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al subir audio', 'error');
    }
  });

  document.getElementById('btnGuardarCancion').addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim();
    const temaIdSeleccionado = selectTema.value;
    const audio = urlAudioActual || inputAudioUrlManual.value.trim();
    const letra = inputLetra.value.trim();
    const lrc = inputLrc.value.trim();
    const autoria = inputAutoria.value.trim();
    const licTipo = selectLicenciaTipo.value;
    const licDesc = inputLicenciaDesc.value.trim();

    let valido = true;

    if (!titulo) {
      errorTitulo.textContent = 'El título de la canción es obligatorio.';
      valido = false;
    } else {
      errorTitulo.textContent = '';
    }

    if (!temaIdSeleccionado) {
      errorTema.textContent = 'Debes seleccionar un tema curricular.';
      valido = false;
    } else {
      errorTema.textContent = '';
    }

    if (!audio) {
      errorAudio.textContent = 'El archivo de audio MP3 es obligatorio.';
      valido = false;
    } else {
      errorAudio.textContent = '';
    }

    if (!autoria) {
      errorAutoria.textContent = 'La autoría es obligatoria.';
      valido = false;
    } else {
      errorAutoria.textContent = '';
    }

    let licenciaFinal = licTipo;
    if (licTipo === 'Otra') {
      if (!licDesc) {
        errorLicenciaDesc.textContent = 'Describe la licencia utilizada.';
        valido = false;
      } else {
        errorLicenciaDesc.textContent = '';
        licenciaFinal = `Otra: ${licDesc}`;
      }
    }

    if (!valido) return;

    const datosCancion = {
      titulo,
      temaId: temaIdSeleccionado,
      audio,
      letra,
      lrc,
      autoria,
      licencia: licenciaFinal
    };

    try {
      ui.aviso('Guardando canción...', 'info');

      if (esEdicion) {
        await api.actualizar('canciones', cancion.id, datosCancion);
        ui.aviso('Canción actualizada con éxito', 'exito');
      } else {
        await api.crear('canciones', datosCancion);
        ui.aviso('Canción creada con éxito', 'exito');
      }

      setTimeout(() => {
        window.location.href = '/paginas/canciones.html';
      }, 500);
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar la canción', 'error');
    }
  });
}

