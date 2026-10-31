import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: "Juego del Ahorcado", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  iniciarAhorcado();
}

async function iniciarAhorcado() {
  contenido.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-2xl);">
      <div class="cargando" role="status" aria-label="Cargando actividad"></div>
    </div>
  `;

  // 1. Obtener tema (vía ?temaId= o selector modal)
  const tema = await obtenerTemaActividad();

  if (!tema || !tema.id) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono" aria-hidden="true">🎯</div>
        <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
        <p class="vacio__descripcion">
          Debes elegir un tema de estudio para practicar con el juego del ahorcado.
        </p>
        <a href="/paginas/actividades.html" class="btn btn--primario">
          Volver al catálogo de actividades
        </a>
      </div>
    `;
    return;
  }

  // 2. Obtener términos del glosario asociados al tema
  let terminos = [];
  try {
    terminos = await api.listar('glosario', { temaId: tema.id });
  } catch (err) {
    ui.aviso('Error al obtener términos del glosario', 'error');
  }

  // Filtrar los que tengan exactamente 6 letras normalizadas
  const terminos6Letras = (Array.isArray(terminos) ? terminos : []).filter((t) => {
    const normal = util.normalizar(t.termino || '');
    return normal.length === 6;
  });

  if (terminos6Letras.length === 0) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono" aria-hidden="true">🎯</div>
        <h2 class="vacio__titulo">Sin términos de 6 letras</h2>
        <p class="vacio__descripcion">
          El tema "<strong>${ui.escapar(tema.titulo)}</strong>" aún no cuenta con términos de 6 letras aptos para el juego del ahorcado.
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

  // Conjunto de términos ya usados en la sesión actual
  const terminosUsados = new Set();

  let terminoActual = null;
  let palabraNormalizada = '';
  let letrasAdivinadas = new Set();
  let letrasFalladas = new Set();
  let errores = 0;
  let juegoTerminado = false;
  let tiempoInicio = 0;

  function prepararTablero() {
    contenido.innerHTML = `
      <header class="ahorcado-cabecera">
        <div class="ahorcado-tema-tag">
          <span>Tema de estudio:</span>
          <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" style="font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            ${ui.escapar(tema.titulo)} ↗
          </a>
        </div>
        <h1 style="margin: 0; font-size: var(--tamano-2xl); color: var(--color-primario);">
          Ahorcado Educativo
        </h1>
      </header>

      <section class="ahorcado-panel-juego" aria-label="Tablero de juego del ahorcado">
        <!-- Figura no violenta: Globo aerostático que se desinfla -->
        <div class="ahorcado-globo-contenedor">
          <svg class="ahorcado-globo-svg" viewBox="0 0 140 185" aria-hidden="true" role="img">
            <!-- Sombra suave en el suelo -->
            <ellipse cx="70" cy="180" rx="35" ry="4" fill="rgba(0,0,0,0.06)" />
            <!-- Cuerda del globo -->
            <path id="globoCuerda" class="globo-cuerda" d="M 70 130 Q 75 155 70 178" stroke="var(--color-borde)" stroke-width="2" fill="none" stroke-linecap="round" />
            <!-- Nudo inferior -->
            <polygon id="globoNudo" class="globo-nudo" points="66,132 74,132 70,126" fill="var(--color-primario)" />
            <!-- Cuerpo del globo -->
            <ellipse id="globoCuerpo" class="globo-cuerpo" cx="70" cy="70" rx="48" ry="58" fill="var(--color-primario)" />
            <!-- Brillo estético -->
            <ellipse id="globoBrillo" class="globo-brillo" cx="54" cy="52" rx="10" ry="16" fill="rgba(255,255,255,0.3)" transform="rotate(-20 54 52)" />
          </svg>
          <div id="ahorcadoVidasTexto" class="ahorcado-vidas-texto" aria-live="polite">
            3 errores permitidos antes de desinflar el globo
          </div>
        </div>

        <!-- Pista pedagógica -->
        <div class="ahorcado-pista-caja">
          <div class="ahorcado-pista-etiqueta">Pista</div>
          <p id="ahorcadoPista" class="ahorcado-pista-texto"></p>
        </div>

        <!-- 6 casillas de la palabra -->
        <div id="ahorcadoCasillas" class="ahorcado-palabra" role="group" aria-label="Casillas de la palabra">
        </div>

        <!-- Teclado en pantalla (A-Z con Ñ) -->
        <div id="ahorcadoTeclado" class="ahorcado-teclado" role="group" aria-label="Teclado en pantalla">
        </div>

        <!-- Panel para retroalimentación -->
        <div id="panelRetroAhorcado" style="width: 100%; max-width: 580px;"></div>

        <!-- Acciones -->
        <div id="ahorcadoAcciones" class="ahorcado-acciones" style="display: none;">
          <button type="button" class="btn btn--primario" id="btnOtraPalabra">
            Otra palabra ↻
          </button>
          <a href="/paginas/actividades.html" class="btn btn--secundario">
            Otras actividades
          </a>
        </div>
      </section>
    `;

    document.getElementById('btnOtraPalabra').addEventListener('click', iniciarRonda);
    renderizarTeclado();
  }

  function renderizarTeclado() {
    const contenedorTeclado = document.getElementById('ahorcadoTeclado');
    if (!contenedorTeclado) return;

    const filas = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
      ['J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q'],
      ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    ];

    contenedorTeclado.innerHTML = filas.map((fila) => `
      <div class="teclado-fila">
        ${fila.map((letra) => `
          <button type="button" class="teclado-tecla" data-letra="${letra}" aria-label="Letra ${letra}">
            ${letra}
          </button>
        `).join('')}
      </div>
    `).join('');

    contenedorTeclado.querySelectorAll('.teclado-tecla').forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = btn.getAttribute('data-letra');
        if (l) probarLetra(l);
      });
    });
  }

  function actualizarGlobo() {
    const cuerpo = document.getElementById('globoCuerpo');
    const brillo = document.getElementById('globoBrillo');
    const nudo = document.getElementById('globoNudo');
    const cuerda = document.getElementById('globoCuerda');
    const textoVidas = document.getElementById('ahorcadoVidasTexto');

    if (!cuerpo || !textoVidas) return;

    // 4 estados de desinflado progresivo (0, 1, 2, 3 errores; derrota al 4to)
    if (errores === 0) {
      cuerpo.setAttribute('rx', '48');
      cuerpo.setAttribute('ry', '58');
      cuerpo.setAttribute('cy', '70');
      cuerpo.setAttribute('fill', 'var(--color-primario)');
      cuerpo.style.opacity = '1';
      if (brillo) brillo.style.opacity = '1';
      if (nudo) nudo.setAttribute('points', '66,130 74,130 70,124');
      if (cuerda) cuerda.setAttribute('d', 'M 70 130 Q 75 155 70 178');
      textoVidas.textContent = '3 errores permitidos antes de desinflar el globo';
    } else if (errores === 1) {
      cuerpo.setAttribute('rx', '38');
      cuerpo.setAttribute('ry', '48');
      cuerpo.setAttribute('cy', '82');
      cuerpo.setAttribute('fill', '#0284c7');
      cuerpo.style.opacity = '0.95';
      if (brillo) brillo.style.opacity = '0.7';
      if (nudo) nudo.setAttribute('points', '66,132 74,132 70,126');
      if (cuerda) cuerda.setAttribute('d', 'M 70 132 Q 65 155 70 178');
      textoVidas.textContent = '1 error cometido (te quedan 2 intentos)';
    } else if (errores === 2) {
      cuerpo.setAttribute('rx', '28');
      cuerpo.setAttribute('ry', '36');
      cuerpo.setAttribute('cy', '96');
      cuerpo.setAttribute('fill', 'var(--color-acento)');
      cuerpo.style.opacity = '0.9';
      if (brillo) brillo.style.opacity = '0.4';
      if (nudo) nudo.setAttribute('points', '66,134 74,134 70,128');
      if (cuerda) cuerda.setAttribute('d', 'M 70 134 Q 75 155 70 178');
      textoVidas.textContent = '2 errores cometidos (¡Cuidado! Te queda 1 intento)';
    } else if (errores === 3) {
      cuerpo.setAttribute('rx', '18');
      cuerpo.setAttribute('ry', '22');
      cuerpo.setAttribute('cy', '112');
      cuerpo.setAttribute('fill', '#ea580c');
      cuerpo.style.opacity = '0.85';
      if (brillo) brillo.style.opacity = '0';
      if (nudo) nudo.setAttribute('points', '66,136 74,136 70,130');
      if (cuerda) cuerda.setAttribute('d', 'M 70 136 Q 67 155 70 178');
      textoVidas.textContent = '¡Última oportunidad! El 4.° error desinflará el globo';
    } else {
      // 4 o más errores: globo completamente desinflado
      cuerpo.setAttribute('rx', '10');
      cuerpo.setAttribute('ry', '8');
      cuerpo.setAttribute('cy', '132');
      cuerpo.setAttribute('fill', 'var(--color-error)');
      cuerpo.style.opacity = '0.5';
      if (brillo) brillo.style.opacity = '0';
      if (nudo) nudo.setAttribute('points', '66,140 74,140 70,136');
      if (cuerda) cuerda.setAttribute('d', 'M 70 140 L 70 178');
      textoVidas.textContent = '¡El globo se ha desinflado por completo!';
    }
  }

  function actualizarCasillas(revelarTodas = false, gano = false) {
    const contCasillas = document.getElementById('ahorcadoCasillas');
    if (!contCasillas) return;

    contCasillas.innerHTML = '';

    for (let i = 0; i < 6; i++) {
      const letraReal = palabraNormalizada[i] || '';
      const adivinada = letrasAdivinadas.has(letraReal);
      const casilla = document.createElement('div');
      casilla.className = 'ahorcado-casilla';

      if (adivinada) {
        casilla.textContent = letraReal;
        casilla.classList.add('ahorcado-casilla--acertada');
        casilla.setAttribute('aria-label', `Letra ${i + 1}: ${letraReal}`);
      } else if (revelarTodas) {
        casilla.textContent = letraReal;
        casilla.classList.add('ahorcado-casilla--revelada');
        casilla.setAttribute('aria-label', `Letra ${i + 1} no adivinada: ${letraReal}`);
      } else {
        casilla.textContent = '';
        casilla.setAttribute('aria-label', `Letra ${i + 1}: oculta`);
      }

      contCasillas.appendChild(casilla);
    }
  }

  function probarLetra(letraOriginal) {
    if (juegoTerminado) return;

    const letra = util.normalizar(letraOriginal);
    if (!letra || letra.length !== 1) return;

    if (letrasAdivinadas.has(letra) || letrasFalladas.has(letra)) return;

    // Deshabilitar la tecla en pantalla
    const btnTecla = document.querySelector(`.teclado-tecla[data-letra="${letra}"]`);
    if (btnTecla) {
      btnTecla.disabled = true;
    }

    if (palabraNormalizada.includes(letra)) {
      letrasAdivinadas.add(letra);
      if (btnTecla) btnTecla.classList.add('teclado-tecla--acierto');

      actualizarCasillas();

      // Comprobar si se adivinaron todas las letras de la palabra
      const todasAdivinadas = palabraNormalizada.split('').every((char) => letrasAdivinadas.has(char));
      if (todasAdivinadas) {
        concluirPartida(true);
      }
    } else {
      letrasFalladas.add(letra);
      if (btnTecla) btnTecla.classList.add('teclado-tecla--fallo');

      errores++;
      actualizarGlobo();

      // Se permiten 3 errores: el juego termina en el cuarto
      if (errores >= 4) {
        concluirPartida(false);
      }
    }
  }

  async function concluirPartida(gano) {
    juegoTerminado = true;
    const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));

    // Revelar la palabra completa en las casillas
    actualizarCasillas(true, gano);

    // Deshabilitar todo el teclado
    document.querySelectorAll('.teclado-tecla').forEach((btn) => {
      btn.disabled = true;
    });

    // Puntaje: si ganó 10 - errores * 2 (mínimo 0), si perdió 0
    const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;

    // Mostrar panel de retroalimentación pedagógica
    const contRetro = document.getElementById('panelRetroAhorcado');
    mostrarRetro({
      correcto: gano,
      explicacion: terminoActual.definicion || 'Sin definición registrada.',
      sugerencia: terminoActual.retroalimentacion || 'Repasa los conceptos clave para afianzar tus conocimientos.',
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`,
      contenedor: contRetro
    });

    // Registrar intento en el servidor y procesar recompensas
    try {
      await registrarIntento({
        actividad: 'ahorcado',
        temaId: tema.id,
        puntaje,
        maximo: 10,
        errores,
        duracionSeg
      });
    } catch (err) {
      console.error('Error al registrar intento del ahorcado:', err.message);
    }

    // Mostrar botón para otra palabra
    const accionesEl = document.getElementById('ahorcadoAcciones');
    if (accionesEl) {
      accionesEl.style.display = 'flex';
      document.getElementById('btnOtraPalabra')?.focus();
    }
  }

  function iniciarRonda() {
    // Buscar disponibles no usados en la sesión
    let disponibles = terminos6Letras.filter((t) => !terminosUsados.has(t.id));

    // Si ya se usaron todos los de 6 letras, reiniciar ciclo
    if (disponibles.length === 0) {
      terminosUsados.clear();
      disponibles = [...terminos6Letras];
    }

    // Elegir uno al azar
    const idx = Math.floor(Math.random() * disponibles.length);
    terminoActual = disponibles[idx];
    terminosUsados.add(terminoActual.id);

    palabraNormalizada = util.normalizar(terminoActual.termino || '');
    letrasAdivinadas = new Set();
    letrasFalladas = new Set();
    errores = 0;
    juegoTerminado = false;
    tiempoInicio = Date.now();

    // Actualizar pista
    const pistaEl = document.getElementById('ahorcadoPista');
    if (pistaEl) {
      pistaEl.textContent = terminoActual.pista || 'Descubre la palabra relacionada con el tema.';
    }

    // Limpiar panel retro y acciones
    const contRetro = document.getElementById('panelRetroAhorcado');
    if (contRetro) contRetro.innerHTML = '';
    const accionesEl = document.getElementById('ahorcadoAcciones');
    if (accionesEl) accionesEl.style.display = 'none';

    actualizarGlobo();
    actualizarCasillas();
    renderizarTeclado();
  }

  // Soporte para teclado físico A-Z y Ñ
  function manejarTecladoFisico(e) {
    if (juegoTerminado) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const tecla = e.key;
    if (!tecla || tecla.length !== 1) return;

    if (/^[a-zA-ZñÑ]$/.test(tecla)) {
      e.preventDefault();
      probarLetra(tecla);
    }
  }

  window.addEventListener('keydown', manejarTecladoFisico);

  prepararTablero();
  iniciarRonda();
}

