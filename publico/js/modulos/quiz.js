import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

let temaActual = null;
let estadoNiveles = [];
let sesionActiva = null;
let preguntasQuiz = [];
let indiceActual = 0;
let nivelEnJuego = 1;

async function inicializar() {
  await montarPlantilla({
    titulo: 'Quiz por Niveles',
    roles: ['estudiante']
  });

  ui.cargando(true);
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) {
      ui.aviso('No se seleccionó ningún tema para el quiz', 'advertencia');
      return;
    }

    await cargarEstadoNiveles();
    renderizarPantallaNiveles();
  } catch (err) {
    ui.aviso(err.message || 'Error al inicializar el quiz', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function cargarEstadoNiveles() {
  const data = await api.llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(temaActual.id)}`);
  estadoNiveles = Array.isArray(data?.niveles) ? data.niveles : [];
}

/**
 * Pantalla 1: Selección de Niveles (Bloom)
 */
function renderizarPantallaNiveles() {
  const main = document.getElementById('contenido');
  if (!main) return;

  main.innerHTML = `
    <div class="quiz-contenedor">
      <header class="quiz-cabecera">
        <span class="quiz-tema-indicador">Tema: ${ui.escapar(temaActual.titulo)}</span>
        <h1 class="quiz-titulo">Quiz por Niveles</h1>
        <p class="quiz-descripcion">
          Avanza progresivamente por los 5 niveles de la Taxonomía de Bloom.
          Cada nivel requiere al menos 70% de aprobación y otorga un diploma acreditado al superarlo.
        </p>
      </header>

      <section class="quiz-niveles-grid" aria-label="Niveles de aprendizaje">
        ${estadoNiveles
          .map((n) => {
            const esAprobado = n.estado === 'aprobado';
            const esDisponible = n.estado === 'disponible';
            const esBloqueado = n.estado === 'bloqueado';

            let badgeTexto = '🔒 Bloqueado';
            let badgeClase = 'badge--neutro';
            if (esAprobado) {
              badgeTexto = '✓ Aprobado';
              badgeClase = 'badge--exito';
            } else if (esDisponible) {
              badgeTexto = '● Disponible';
              badgeClase = 'badge--info';
            }

            return `
            <article class="tarjeta-nivel ${n.estado}">
              <div class="tarjeta-nivel-cabecera">
                <div class="tarjeta-nivel-numero">${n.nivel}</div>
                <span class="badge ${badgeClase}">${badgeTexto}</span>
              </div>

              <div class="tarjeta-nivel-info">
                <h3>Nivel ${n.nivel}: ${ui.escapar(n.nombre)}</h3>
                <div class="tarjeta-nivel-porcentaje">
                  ${
                    n.mejorPorcentaje > 0
                      ? `Mejor puntaje: <strong>${n.mejorPorcentaje}%</strong>`
                      : 'Sin intentos registrados'
                  }
                </div>
              </div>

              <div class="tarjeta-nivel-acciones">
                ${
                  esDisponible
                    ? `
                  <button type="button" class="btn btn--primario btn-iniciar-nivel" data-nivel="${n.nivel}">
                    Comenzar nivel
                  </button>
                `
                    : esAprobado
                    ? `
                  <button type="button" class="btn btn--primario btn-iniciar-nivel" data-nivel="${n.nivel}">
                    Reintentar nivel
                  </button>
                  <button type="button" class="btn btn--secundario btn-diploma" data-nivel="${n.nivel}">
                    🎓 Descargar diploma
                  </button>
                `
                    : `
                  <button type="button" class="btn btn--secundario" disabled>
                    Nivel bloqueado
                  </button>
                `
                }
              </div>
            </article>
          `;
          })
          .join('')}
      </section>
    </div>
  `;

  // Eventos para iniciar nivel
  main.querySelectorAll('.btn-iniciar-nivel').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nivel = parseInt(btn.dataset.nivel, 10);
      iniciarQuiz(nivel);
    });
  });

  // Eventos para descargar diploma
  main.querySelectorAll('.btn-diploma').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nivel = parseInt(btn.dataset.nivel, 10);
      await descargarDiploma(nivel);
    });
  });
}

/**
 * Pantalla 2: Iniciar una sesión de quiz
 */
async function iniciarQuiz(nivel) {
  nivelEnJuego = nivel;
  ui.cargando(true);
  try {
    const res = await api.llamar('POST', '/api/quiz/iniciar', {
      temaId: temaActual.id,
      nivel
    });

    sesionActiva = res.sesionId;
    preguntasQuiz = Array.isArray(res.preguntas) ? res.preguntas : [];
    indiceActual = 0;

    if (preguntasQuiz.length === 0) {
      ui.aviso('No hay preguntas disponibles para este nivel', 'advertencia');
      return;
    }

    renderizarPreguntaActual();
  } catch (err) {
    ui.aviso(err.message || 'Error al iniciar el quiz', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza la pregunta actual con barra de progreso
 */
function renderizarPreguntaActual() {
  const main = document.getElementById('contenido');
  if (!main) return;

  const pregunta = preguntasQuiz[indiceActual];
  const total = preguntasQuiz.length;
  const porcentajeProgreso = Math.round(((indiceActual + 1) / total) * 100);
  const esUltima = indiceActual === total - 1;

  let cuerpoControl = '';

  if (pregunta.tipo === 'opcion') {
    cuerpoControl = `
      <div class="quiz-opciones-lista" role="radiogroup" aria-label="Opciones de respuesta">
        ${(pregunta.opciones || [])
          .map(
            (op, idx) => `
          <label class="quiz-opcion-item" for="opcion-${idx}">
            <input type="radio" name="respuesta-quiz" id="opcion-${idx}" value="${idx}" class="quiz-opcion-radio">
            <span>${ui.escapar(op)}</span>
          </label>
        `
          )
          .join('')}
      </div>
    `;
  } else if (pregunta.tipo === 'vf') {
    cuerpoControl = `
      <div class="quiz-vf-contenedor" role="radiogroup" aria-label="Verdadero o Falso">
        <button type="button" class="quiz-vf-btn" data-valor="true">
          <span>✓ Verdadero</span>
        </button>
        <button type="button" class="quiz-vf-btn" data-valor="false">
          <span>✕ Falso</span>
        </button>
      </div>
    `;
  } else if (pregunta.tipo === 'completar') {
    cuerpoControl = `
      <div class="quiz-completar-contenedor">
        <label for="input-completar" class="texto-suave">Escribe la palabra o frase para completar el enunciado:</label>
        <input type="text" id="input-completar" class="quiz-completar-input" placeholder="Tu respuesta..." autocomplete="off">
      </div>
    `;
  }

  main.innerHTML = `
    <div class="quiz-contenedor">
      <div class="quiz-activo-card">
        <div class="quiz-progreso-cabecera">
          <div>
            <span class="badge badge--info">Nivel ${nivelEnJuego}</span>
            <span class="texto-suave" style="margin-left: var(--espacio-s);">Pregunta ${indiceActual + 1} de ${total}</span>
          </div>
          <button type="button" id="btn-abandonar-quiz" class="btn btn--secundario btn--pequeno">
            Salir del quiz
          </button>
        </div>

        <div class="quiz-progreso-barra-fondo" role="progressbar" aria-valuenow="${porcentajeProgreso}" aria-valuemin="0" aria-valuemax="100">
          <div class="quiz-progreso-barra-relleno" style="width: ${porcentajeProgreso}%;"></div>
        </div>

        <div class="quiz-enunciado-bloque">
          <span class="quiz-enunciado-texto">${ui.escapar(pregunta.enunciado)}</span>
        </div>

        <div id="contenedor-opciones-pregunta">
          ${cuerpoControl}
        </div>

        <div id="panel-retro" class="contenedor-retro"></div>

        <div class="quiz-acciones-pie">
          <button type="button" id="btn-responder" class="btn btn--primario">
            Responder
          </button>
          <button type="button" id="btn-siguiente" class="btn btn--primario" style="display: none;">
            ${esUltima ? 'Ver resultados' : 'Siguiente pregunta →'}
          </button>
        </div>
      </div>
    </div>
  `;

  // Estilos interactivos para opciones
  let respuestaSeleccionada = null;

  if (pregunta.tipo === 'opcion') {
    const radioLabels = main.querySelectorAll('.quiz-opcion-item');
    radioLabels.forEach((label) => {
      label.addEventListener('click', () => {
        radioLabels.forEach((l) => l.classList.remove('seleccionada'));
        label.classList.add('seleccionada');
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          respuestaSeleccionada = radio.value;
        }
      });
    });
  } else if (pregunta.tipo === 'vf') {
    const vfBtns = main.querySelectorAll('.quiz-vf-btn');
    vfBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        vfBtns.forEach((b) => b.classList.remove('seleccionada'));
        btn.classList.add('seleccionada');
        respuestaSeleccionada = btn.dataset.valor === 'true';
      });
    });
  }

  // Abandonar
  document.getElementById('btn-abandonar-quiz')?.addEventListener('click', async () => {
    const salir = await ui.confirmar('¿Deseas salir del quiz? El progreso actual no será guardado.');
    if (salir) {
      await cargarEstadoNiveles();
      renderizarPantallaNiveles();
    }
  });

  // Botón responder
  const btnResponder = document.getElementById('btn-responder');
  const btnSiguiente = document.getElementById('btn-siguiente');

  btnResponder?.addEventListener('click', async () => {
    let valorRespuesta = respuestaSeleccionada;
    if (pregunta.tipo === 'completar') {
      const input = document.getElementById('input-completar');
      valorRespuesta = input ? input.value.trim() : '';
    }

    if (valorRespuesta === null || valorRespuesta === undefined || valorRespuesta === '') {
      ui.aviso('Por favor ingresa o selecciona una respuesta', 'advertencia');
      return;
    }

    ui.cargando(true);
    try {
      const res = await api.llamar('POST', '/api/quiz/responder', {
        sesionId: sesionActiva,
        preguntaId: pregunta.id,
        respuesta: valorRespuesta
      });

      // Desactivar entradas de respuesta
      main.querySelectorAll('input, button.quiz-vf-btn').forEach((elem) => {
        elem.disabled = true;
      });

      // Mostrar retroalimentación con el componente del núcleo
      mostrarRetro({
        correcto: res.correcto,
        explicacion: res.retroalimentacion,
        sugerencia: res.correcto ? '' : `Respuesta correcta: ${res.correcta}`,
        enlaceTema: `/paginas/tema.html?temaId=${encodeURIComponent(temaActual.id)}`,
        contenedor: document.getElementById('panel-retro')
      });

      btnResponder.style.display = 'none';
      if (btnSiguiente) {
        btnSiguiente.style.display = 'inline-flex';
        btnSiguiente.focus();
      }
    } catch (err) {
      ui.aviso(err.message || 'Error al enviar respuesta', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Botón siguiente
  btnSiguiente?.addEventListener('click', async () => {
    if (esUltima) {
      await finalizarQuiz();
    } else {
      indiceActual++;
      renderizarPreguntaActual();
    }
  });
}

/**
 * Finaliza la sesión del quiz y procesa resultados
 */
async function finalizarQuiz() {
  ui.cargando(true);
  try {
    const res = await api.llamar('POST', '/api/quiz/finalizar', {
      sesionId: sesionActiva
    });

    await cargarEstadoNiveles();

    // 1. Mostrar resumen pedagógico con modal
    await mostrarResumen({
      titulo: res.aprobado ? '¡Nivel Superado con Éxito!' : 'Nivel no superado',
      aciertos: res.aciertos,
      errores: res.total - res.aciertos,
      recomendaciones:
        res.repasar && res.repasar.length > 0
          ? `Aspectos a repasar: ${res.repasar.join(' • ')}`
          : '¡Excelente desempeño! Has demostrado gran dominio de los conceptos.',
      enlaceTema: `/paginas/tema.html?temaId=${encodeURIComponent(temaActual.id)}`
    });

    // 2. Si aprobó, presentar puntos e insignias ganadas
    if (res.aprobado) {
      await mostrarLogros({
        puntosGanados: res.puntosGanados,
        insigniasNuevas: res.insigniasNuevas
      });
    }

    renderizarPantallaResultado(res);
  } catch (err) {
    ui.aviso(err.message || 'Error al finalizar el quiz', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Pantalla 3: Resultados finales del intento
 */
function renderizarPantallaResultado(resultado) {
  const main = document.getElementById('contenido');
  if (!main) return;

  const { aprobado, porcentaje, aciertos, total, repasar } = resultado;

  main.innerHTML = `
    <div class="quiz-contenedor">
      <div class="quiz-resultado-card ${aprobado ? 'aprobado' : ''}">
        <div class="quiz-resultado-icono" aria-hidden="true">${aprobado ? '🏆' : '📚'}</div>
        <h2 style="margin: 0; font-size: var(--tamano-xl); color: var(--color-primario);">
          ${aprobado ? `¡Felicidades! Has aprobado el Nivel ${nivelEnJuego}` : `Nivel ${nivelEnJuego} no superado`}
        </h2>

        <div class="quiz-resultado-porcentaje">
          ${porcentaje}%
        </div>
        <p class="texto-suave" style="margin: 0;">
          Obtuviste <strong>${aciertos}</strong> aciertos de <strong>${total}</strong> preguntas (Mínimo requerido: 70%).
        </p>

        ${
          repasar && repasar.length > 0
            ? `
          <div class="quiz-resultado-repasar">
            <strong>Recomendaciones para repasar:</strong>
            <ul style="margin: var(--espacio-xs) 0 0 var(--espacio-m); padding: 0;">
              ${repasar.map((r) => `<li>${ui.escapar(r)}</li>`).join('')}
            </ul>
          </div>
        `
            : ''
        }

        <div class="quiz-resultado-acciones">
          ${
            aprobado
              ? `
            <button type="button" id="btn-descargar-diploma" class="btn btn--primario">
              🎓 Descargar diploma
            </button>
            ${
              nivelEnJuego < 5
                ? `
              <button type="button" id="btn-siguiente-nivel" class="btn btn--secundario">
                Continuar al Nivel ${nivelEnJuego + 1} →
              </button>
            `
                : ''
            }
          `
              : `
            <button type="button" id="btn-reintentar-quiz" class="btn btn--primario">
              🔄 Reintentar con preguntas nuevas
            </button>
          `
          }
          <button type="button" id="btn-volver-niveles" class="btn btn--secundario">
            Ver todos los niveles
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-descargar-diploma')?.addEventListener('click', async () => {
    await descargarDiploma(nivelEnJuego);
  });

  document.getElementById('btn-siguiente-nivel')?.addEventListener('click', () => {
    iniciarQuiz(nivelEnJuego + 1);
  });

  document.getElementById('btn-reintentar-quiz')?.addEventListener('click', () => {
    iniciarQuiz(nivelEnJuego);
  });

  document.getElementById('btn-volver-niveles')?.addEventListener('click', async () => {
    await cargarEstadoNiveles();
    renderizarPantallaNiveles();
  });
}

/**
 * Descarga el diploma de nivel quiz
 */
async function descargarDiploma(nivel) {
  ui.cargando(true);
  try {
    const cert = await generarDiploma({
      tipo: 'nivel-quiz',
      temaId: temaActual.id,
      nivel
    });
    ui.aviso(`¡Diploma generado! Código: ${cert.codigo}`, 'exito');
  } catch (err) {
    ui.aviso(err.message || 'Error al generar el diploma', 'error');
  } finally {
    ui.cargando(false);
  }
}

inicializar();

