import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: "Encuentra la Pareja", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  iniciarModuloPareja();
}

async function iniciarModuloPareja() {
  contenido.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-2xl);">
      <div class="cargando" role="status" aria-label="Cargando juego"></div>
    </div>
  `;

  // 1. Obtener tema
  const tema = await obtenerTemaActividad();

  if (!tema || !tema.id) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono" aria-hidden="true">🃏</div>
        <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
        <p class="vacio__descripcion">
          Debes elegir un tema de estudio para jugar a Encuentra la pareja.
        </p>
        <a href="/paginas/actividades.html" class="btn btn--primario">
          Volver a actividades
        </a>
      </div>
    `;
    return;
  }

  // 2. Obtener términos del glosario
  let terminos = [];
  try {
    terminos = await api.listar('glosario', { temaId: tema.id });
  } catch (err) {
    ui.aviso('Error al cargar glosario del tema', 'error');
  }

  // Mínimo 4 términos para poder jugar
  if (!Array.isArray(terminos) || terminos.length < 4) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono" aria-hidden="true">🃏</div>
        <h2 class="vacio__titulo">Glosario insuficiente</h2>
        <p class="vacio__descripcion">
          El tema "<strong>${ui.escapar(tema.titulo)}</strong>" cuenta con ${terminos ? terminos.length : 0} términos. Se requieren al menos 4 para jugar a Encuentra la pareja.
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

  let dificultadActual = Math.min(terminos.length, 6);
  let intentos = 0;
  let tiempoInicio = 0;
  let timerInterval = null;
  let cartas = [];
  let volteadas = [];
  let emparejadas = new Set();
  let bloqueado = false;
  let partidaTerminada = false;

  function renderizarEstructura() {
    contenido.innerHTML = `
      <header class="pareja-cabecera">
        <div class="pareja-tema-tag">
          <span>Tema de estudio:</span>
          <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" style="font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            ${ui.escapar(tema.titulo)} ↗
          </a>
        </div>
        <h1 style="margin: 0; font-size: var(--tamano-2xl); color: var(--color-primario);">
          Encuentra la Pareja
        </h1>
      </header>

      <section class="pareja-panel-control" aria-label="Controles del juego">
        <div class="pareja-estadisticas">
          <div class="pareja-metrica">
            <span class="pareja-metrica__etiqueta">Intentos</span>
            <span id="metricaIntentos" class="pareja-metrica__valor">0</span>
          </div>
          <div class="pareja-metrica">
            <span class="pareja-metrica__etiqueta">Parejas</span>
            <span id="metricaParejas" class="pareja-metrica__valor">0 / ${dificultadActual}</span>
          </div>
          <div class="pareja-metrica">
            <span class="pareja-metrica__etiqueta">Tiempo</span>
            <span id="metricaTiempo" class="pareja-metrica__valor">00:00</span>
          </div>
        </div>

        <div class="fila" style="gap: var(--espacio-m);">
          <div class="pareja-dificultades" role="group" aria-label="Seleccionar dificultad">
            <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin-right: 4px;">Parejas:</span>
            ${[6, 8, 10].map((num) => {
              const habilitado = terminos.length >= num || (num === 6 && terminos.length >= 4);
              const esActivo = dificultadActual === Math.min(terminos.length, num);
              return `
                <button type="button"
                  class="btn ${esActivo ? 'btn--primario' : 'btn--secundario'} pareja-dificultad-btn"
                  data-dificultad="${num}"
                  ${!habilitado ? 'disabled title="El tema no tiene suficientes términos"' : ''}>
                  ${num}
                </button>
              `;
            }).join('')}
          </div>

          <button type="button" class="btn btn--secundario btn--pequeno" id="btnReiniciar">
            Reiniciar ↻
          </button>
        </div>
      </section>

      <!-- Panel de retroalimentación en partida -->
      <div id="panelRetroPareja" class="pareja-retro-contenedor"></div>

      <!-- Cuadrícula de tarjetas -->
      <div id="tableroPareja" class="pareja-tablero" role="region" aria-label="Tablero de tarjetas">
      </div>
    `;

    // Eventos botones de dificultad
    contenido.querySelectorAll('.pareja-dificultad-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = Number(btn.getAttribute('data-dificultad'));
        dificultadActual = Math.min(terminos.length, num);
        renderizarEstructura();
        iniciarPartida();
      });
    });

    document.getElementById('btnReiniciar')?.addEventListener('click', () => {
      iniciarPartida();
    });
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
    tiempoInicio = 0;
    intentos = 0;
    emparejadas = new Set();
    volteadas = [];
    bloqueado = false;
    partidaTerminada = false;

    const elIntentos = document.getElementById('metricaIntentos');
    const elParejas = document.getElementById('metricaParejas');
    const elTiempo = document.getElementById('metricaTiempo');
    const elRetro = document.getElementById('panelRetroPareja');

    if (elIntentos) elIntentos.textContent = '0';
    if (elParejas) elParejas.textContent = `0 / ${dificultadActual}`;
    if (elTiempo) elTiempo.textContent = '00:00';
    if (elRetro) elRetro.innerHTML = '';

    // Seleccionar N términos al azar
    const barajados = util.barajar(terminos);
    const seleccionados = barajados.slice(0, dificultadActual);

    // Crear cartas: una para el término y otra para la definición
    cartas = [];
    seleccionados.forEach((item, index) => {
      cartas.push({
        id: `card_term_${index}`,
        terminoId: item.id,
        tipo: 'termino',
        texto: item.termino,
        definicion: item.definicion
      });
      cartas.push({
        id: `card_def_${index}`,
        terminoId: item.id,
        tipo: 'definicion',
        texto: item.definicion,
        definicion: item.definicion
      });
    });

    // Barajar todas las cartas
    cartas = util.barajar(cartas);

    // Renderizar tablero
    const tablero = document.getElementById('tableroPareja');
    if (!tablero) return;
    tablero.innerHTML = '';

    cartas.forEach((c, idx) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'tarjeta-pareja';
      boton.id = c.id;
      boton.setAttribute('data-idx', String(idx));
      boton.setAttribute('aria-label', `Tarjeta ${idx + 1}: boca abajo`);

      boton.innerHTML = `
        <div class="tarjeta-pareja__interno">
          <div class="tarjeta-pareja__cara tarjeta-pareja__cara--dorso">
            <span class="tarjeta-pareja__dorso-icono" aria-hidden="true">🃏</span>
            <span class="tarjeta-pareja__dorso-texto">Voltear</span>
          </div>
          <div class="tarjeta-pareja__cara tarjeta-pareja__cara--frente">
            <span class="tarjeta-pareja__tipo-badge tarjeta-pareja__tipo-badge--${c.tipo}">
              ${c.tipo === 'termino' ? 'Término' : 'Definición'}
            </span>
            <div class="tarjeta-pareja__contenido tarjeta-pareja__contenido--${c.tipo}">
              ${ui.escapar(c.texto)}
            </div>
          </div>
        </div>
      `;

      boton.addEventListener('click', () => manejarVolteo(c, boton));
      tablero.appendChild(boton);
    });
  }

  function manejarVolteo(carta, elemBoton) {
    if (bloqueado || partidaTerminada) return;
    if (emparejadas.has(carta.terminoId)) return;
    if (volteadas.some((v) => v.carta.id === carta.id)) return;

    // Iniciar temporizador en el primer volteo
    if (tiempoInicio === 0) {
      tiempoInicio = Date.now();
      timerInterval = setInterval(actualizarTiempo, 1000);
    }

    // Voltear tarjeta visualmente
    elemBoton.classList.add('tarjeta-pareja--volteada');
    elemBoton.setAttribute(
      'aria-label',
      `Tarjeta descubierta: ${carta.tipo === 'termino' ? 'término' : 'definición'} ${carta.texto}`
    );

    volteadas.push({ carta, elem: elemBoton });

    // Cuando se voltean dos tarjetas
    if (volteadas.length === 2) {
      intentos++;
      const elIntentos = document.getElementById('metricaIntentos');
      if (elIntentos) elIntentos.textContent = String(intentos);

      const [c1, c2] = volteadas;

      // Forman pareja
      if (c1.carta.terminoId === c2.carta.terminoId) {
        emparejadas.add(c1.carta.terminoId);

        c1.elem.classList.add('tarjeta-pareja--emparejada');
        c2.elem.classList.add('tarjeta-pareja--emparejada');
        c1.elem.disabled = true;
        c2.elem.disabled = true;

        const elParejas = document.getElementById('metricaParejas');
        if (elParejas) {
          elParejas.textContent = `${emparejadas.size} / ${dificultadActual}`;
        }

        // Mostrar retroalimentación inmediata con la definición
        const contRetro = document.getElementById('panelRetroPareja');
        mostrarRetro({
          correcto: true,
          explicacion: c1.carta.definicion,
          contenedor: contRetro
        });

        volteadas = [];

        // Comprobar si completó todas las parejas
        if (emparejadas.size === dificultadActual) {
          completarPartida();
        }
      } else {
        // No forman pareja: voltear de nuevo a los 1.2 segundos
        bloqueado = true;
        setTimeout(() => {
          c1.elem.classList.remove('tarjeta-pareja--volteada');
          c2.elem.classList.remove('tarjeta-pareja--volteada');
          c1.elem.setAttribute('aria-label', 'Tarjeta: boca abajo');
          c2.elem.setAttribute('aria-label', 'Tarjeta: boca abajo');
          volteadas = [];
          bloqueado = false;
        }, 1200);
      }
    }
  }

  async function completarPartida() {
    partidaTerminada = true;
    if (timerInterval) clearInterval(timerInterval);

    const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
    const errores = Math.max(0, intentos - dificultadActual);
    // Puntaje: máximo entre 0 y 10 - (intentos - parejas)
    const puntaje = Math.max(0, 10 - errores);

    // Registrar intento en el servidor
    try {
      await registrarIntento({
        actividad: 'pareja',
        temaId: tema.id,
        puntaje,
        maximo: 10,
        errores,
        duracionSeg
      });
    } catch (err) {
      console.error('Error al registrar intento en pareja:', err.message);
    }

    // Presentar modal de resumen
    const accion = await mostrarResumen({
      titulo: '¡Encuentra la pareja completado!',
      aciertos: dificultadActual,
      errores,
      recomendaciones:
        errores === 0
          ? '¡Impresionante agilidad mental y memoria sin errores!'
          : `Lograste emparejar todos los conceptos en ${intentos} intentos. Repasa los términos para afianzar su significado en menos movimientos.`,
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
    });

    if (accion === 'repetir') {
      iniciarPartida();
    }
  }

  renderizarEstructura();
  iniciarPartida();
}

