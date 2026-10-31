import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

/**
 * Función pura que genera la grilla de la sopa de letras y ubica las palabras.
 * @param {string[]} palabras Lista de palabras a colocar
 * @param {number} tamano Tamaño N de la cuadrícula (N x N)
 * @param {Array<[number, number]>} direcciones Direcciones permitidas [df, dc]
 * @returns {{ grilla: string[][], ubicaciones: Array<Object> }}
 */
export function generarSopa(palabras = [], tamano = 10, direcciones = [[0, 1], [1, 0]]) {
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(''));
  const ubicaciones = [];

  // Ordenar palabras de la más larga a la más corta
  const palabrasOrdenadas = [...palabras].sort((a, b) => b.length - a.length);
  const ALFABETO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

  for (const palabra of palabrasOrdenadas) {
    const len = palabra.length;
    if (len > tamano || len < 1) continue;

    let colocada = false;
    let intentos = 0;

    while (!colocada && intentos < 200) {
      intentos++;

      // Elegir dirección al azar de las permitidas
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const [df, dc] = Array.isArray(dir) ? dir : [dir.df, dir.dc];

      // Determinar límites de inicio válidos
      const minFila = df < 0 ? len - 1 : 0;
      const maxFila = df > 0 ? tamano - len : tamano - 1;
      const minCol = dc < 0 ? len - 1 : 0;
      const maxCol = dc > 0 ? tamano - len : tamano - 1;

      if (minFila > maxFila || minCol > maxCol) continue;

      const fInicio = Math.floor(Math.random() * (maxFila - minFila + 1)) + minFila;
      const cInicio = Math.floor(Math.random() * (maxCol - minCol + 1)) + minCol;

      // Verificar si cabe y cruces permitidos con letras iguales
      let sePuede = true;
      for (let k = 0; k < len; k++) {
        const f = fInicio + k * df;
        const c = cInicio + k * dc;
        const celdaActual = grilla[f][c];
        if (celdaActual !== '' && celdaActual !== palabra[k]) {
          sePuede = false;
          break;
        }
      }

      if (sePuede) {
        const celdas = [];
        for (let k = 0; k < len; k++) {
          const f = fInicio + k * df;
          const c = cInicio + k * dc;
          grilla[f][c] = palabra[k];
          celdas.push({ f, c });
        }

        ubicaciones.push({
          palabra,
          fInicio,
          cInicio,
          fFin: fInicio + (len - 1) * df,
          cFin: cInicio + (len - 1) * dc,
          df,
          dc,
          celdas
        });

        colocada = true;
      }
    }
  }

  // Rellenar celdas vacías con letras aleatorias de la A a la Z y Ñ
  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) {
      if (grilla[f][c] === '') {
        const rIndex = Math.floor(Math.random() * ALFABETO.length);
        grilla[f][c] = ALFABETO[rIndex];
      }
    }
  }

  return { grilla, ubicaciones };
}

// Configuración de niveles de dificultad
const NIVELES = {
  facil: {
    nombre: 'Fácil',
    palabrasMax: 8,
    tamano: 10,
    direcciones: [
      [0, 1], // horizontal derecha
      [1, 0]  // vertical abajo
    ]
  },
  media: {
    nombre: 'Media',
    palabrasMax: 10,
    tamano: 12,
    direcciones: [
      [0, 1],   // horizontal derecha
      [1, 0],   // vertical abajo
      [1, 1],   // diagonal abajo-derecha
      [-1, 1]   // diagonal arriba-derecha
    ]
  },
  dificil: {
    nombre: 'Difícil',
    palabrasMax: 12,
    tamano: 15,
    direcciones: [
      [0, 1],   // horizontal normal
      [1, 0],   // vertical normal
      [1, 1],   // diagonal abajo-derecha
      [-1, 1],  // diagonal arriba-derecha
      [0, -1],  // horizontal invertida
      [-1, 0],  // vertical invertida
      [1, -1],  // diagonal abajo-izquierda
      [-1, -1]  // diagonal arriba-izquierda
    ]
  }
};

if (typeof document !== 'undefined') {
  const contenido = document.getElementById('contenido');
  if (contenido) {
    iniciarModuloSopa();
  }
}

async function iniciarModuloSopa() {
  await montarPlantilla({ titulo: "Sopa de Letras", roles: ["estudiante", "docente"] });

  contenido.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-2xl);">
      <div class="cargando" role="status" aria-label="Cargando sopa de letras"></div>
    </div>
  `;

  // 1. Obtener tema
  const tema = await obtenerTemaActividad();

  if (!tema || !tema.id) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono" aria-hidden="true">🔍</div>
        <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
        <p class="vacio__descripcion">
          Debes elegir un tema de estudio para generar la sopa de letras.
        </p>
        <a href="/paginas/actividades.html" class="btn btn--primario">
          Volver a actividades
        </a>
      </div>
    `;
    return;
  }

  // 2. Obtener términos del glosario
  let terminosRaw = [];
  try {
    terminosRaw = await api.listar('glosario', { temaId: tema.id });
  } catch (err) {
    ui.aviso('Error al cargar glosario del tema', 'error');
  }

  // Mapeo palabra normalizada -> registro término
  const glosarioMap = new Map();
  const palabrasAptasTodas = [];

  (Array.isArray(terminosRaw) ? terminosRaw : []).forEach((t) => {
    const rawTerm = (t.termino || '').trim();
    // Términos de una sola palabra
    if (!rawTerm.includes(' ') && !rawTerm.includes('-')) {
      const normal = util.normalizar(rawTerm);
      if (normal.length >= 3) {
        if (!glosarioMap.has(normal)) {
          glosarioMap.set(normal, t);
          palabrasAptasTodas.push(normal);
        }
      }
    }
  });

  if (palabrasAptasTodas.length === 0) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono" aria-hidden="true">🔍</div>
        <h2 class="vacio__titulo">Sin términos adecuados</h2>
        <p class="vacio__descripcion">
          El tema "<strong>${ui.escapar(tema.titulo)}</strong>" no cuenta con términos de una sola palabra para la sopa de letras.
        </p>
        <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
          <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario">
            Ir al tema de estudio →
          </a>
          <a href="/paginas/actividades.html" class="btn btn--secundario">
            Elegir otra actividad
          </a>
        </div>
      </div>
    `;
    return;
  }

  let nivelActual = 'facil';
  let grillaActual = [];
  let ubicacionesActuales = [];
  let palabrasEncontradas = new Set();
  let celdasEncontradasCoords = new Set(); // clave "f,c"
  let tiempoInicio = 0;
  let timerInterval = null;
  let partidaTerminada = false;

  // Variables de interacción Pointer Events
  let arrastrando = false;
  let celdaInicio = null;
  let celdasSeleccionadas = [];

  function renderizarEstructura() {
    contenido.innerHTML = `
      <header class="sopa-cabecera">
        <div class="sopa-tema-tag">
          <span>Tema de estudio:</span>
          <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" style="font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            ${ui.escapar(tema.titulo)} ↗
          </a>
        </div>
        <h1 style="margin: 0; font-size: var(--tamano-2xl); color: var(--color-primario);">
          Sopa de Letras
        </h1>
      </header>

      <section class="sopa-panel-control" aria-label="Controles de la sopa de letras">
        <div class="sopa-estadisticas">
          <div class="sopa-metrica">
            <span class="sopa-metrica__etiqueta">Palabras</span>
            <span id="metricaEncontradas" class="sopa-metrica__valor">0 / 0</span>
          </div>
          <div class="sopa-metrica">
            <span class="sopa-metrica__etiqueta">Tiempo</span>
            <span id="metricaTiempo" class="sopa-metrica__valor">00:00</span>
          </div>
        </div>

        <div class="fila" style="gap: var(--espacio-m);">
          <div class="sopa-dificultades" role="group" aria-label="Dificultad">
            <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin-right: 4px;">Nivel:</span>
            ${['facil', 'media', 'dificil'].map((lvl) => `
              <button type="button"
                class="btn ${lvl === nivelActual ? 'btn--primario' : 'btn--secundario'} sopa-dificultad-btn"
                data-nivel="${lvl}">
                ${NIVELES[lvl].nombre}
              </button>
            `).join('')}
          </div>

          <button type="button" class="btn btn--peligro btn--pequeno" id="btnRendirse">
            Rendirse
          </button>
        </div>
      </section>

      <!-- Panel de retroalimentación en partida -->
      <div id="panelRetroSopa" class="sopa-retro-contenedor"></div>

      <!-- Área de Juego -->
      <div class="sopa-juego-contenedor">
        <!-- Grilla interactiva -->
        <div class="sopa-grilla-envoltorio">
          <div id="sopaGrilla" class="sopa-grilla" role="grid" aria-label="Cuadrícula de sopa de letras">
          </div>
        </div>

        <!-- Lista lateral de palabras -->
        <aside class="sopa-palabras-panel" aria-labelledby="tituloPalabras">
          <h2 id="tituloPalabras">
            <span>Palabras a encontrar</span>
            <span id="contadorPalabrasBadge" class="insignia insignia--secundario" style="font-size: var(--tamano-xs);">0</span>
          </h2>
          <ul id="sopaListaPalabras" class="sopa-palabras-lista">
          </ul>
        </aside>
      </div>
    `;

    // Eventos botones de nivel
    contenido.querySelectorAll('.sopa-dificultad-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        nivelActual = btn.getAttribute('data-nivel');
        renderizarEstructura();
        iniciarPartida();
      });
    });

    document.getElementById('btnRendirse')?.addEventListener('click', rendirse);
  }

  function actualizarTiempo() {
    const el = document.getElementById('metricaTiempo');
    if (!el || tiempoInicio === 0) return;
    const segTotales = Math.floor((Date.now() - tiempoInicio) / 1000);
    const m = String(Math.floor(segTotales / 60)).padStart(2, '0');
    const s = String(segTotales % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }

  function iniciarPartida() {
    if (timerInterval) clearInterval(timerInterval);
    tiempoInicio = Date.now();
    timerInterval = setInterval(actualizarTiempo, 1000);

    partidaTerminada = false;
    palabrasEncontradas = new Set();
    celdasEncontradasCoords = new Set();
    arrastrando = false;
    celdaInicio = null;
    celdasSeleccionadas = [];

    const cfg = NIVELES[nivelActual];

    // Filtrar palabras de hasta tamano letras
    const palabrasCandidatas = palabrasAptasTodas.filter((p) => p.length <= cfg.tamano);
    const barajadas = util.barajar(palabrasCandidatas);
    const seleccionadas = barajadas.slice(0, cfg.palabrasMax);

    // Generar sopa mediante la función pura
    const resultado = generarSopa(seleccionadas, cfg.tamano, cfg.direcciones);
    grillaActual = resultado.grilla;
    ubicacionesActuales = resultado.ubicaciones;

    // Actualizar métricas iniciales
    const elEncontradas = document.getElementById('metricaEncontradas');
    if (elEncontradas) {
      elEncontradas.textContent = `0 / ${ubicacionesActuales.length}`;
    }
    const badgeCont = document.getElementById('contadorPalabrasBadge');
    if (badgeCont) {
      badgeCont.textContent = `${ubicacionesActuales.length}`;
    }

    renderizarGrilla(cfg.tamano);
    renderizarListaPalabras();
  }

  function renderizarGrilla(tamano) {
    const cont = document.getElementById('sopaGrilla');
    if (!cont) return;

    cont.style.gridTemplateColumns = `repeat(${tamano}, 1fr)`;
    cont.innerHTML = '';

    for (let f = 0; f < tamano; f++) {
      for (let c = 0; c < tamano; c++) {
        const letra = grillaActual[f][c];
        const celda = document.createElement('div');
        celda.className = 'sopa-celda';
        celda.id = `celda_${f}_${c}`;
        celda.setAttribute('data-f', String(f));
        celda.setAttribute('data-c', String(c));
        celda.setAttribute('role', 'gridcell');
        celda.textContent = letra;

        cont.appendChild(celda);
      }
    }

    // Configurar Pointer Events para selección en línea recta
    cont.addEventListener('pointerdown', manejarPointerDown);
    cont.addEventListener('pointermove', manejarPointerMove);
    cont.addEventListener('pointerup', manejarPointerUp);
    cont.addEventListener('pointercancel', manejarPointerUp);
  }

  function renderizarListaPalabras() {
    const listaEl = document.getElementById('sopaListaPalabras');
    if (!listaEl) return;

    listaEl.innerHTML = ubicacionesActuales
      .map((u) => `
        <li class="sopa-palabra-item" id="palabra_${u.palabra}">
          <span>${ui.escapar(u.palabra)}</span>
          <span class="palabra-check" aria-hidden="true">○</span>
        </li>
      `)
      .join('');
  }

  // Calcula celdas en línea recta entre inicio y fin (horizontal, vertical o diagonal a 45°)
  function calcularLinea(f1, c1, f2, c2) {
    const df = f2 - f1;
    const dc = c2 - c1;

    // Verificar si es horizontal, vertical o diagonal a 45°
    const esHorizontal = df === 0;
    const esVertical = dc === 0;
    const esDiagonal = Math.abs(df) === Math.abs(dc);

    if (!esHorizontal && !esVertical && !esDiagonal) {
      return null;
    }

    const pasos = Math.max(Math.abs(df), Math.abs(dc));
    const stepF = df === 0 ? 0 : df > 0 ? 1 : -1;
    const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;

    const linea = [];
    for (let i = 0; i <= pasos; i++) {
      linea.push({ f: f1 + i * stepF, c: c1 + i * stepC });
    }
    return linea;
  }

  function manejarPointerDown(e) {
    if (partidaTerminada) return;
    const celda = e.target.closest('.sopa-celda');
    if (!celda) return;

    arrastrando = true;
    celda.setPointerCapture?.(e.pointerId);

    const f = Number(celda.getAttribute('data-f'));
    const c = Number(celda.getAttribute('data-c'));
    celdaInicio = { f, c };
    celdasSeleccionadas = [celdaInicio];

    limpiarSeleccionVisual();
    celda.classList.add('sopa-celda--seleccionada');
  }

  function manejarPointerMove(e) {
    if (!arrastrando || !celdaInicio || partidaTerminada) return;

    const elBajoPuntero = document.elementFromPoint(e.clientX, e.clientY);
    const celdaActualEl = elBajoPuntero?.closest('.sopa-celda');
    if (!celdaActualEl) return;

    const fActual = Number(celdaActualEl.getAttribute('data-f'));
    const cActual = Number(celdaActualEl.getAttribute('data-c'));

    const linea = calcularLinea(celdaInicio.f, celdaInicio.c, fActual, cActual);
    if (!linea) return;

    limpiarSeleccionVisual();
    celdasSeleccionadas = linea;

    for (const { f, c } of celdasSeleccionadas) {
      const el = document.getElementById(`celda_${f}_${c}`);
      if (el) el.classList.add('sopa-celda--seleccionada');
    }
  }

  function manejarPointerUp() {
    if (!arrastrando || partidaTerminada) return;
    arrastrando = false;

    if (celdasSeleccionadas.length >= 2) {
      const cadena = celdasSeleccionadas.map(({ f, c }) => grillaActual[f][c]).join('');
      const cadenaInversa = cadena.split('').reverse().join('');

      // Buscar si coincide con alguna de las palabras ubicadas no encontradas
      const hallazgo = ubicacionesActuales.find(
        (u) =>
          !palabrasEncontradas.has(u.palabra) &&
          (u.palabra === cadena || u.palabra === cadenaInversa)
      );

      if (hallazgo) {
        palabrasEncontradas.add(hallazgo.palabra);

        // Marcar permanentemente las celdas en la grilla
        for (const { f, c } of celdasSeleccionadas) {
          celdasEncontradasCoords.add(`${f},${c}`);
          const el = document.getElementById(`celda_${f}_${c}`);
          if (el) {
            el.classList.add('sopa-celda--encontrada');
          }
        }

        // Tachar palabra en la lista lateral
        const liPalabra = document.getElementById(`palabra_${hallazgo.palabra}`);
        if (liPalabra) {
          liPalabra.classList.add('sopa-palabra-item--encontrada');
          const checkEl = liPalabra.querySelector('.palabra-check');
          if (checkEl) checkEl.textContent = '✓';
        }

        // Actualizar contador
        const elEncontradas = document.getElementById('metricaEncontradas');
        if (elEncontradas) {
          elEncontradas.textContent = `${palabrasEncontradas.size} / ${ubicacionesActuales.length}`;
        }

        // Mostrar retroalimentación con la definición
        const infoTerm = glosarioMap.get(hallazgo.palabra);
        const contRetro = document.getElementById('panelRetroSopa');
        mostrarRetro({
          correcto: true,
          explicacion: infoTerm?.definicion || `¡Encontraste la palabra "${hallazgo.palabra}"!`,
          contenedor: contRetro
        });

        // Verificar victoria
        if (palabrasEncontradas.size === ubicacionesActuales.length) {
          concluirPartida();
        }
      }
    }

    limpiarSeleccionVisual();
    celdaInicio = null;
    celdasSeleccionadas = [];
  }

  function limpiarSeleccionVisual() {
    document.querySelectorAll('.sopa-celda--seleccionada').forEach((el) => {
      el.classList.remove('sopa-celda--seleccionada');
    });
  }

  function rendirse() {
    if (partidaTerminada) return;

    // Revelar palabras restantes
    ubicacionesActuales.forEach((u) => {
      if (!palabrasEncontradas.has(u.palabra)) {
        for (const { f, c } of u.celdas) {
          const el = document.getElementById(`celda_${f}_${c}`);
          if (el && !el.classList.contains('sopa-celda--encontrada')) {
            el.classList.add('sopa-celda--revelada');
          }
        }
        const liPalabra = document.getElementById(`palabra_${u.palabra}`);
        if (liPalabra) {
          liPalabra.classList.add('sopa-palabra-item--revelada');
          const check = liPalabra.querySelector('.palabra-check');
          if (check) check.textContent = '✗';
        }
      }
    });

    concluirPartida();
  }

  async function concluirPartida() {
    partidaTerminada = true;
    if (timerInterval) clearInterval(timerInterval);

    const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
    const total = ubicacionesActuales.length;
    const encontradas = palabrasEncontradas.size;
    const errores = total - encontradas;

    // Registrar intento en el servidor
    try {
      await registrarIntento({
        actividad: 'sopa-letras',
        temaId: tema.id,
        puntaje: encontradas,
        maximo: total,
        errores,
        duracionSeg
      });
    } catch (err) {
      console.error('Error al registrar intento de sopa de letras:', err.message);
    }

    // Modal resumen
    const accion = await mostrarResumen({
      titulo: 'Sopa de Letras finalizada',
      aciertos: encontradas,
      errores,
      recomendaciones:
        errores === 0
          ? '¡Excelente agudeza visual! Localizaste todas las palabras sin errores.'
          : `Encontraste ${encontradas} de ${total} conceptos. Repasa el glosario del tema para reconocerlos aún más rápido.`,
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
    });

    if (accion === 'repetir') {
      iniciarPartida();
    }
  }

  renderizarEstructura();
  iniciarPartida();
}
