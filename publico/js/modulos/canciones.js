import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Canciones Educativas", roles: ["sesion"] });

const contenido = document.getElementById('contenido');
const temaIdParam = util.parametro('temaId');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

function formatearTiempo(segundos) {
  if (!segundos || isNaN(segundos) || segundos < 0) return '00:00';
  const min = Math.floor(segundos / 60);
  const seg = Math.floor(segundos % 60);
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== 'string') return [];
  const lineas = lrcTexto.split('\n');
  const resultado = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;

  for (const linea of lineas) {
    const match = linea.match(regex);
    if (match) {
      const minutos = parseInt(match[1], 10);
      const segundos = parseInt(match[2], 10);
      const fracStr = match[3] || '0';
      const fraccion = parseFloat(`0.${fracStr}`);
      const tiempoSegundos = minutos * 60 + segundos + fraccion;
      const texto = match[4].trim();
      if (texto) {
        resultado.push({ tiempo: tiempoSegundos, texto });
      }
    }
  }

  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

if (contenido) {
  contenido.innerHTML = `
    <div class="canciones-cabecera">
      <div>
        <h1>Canciones Educativas</h1>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
          Aprende y refuerza conceptos clave mediante música y letras sincronizadas.
        </p>
      </div>
      ${
        esDocenteOAdmin
          ? `
            <a href="/paginas/editor-cancion.html" class="btn btn--primario">
              + Nueva Canción
            </a>
          `
          : ''
      }
    </div>

    <!-- Filtros por Asignatura y Tema -->
    <div class="canciones-filtros">
      <div class="campo" style="max-width: 280px;">
        <label for="filtroAsignatura">Asignatura</label>
        <select id="filtroAsignatura">
          <option value="todas">Todas las asignaturas</option>
        </select>
      </div>

      <div class="campo" style="max-width: 320px;">
        <label for="filtroTema">Tema Curricular</label>
        <select id="filtroTema">
          <option value="todos">Todos los temas</option>
        </select>
      </div>
    </div>

    <div class="canciones-contenedor-principal" id="zonaPrincipal">
      <!-- Lista lateral de canciones -->
      <section class="tarjeta" style="padding: var(--espacio-m);" aria-labelledby="tituloListaCanciones">
        <h2 id="tituloListaCanciones" style="font-size: var(--tamano-m); margin-bottom: var(--espacio-s); color: var(--color-primario);">
          Lista de Canciones
        </h2>
        <div class="canciones-lista" id="listaCanciones">
          <div style="text-align: center; padding: var(--espacio-l);">
            <div class="cargando" role="status" aria-label="Cargando canciones"></div>
          </div>
        </div>
      </section>

      <!-- Reproductor y Panel de Letra -->
      <section class="reproductor-seccion" id="seccionReproductor">
        <!-- Tarjeta del Reproductor Propio -->
        <article class="reproductor-card" id="reproductorCard">
          <audio id="audioElemento" preload="metadata" style="display: none;"></audio>

          <div class="reproductor-info">
            <div>
              <span id="repTemaTag" class="insignia insignia--primario" style="margin-bottom: var(--espacio-xs); display: inline-block;">
                Tema
              </span>
              <h2 id="repTitulo" style="margin: 0; font-size: var(--tamano-xl); color: var(--color-primario);">
                Selecciona una canción
              </h2>
              <span id="repAutoria" style="font-size: var(--tamano-s); color: var(--color-texto-suave);">
                Autoría no seleccionada
              </span>
            </div>
            <div class="fila" style="gap: var(--espacio-xs); align-items: center;">
              <span id="repLicencia" class="chip" style="font-size: var(--tamano-xs);">Licencia</span>
              ${
                esDocenteOAdmin
                  ? `<a href="#" id="btnEditarCancion" class="btn btn--secundario btn--pequeno" style="display: none;">Editar</a>`
                  : ''
              }
            </div>
          </div>

          <!-- Barra de Progreso Operable con Teclado -->
          <div class="reproductor-progreso-bloque">
            <input type="range" id="barraProgreso" class="reproductor-slider" min="0" max="100" step="0.1" value="0" aria-label="Progreso de reproducción">
            <div class="reproductor-tiempos">
              <span id="tiempoActual">00:00</span>
              <span id="tiempoTotal">00:00</span>
            </div>
          </div>

          <!-- Controles de Reproducción y Volumen -->
          <div class="reproductor-controles-fila">
            <button type="button" class="reproductor-btn-play" id="btnPlayPausa" aria-label="Reproducir" title="Reproducir (Espacio)">
              ▶
            </button>

            <div class="reproductor-volumen-bloque">
              <button type="button" id="btnMute" class="btn btn--texto btn--pequeno" aria-label="Silenciar">
                🔊
              </button>
              <input type="range" id="sliderVolumen" class="reproductor-volumen-slider" min="0" max="1" step="0.05" value="1" aria-label="Volumen">
            </div>
          </div>
        </article>

        <!-- Panel de Letra / LRC Sincronizado -->
        <article class="panel-letra" aria-labelledby="tituloLetra">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <h2 id="tituloLetra" style="margin: 0; font-size: var(--tamano-l); color: var(--color-primario);">
              Letra de la Canción
            </h2>
            <span id="indicadorSincronizado" class="insignia insignia--exito" style="display: none;">
              Sincronizada (LRC)
            </span>
          </div>

          <div class="letra-contenedor-scroll" id="contenedorLetra">
            <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); text-align: center; margin: var(--espacio-l) 0;">
              Elige una canción de la lista para ver su letra aquí.
            </p>
          </div>
        </article>
      </section>
    </div>
  `;

  iniciarCanciones();
}

async function iniciarCanciones() {
  const selectAsig = document.getElementById('filtroAsignatura');
  const selectTema = document.getElementById('filtroTema');
  const listaCancionesEl = document.getElementById('listaCanciones');

  const audio = document.getElementById('audioElemento');
  const repTitulo = document.getElementById('repTitulo');
  const repAutoria = document.getElementById('repAutoria');
  const repTemaTag = document.getElementById('repTemaTag');
  const repLicencia = document.getElementById('repLicencia');
  const btnEditarCancion = document.getElementById('btnEditarCancion');

  const barraProgreso = document.getElementById('barraProgreso');
  const tiempoActualEl = document.getElementById('tiempoActual');
  const tiempoTotalEl = document.getElementById('tiempoTotal');
  const btnPlayPausa = document.getElementById('btnPlayPausa');
  const btnMute = document.getElementById('btnMute');
  const sliderVolumen = document.getElementById('sliderVolumen');

  const contenedorLetra = document.getElementById('contenedorLetra');
  const indicadorSincronizado = document.getElementById('indicadorSincronizado');

  let todasCanciones = [];
  let asignaturas = [];
  let unidades = [];
  let temas = [];

  let cancionActual = null;
  let lineasLRC = [];
  let indiceLRCActivo = -1;
  let usuarioArrastrandoProgreso = false;

  try {
    const [listaC, listaA, listaU, listaT] = await Promise.all([
      api.listar('canciones'),
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);

    todasCanciones = Array.isArray(listaC) ? listaC : [];
    asignaturas = Array.isArray(listaA) ? listaA : [];
    unidades = Array.isArray(listaU) ? listaU : [];
    temas = Array.isArray(listaT) ? listaT : [];

    // Llenar selectores
    asignaturas.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.nombre;
      selectAsig.appendChild(opt);
    });

    poblarTemas();

    // Si viene temaId en la URL, seleccionarlo automáticamente
    if (temaIdParam) {
      const t = temas.find((tema) => tema.id === temaIdParam);
      if (t) {
        const u = unidades.find((uni) => uni.id === t.unidadId);
        if (u) {
          selectAsig.value = u.asignaturaId;
          poblarTemas();
        }
        selectTema.value = t.id;
      }
    }

    selectAsig.addEventListener('change', () => {
      poblarTemas();
      renderizarListaCanciones();
    });

    selectTema.addEventListener('change', () => {
      renderizarListaCanciones();
    });

    // Control del Reproductor
    btnPlayPausa.addEventListener('click', togglePlayPausa);

    audio.addEventListener('loadedmetadata', () => {
      tiempoTotalEl.textContent = formatearTiempo(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      if (!usuarioArrastrandoProgreso && audio.duration) {
        const porcentaje = (audio.currentTime / audio.duration) * 100;
        barraProgreso.value = porcentaje;
        tiempoActualEl.textContent = formatearTiempo(audio.currentTime);
      }
      actualizarLRC(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      btnPlayPausa.textContent = '▶';
      btnPlayPausa.setAttribute('aria-label', 'Reproducir');
      barraProgreso.value = 0;
      tiempoActualEl.textContent = '00:00';
    });

    barraProgreso.addEventListener('input', () => {
      usuarioArrastrandoProgreso = true;
      if (audio.duration) {
        const t = (barraProgreso.value / 100) * audio.duration;
        tiempoActualEl.textContent = formatearTiempo(t);
      }
    });

    barraProgreso.addEventListener('change', () => {
      if (audio.duration) {
        audio.currentTime = (barraProgreso.value / 100) * audio.duration;
      }
      usuarioArrastrandoProgreso = false;
    });

    sliderVolumen.addEventListener('input', () => {
      audio.volume = parseFloat(sliderVolumen.value);
      audio.muted = false;
      btnMute.textContent = audio.volume === 0 ? '🔇' : '🔊';
    });

    btnMute.addEventListener('click', () => {
      audio.muted = !audio.muted;
      btnMute.textContent = audio.muted ? '🔇' : '🔊';
    });

    renderizarListaCanciones();

    // Autocargar primera canción si hay
    if (todasCanciones.length > 0) {
      const inicial = temaIdParam
        ? todasCanciones.find((c) => c.temaId === temaIdParam) || todasCanciones[0]
        : todasCanciones[0];
      cargarCancion(inicial, false);
    }
  } catch (err) {
    listaCancionesEl.innerHTML = `
      <div class="alerta alerta--error">
        ${ui.escapar(err.message || 'Error al cargar canciones')}
      </div>
    `;
  }

  function poblarTemas() {
    const asigId = selectAsig.value;
    selectTema.innerHTML = '<option value="todos">Todos los temas</option>';

    let temasFiltrados = temas;
    if (asigId !== 'todas') {
      const idsUnidadesAsig = new Set(unidades.filter((u) => u.asignaturaId === asigId).map((u) => u.id));
      temasFiltrados = temas.filter((t) => idsUnidadesAsig.has(t.unidadId));
    }

    temasFiltrados.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selectTema.appendChild(opt);
    });
  }

  function renderizarListaCanciones() {
    const asigId = selectAsig.value;
    const temaId = selectTema.value;

    const filtradas = todasCanciones.filter((c) => {
      if (temaId !== 'todos' && c.temaId !== temaId) return false;
      if (asigId !== 'todas') {
        const t = temas.find((tema) => tema.id === c.temaId);
        if (!t) return false;
        const u = unidades.find((uni) => uni.id === t.unidadId);
        if (!u || u.asignaturaId !== asigId) return false;
      }
      return true;
    });

    if (filtradas.length === 0) {
      listaCancionesEl.innerHTML = `
        <div style="padding: var(--espacio-m); text-align: center; color: var(--color-texto-suave); font-size: var(--tamano-s);">
          No hay canciones para el tema seleccionado.
        </div>
      `;
      return;
    }

    listaCancionesEl.innerHTML = '';
    filtradas.forEach((c) => {
      const item = document.createElement('div');
      const esActiva = cancionActual && cancionActual.id === c.id;
      item.className = `cancion-item${esActiva ? ' cancion-item--activa' : ''}`;

      const tObj = temas.find((t) => t.id === c.temaId);

      item.innerHTML = `
        <h3 class="cancion-item__titulo">${ui.escapar(c.titulo)}</h3>
        <div class="cancion-item__sub">
          <span>${ui.escapar(tObj ? tObj.titulo : 'Tema')}</span>
          <span class="chip" style="font-size: 10px;">${c.lrc ? 'LRC' : 'Audio'}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        cargarCancion(c, true);
      });

      listaCancionesEl.appendChild(item);
    });
  }

  function cargarCancion(c, autoPlay = true) {
    cancionActual = c;
    audio.src = c.audio;
    audio.currentTime = 0;
    barraProgreso.value = 0;
    tiempoActualEl.textContent = '00:00';
    indiceLRCActivo = -1;

    repTitulo.textContent = c.titulo;
    repAutoria.textContent = `Por ${c.autoria || 'Docente'}`;
    repLicencia.textContent = c.licencia || 'Licencia estándar';

    const tObj = temas.find((t) => t.id === c.temaId);
    repTemaTag.textContent = tObj ? tObj.titulo : 'Tema curricular';

    if (btnEditarCancion) {
      btnEditarCancion.href = `/paginas/editor-cancion.html?id=${encodeURIComponent(c.id)}`;
      btnEditarCancion.style.display = 'inline-block';
    }

    // Renderizar letra
    if (c.lrc && c.lrc.trim()) {
      lineasLRC = parsearLRC(c.lrc);
      indicadorSincronizado.style.display = 'inline-flex';

      if (lineasLRC.length > 0) {
        contenedorLetra.innerHTML = lineasLRC.map((l, idx) => `
          <div class="linea-lrc" data-idx="${idx}" data-tiempo="${l.tiempo}">
            ${ui.escapar(l.texto)}
          </div>
        `).join('');

        // Clic en la línea adelanta el audio a ese tiempo
        contenedorLetra.querySelectorAll('.linea-lrc').forEach((elem) => {
          elem.addEventListener('click', () => {
            const t = parseFloat(elem.getAttribute('data-tiempo') || '0');
            audio.currentTime = t;
            if (audio.paused) audio.play();
            btnPlayPausa.textContent = '⏸';
          });
        });
      } else {
        contenedorLetra.innerHTML = `<div class="letra-plana">${ui.escapar(c.letra || c.lrc)}</div>`;
      }
    } else if (c.letra && c.letra.trim()) {
      lineasLRC = [];
      indicadorSincronizado.style.display = 'none';
      contenedorLetra.innerHTML = `<div class="letra-plana">${ui.escapar(c.letra)}</div>`;
    } else {
      lineasLRC = [];
      indicadorSincronizado.style.display = 'none';
      contenedorLetra.innerHTML = `<p style="color: var(--color-texto-suave); font-size: var(--tamano-s); text-align: center;">Esta canción no tiene letra registrada.</p>`;
    }

    // Resaltar en la lista
    const items = listaCancionesEl.querySelectorAll('.cancion-item');
    items.forEach((elem, idx) => {
      const cItem = todasCanciones[idx];
      if (cItem && cItem.id === c.id) {
        elem.classList.add('cancion-item--activa');
      } else {
        elem.classList.remove('cancion-item--activa');
      }
    });

    if (autoPlay) {
      audio.play().then(() => {
        btnPlayPausa.textContent = '⏸';
        btnPlayPausa.setAttribute('aria-label', 'Pausar');
      }).catch(() => {
        btnPlayPausa.textContent = '▶';
        btnPlayPausa.setAttribute('aria-label', 'Reproducir');
      });
    } else {
      btnPlayPausa.textContent = '▶';
      btnPlayPausa.setAttribute('aria-label', 'Reproducir');
    }
  }

  function togglePlayPausa() {
    if (!cancionActual) return;
    if (audio.paused) {
      audio.play().then(() => {
        btnPlayPausa.textContent = '⏸';
        btnPlayPausa.setAttribute('aria-label', 'Pausar');
      }).catch(() => {});
    } else {
      audio.pause();
      btnPlayPausa.textContent = '▶';
      btnPlayPausa.setAttribute('aria-label', 'Reproducir');
    }
  }

  function actualizarLRC(tiempoSegundos) {
    if (!lineasLRC || lineasLRC.length === 0) return;

    let nuevoIndice = -1;
    for (let i = 0; i < lineasLRC.length; i++) {
      if (tiempoSegundos >= lineasLRC[i].tiempo) {
        nuevoIndice = i;
      } else {
        break;
      }
    }

    if (nuevoIndice !== indiceLRCActivo) {
      indiceLRCActivo = nuevoIndice;
      const domLineas = contenedorLetra.querySelectorAll('.linea-lrc');
      domLineas.forEach((elem, idx) => {
        if (idx === nuevoIndice) {
          elem.classList.add('linea-lrc--activa');
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          elem.classList.remove('linea-lrc--activa');
        }
      });
    }
  }
}

