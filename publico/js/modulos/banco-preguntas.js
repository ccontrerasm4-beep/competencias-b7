import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

const NIVELES_BLOOM = [
  { nivel: 1, nombre: 'Recordar' },
  { nivel: 2, nombre: 'Comprender' },
  { nivel: 3, nombre: 'Aplicar' },
  { nivel: 4, nombre: 'Analizar' },
  { nivel: 5, nombre: 'Evaluar' }
];

let usuario = null;
let temas = [];
let asignaturas = [];
let unidades = [];
let temaSeleccionadoId = null;
let nivelActivo = 1;
let preguntas = [];

async function inicializar() {
  await montarPlantilla({
    titulo: 'Banco de Preguntas',
    roles: ['docente', 'admin']
  });

  usuario = usuarioActual();

  ui.cargando(true);
  try {
    const [listaTemas, listaUnidades, listaAsignaturas, distributivo] = await Promise.all([
      api.listar('temas').catch(() => []),
      api.listar('unidades').catch(() => []),
      api.listar('asignaturas').catch(() => []),
      api.listar('distributivo').catch(() => [])
    ]);

    temas = Array.isArray(listaTemas) ? listaTemas : [];
    unidades = Array.isArray(listaUnidades) ? listaUnidades : [];
    asignaturas = Array.isArray(listaAsignaturas) ? listaAsignaturas : [];

    const unidadesMap = new Map(unidades.map((u) => [u.id, u]));
    const asignaturasMap = new Map(asignaturas.map((a) => [a.id, a]));

    // Asociar nombre de asignatura y unidad a cada tema
    temas = temas.map((t) => {
      const u = unidadesMap.get(t.unidadId);
      const a = u ? asignaturasMap.get(u.asignaturaId) : null;
      return {
        ...t,
        asignaturaId: a?.id || '',
        asignaturaNombre: a?.nombre || 'General',
        unidadNombre: u?.titulo || ''
      };
    });

    // Si es docente y tiene asignaturas en distributivo, filtrar opcionalmente
    if (usuario && usuario.rol === 'docente' && Array.isArray(distributivo)) {
      const misGrupos = distributivo.filter((g) => g.docenteId === usuario.id);
      const misAsignaturasIds = new Set(misGrupos.map((g) => g.asignaturaId).filter(Boolean));
      if (misAsignaturasIds.size > 0) {
        const temasDocente = temas.filter((t) => misAsignaturasIds.has(t.asignaturaId));
        if (temasDocente.length > 0) {
          temas = temasDocente;
        }
      }
    }

    // Ordenar temas por Asignatura y luego Título
    temas.sort((a, b) => {
      const compAsig = a.asignaturaNombre.localeCompare(b.asignaturaNombre);
      if (compAsig !== 0) return compAsig;
      return a.titulo.localeCompare(b.titulo);
    });

    // Seleccionar tema por defecto
    const params = new URLSearchParams(window.location.search);
    const paramTema = params.get('temaId');
    if (paramTema && temas.some((t) => t.id === paramTema)) {
      temaSeleccionadoId = paramTema;
    } else if (temas.length > 0) {
      temaSeleccionadoId = temas[0].id;
    }

    renderizarEstructura();

    if (temaSeleccionadoId) {
      await cargarPreguntas();
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar datos del banco de preguntas', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizarEstructura() {
  const main = document.getElementById('contenido');
  if (!main) return;

  main.innerHTML = `
    <div class="banco-contenedor">
      <header class="banco-encabezado">
        <h1>Banco de preguntas</h1>
        <div class="banco-acciones-top">
          <button id="btn-generar-ia" class="btn btn--secundario" type="button">
            ✨ Generar con IA
          </button>
          <button id="btn-nueva-pregunta" class="btn btn--primario" type="button">
            + Nueva pregunta
          </button>
        </div>
      </header>

      <div class="banco-selector-card">
        <label for="select-tema" class="banco-label-tema">Selecciona el tema a gestionar:</label>
        <select id="select-tema" class="banco-select-tema">
          ${
            temas.length === 0
              ? '<option value="">No hay temas disponibles</option>'
              : temas
                  .map(
                    (t) => `
              <option value="${ui.escapar(t.id)}" ${t.id === temaSeleccionadoId ? 'selected' : ''}>
                ${ui.escapar(t.asignaturaNombre)} → ${ui.escapar(t.titulo)}
              </option>
            `
                  )
                  .join('')
          }
        </select>
      </div>

      <nav class="banco-pestanas" role="tablist" aria-label="Niveles de Bloom">
        ${NIVELES_BLOOM.map(
          (n) => `
          <button type="button"
                  role="tab"
                  class="banco-pestana ${n.nivel === nivelActivo ? 'activa' : ''}"
                  id="tab-nivel-${n.nivel}"
                  aria-selected="${n.nivel === nivelActivo}"
                  data-nivel="${n.nivel}">
            ${n.nivel} · ${n.nombre}
          </button>
        `
        ).join('')}
      </nav>

      <section id="contenedor-aviso-cobertura"></section>
      <div id="subtitulo-contador" class="banco-contador-subtitulo"></div>
      <section id="contenedor-preguntas" class="banco-lista" aria-live="polite"></section>
    </div>
  `;

  // Selector de tema
  const selectTema = document.getElementById('select-tema');
  selectTema?.addEventListener('change', async (e) => {
    temaSeleccionadoId = e.target.value;
    const url = new URL(window.location);
    url.searchParams.set('temaId', temaSeleccionadoId);
    window.history.replaceState({}, '', url);
    await cargarPreguntas();
  });

  // Pestañas
  document.querySelectorAll('.banco-pestana').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nivel = parseInt(btn.dataset.nivel, 10);
      cambiarNivel(nivel);
    });
  });

  // Botones principales
  document.getElementById('btn-nueva-pregunta')?.addEventListener('click', () => {
    abrirModalPregunta();
  });

  document.getElementById('btn-generar-ia')?.addEventListener('click', () => {
    abrirModalGenerarIA();
  });
}

function cambiarNivel(nuevoNivel) {
  nivelActivo = nuevoNivel;
  document.querySelectorAll('.banco-pestana').forEach((btn) => {
    const n = parseInt(btn.dataset.nivel, 10);
    const activa = n === nivelActivo;
    btn.classList.toggle('activa', activa);
    btn.setAttribute('aria-selected', activa ? 'true' : 'false');
  });
  renderizarListaPreguntas();
}

async function cargarPreguntas() {
  if (!temaSeleccionadoId) {
    renderizarListaPreguntas();
    return;
  }

  ui.cargando(true);
  try {
    const res = await api.listar('preguntas', { temaId: temaSeleccionadoId });
    preguntas = Array.isArray(res) ? res : [];
    renderizarListaPreguntas();
  } catch (err) {
    ui.aviso(err.message || 'Error al obtener preguntas', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizarListaPreguntas() {
  const contAviso = document.getElementById('contenedor-aviso-cobertura');
  const contSubtitulo = document.getElementById('subtitulo-contador');
  const contPreguntas = document.getElementById('contenedor-preguntas');
  if (!contAviso || !contPreguntas) return;

  const nivelObj = NIVELES_BLOOM.find((n) => n.nivel === nivelActivo) || NIVELES_BLOOM[0];
  const preguntasNivel = preguntas.filter((p) => p.nivel === nivelActivo);
  const aprobadasNivel = preguntasNivel.filter((p) => p.estado === 'aprobado').length;

  // Alerta de cobertura (con estilo exacto de advertencia institucional)
  if (aprobadasNivel < 20) {
    contAviso.innerHTML = `
      <div class="banco-alerta-cobertura" role="alert">
        <span class="banco-alerta-icono">⚠️</span>
        <div>
          <strong>Atención:</strong> Este nivel cuenta con <strong>${aprobadasNivel} de 20 preguntas aprobadas</strong> recomendadas. Se aconseja contar con al menos 20 preguntas para que el quiz evalúe con variedad aleatoria.
        </div>
      </div>
    `;
  } else {
    contAviso.innerHTML = `
      <div class="banco-alerta-cobertura cumplida" role="status">
        <span class="banco-alerta-icono">✓</span>
        <div>
          <strong>Meta cumplida:</strong> Este nivel cuenta con <strong>${aprobadasNivel} preguntas aprobadas</strong> (mínimo de 20 alcanzado).
        </div>
      </div>
    `;
  }

  // Subtítulo con contador
  if (contSubtitulo) {
    contSubtitulo.textContent = `Mostrando ${preguntasNivel.length} pregunta(s) en ${nivelObj.nivel} · ${nivelObj.nombre}`;
  }

  // Estado vacío
  if (preguntasNivel.length === 0) {
    contPreguntas.innerHTML = `
      <div class="banco-vacio">
        <p class="banco-vacio-texto">No hay preguntas registradas en este nivel.</p>
        <button type="button" class="btn btn--secundario" id="btn-crear-primera">
          Crear la primera pregunta
        </button>
      </div>
    `;
    document.getElementById('btn-crear-primera')?.addEventListener('click', () => {
      abrirModalPregunta();
    });
    return;
  }

  // Lista de preguntas
  contPreguntas.innerHTML = preguntasNivel
    .map((p) => {
      const tipoTexto =
        p.tipo === 'opcion'
          ? 'Opción múltiple'
          : p.tipo === 'vf'
          ? 'Verdadero / Falso'
          : 'Completar';

      const estadoClase = p.estado === 'aprobado' ? 'badge--exito' : 'badge--advertencia';
      const origenTexto = p.origen === 'ia' ? 'IA' : 'Manual';

      let cuerpoRespuesta = '';
      if (p.tipo === 'opcion' && Array.isArray(p.opciones)) {
        cuerpoRespuesta = `
          <ul class="tarjeta-pregunta-opciones">
            ${p.opciones
              .map(
                (op, idx) => `
              <li class="tarjeta-pregunta-opcion ${idx === Number(p.correcta) ? 'correcta' : ''}">
                ${idx === Number(p.correcta) ? '✓ ' : '• '} ${ui.escapar(op)}
              </li>
            `
              )
              .join('')}
          </ul>
        `;
      } else if (p.tipo === 'vf') {
        const correctaBool = Boolean(p.correcta);
        cuerpoRespuesta = `
          <div class="tarjeta-pregunta-detalle">
            Respuesta correcta: <strong>${correctaBool ? 'Verdadero' : 'Falso'}</strong>
          </div>
        `;
      } else if (p.tipo === 'completar') {
        cuerpoRespuesta = `
          <div class="tarjeta-pregunta-detalle">
            Respuesta esperada: <strong>${ui.escapar(p.correcta)}</strong>
          </div>
        `;
      }

      return `
        <article class="tarjeta-pregunta" data-id="${ui.escapar(p.id)}">
          <div class="tarjeta-pregunta-encabezado">
            <span class="tarjeta-pregunta-enunciado">${ui.escapar(p.enunciado)}</span>
            <div class="tarjeta-pregunta-meta">
              <span class="badge ${estadoClase}">${ui.escapar(p.estado || 'aprobado')}</span>
              <span class="badge badge--info">${ui.escapar(tipoTexto)}</span>
              <span class="chip">${ui.escapar(origenTexto)}</span>
            </div>
          </div>

          ${cuerpoRespuesta}

          ${
            p.retroalimentacion
              ? `<div class="tarjeta-pregunta-retro">💡 ${ui.escapar(p.retroalimentacion)}</div>`
              : ''
          }

          <div class="tarjeta-pregunta-acciones">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-pregunta" data-id="${ui.escapar(
              p.id
            )}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-pregunta" data-id="${ui.escapar(
              p.id
            )}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  contPreguntas.querySelectorAll('.btn-editar-pregunta').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = preguntas.find((item) => item.id === btn.dataset.id);
      if (p) abrirModalPregunta(p);
    });
  });

  contPreguntas.querySelectorAll('.btn-eliminar-pregunta').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await ui.confirmar('¿Estás seguro de que deseas eliminar esta pregunta?');
      if (ok) {
        ui.cargando(true);
        try {
          await api.eliminar('preguntas', btn.dataset.id);
          ui.aviso('Pregunta eliminada exitosamente', 'exito');
          await cargarPreguntas();
        } catch (err) {
          ui.aviso(err.message || 'Error al eliminar la pregunta', 'error');
        } finally {
          ui.cargando(false);
        }
      }
    });
  });
}

/**
 * Modal para creación o edición de pregunta
 */
function abrirModalPregunta(pregunta = null) {
  if (!temaSeleccionadoId) {
    ui.aviso('Selecciona un tema primero', 'advertencia');
    return;
  }

  const esEdicion = Boolean(pregunta?.id);
  const tipoInicial = pregunta?.tipo || 'opcion';
  const nivelInicial = pregunta?.nivel || nivelActivo;

  const contForm = document.createElement('div');
  contForm.className = 'formulario-pregunta';

  contForm.innerHTML = `
    <div class="campo-fila">
      <label for="form-tipo">Tipo de pregunta:</label>
      <select id="form-tipo" class="control-select">
        <option value="opcion" ${tipoInicial === 'opcion' ? 'selected' : ''}>Opción múltiple</option>
        <option value="vf" ${tipoInicial === 'vf' ? 'selected' : ''}>Verdadero / Falso</option>
        <option value="completar" ${tipoInicial === 'completar' ? 'selected' : ''}>Completar (enunciado con ____)</option>
      </select>
    </div>

    <div class="campo-fila">
      <label for="form-nivel">Nivel cognitivo (Taxonomía de Bloom):</label>
      <select id="form-nivel" class="control-select">
        ${NIVELES_BLOOM.map(
          (n) => `
          <option value="${n.nivel}" ${n.nivel === nivelInicial ? 'selected' : ''}>
            ${n.nivel} · ${n.nombre}
          </option>
        `
        ).join('')}
      </select>
    </div>

    <div class="campo-fila">
      <label for="form-enunciado">Enunciado de la pregunta:</label>
      <textarea id="form-enunciado" class="control-input" rows="3" required placeholder="Escribe el enunciado aquí...">${ui.escapar(
        pregunta?.enunciado || ''
      )}</textarea>
      <small id="form-enunciado-pista" class="texto-suave" style="display: ${
        tipoInicial === 'completar' ? 'block' : 'none'
      };">
        Usa cuatro guiones bajos '____' en el lugar donde el estudiante deba responder.
      </small>
    </div>

    <div id="contenedor-campos-tipo"></div>

    <div class="campo-fila">
      <label for="form-retro">Retroalimentación / Explicación:</label>
      <textarea id="form-retro" class="control-input" rows="2" placeholder="Explica por qué es la respuesta correcta...">${ui.escapar(
        pregunta?.retroalimentacion || ''
      )}</textarea>
    </div>

    <div class="campo-fila">
      <label for="form-estado">Estado:</label>
      <select id="form-estado" class="control-select">
        <option value="aprobado" ${pregunta?.estado === 'borrador' ? '' : 'selected'}>Aprobado</option>
        <option value="borrador" ${pregunta?.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
      </select>
    </div>
  `;

  const contCamposTipo = contForm.querySelector('#contenedor-campos-tipo');

  function renderizarCamposTipo(tipo) {
    if (tipo === 'opcion') {
      const opciones =
        pregunta?.opciones && pregunta.opciones.length === 4
          ? pregunta.opciones
          : ['', '', '', ''];
      const correctaIdx = pregunta?.correcta !== undefined ? Number(pregunta.correcta) : 0;

      contCamposTipo.innerHTML = `
        <div class="campo-fila">
          <label>Opciones de respuesta (marca la correcta):</label>
          ${[0, 1, 2, 3]
            .map(
              (idx) => `
            <div class="campo-opcion-item">
              <input type="radio" name="opcion-correcta" id="rad-opc-${idx}" value="${idx}" ${
                idx === correctaIdx ? 'checked' : ''
              } aria-label="Opción ${idx + 1} correcta">
              <input type="text" class="control-input form-opcion-texto" data-idx="${idx}" value="${ui.escapar(
                opciones[idx] || ''
              )}" placeholder="Opción ${idx + 1}" required>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } else if (tipo === 'vf') {
      const esVerdadero = pregunta?.correcta === true || pregunta?.correcta === 'true';
      contCamposTipo.innerHTML = `
        <div class="campo-fila">
          <label>Respuesta correcta:</label>
          <div style="display: flex; gap: var(--espacio-m);">
            <label style="display: flex; align-items: center; gap: var(--espacio-xs);">
              <input type="radio" name="vf-correcta" value="true" ${esVerdadero ? 'checked' : ''}>
              Verdadero
            </label>
            <label style="display: flex; align-items: center; gap: var(--espacio-xs);">
              <input type="radio" name="vf-correcta" value="false" ${!esVerdadero ? 'checked' : ''}>
              Falso
            </label>
          </div>
        </div>
      `;
    } else if (tipo === 'completar') {
      contCamposTipo.innerHTML = `
        <div class="campo-fila">
          <label for="form-completar-correcta">Respuesta esperada (palabra o frase exacta):</label>
          <input type="text" id="form-completar-correcta" class="control-input" value="${ui.escapar(
            pregunta?.correcta || ''
          )}" placeholder="Ej: Costos fijos" required>
        </div>
      `;
    }
  }

  renderizarCamposTipo(tipoInicial);

  const selectTipo = contForm.querySelector('#form-tipo');
  selectTipo?.addEventListener('change', (e) => {
    const nuevoTipo = e.target.value;
    const pista = contForm.querySelector('#form-enunciado-pista');
    if (pista) {
      pista.style.display = nuevoTipo === 'completar' ? 'block' : 'none';
    }
    renderizarCamposTipo(nuevoTipo);
  });

  ui.modal({
    titulo: esEdicion ? 'Editar Pregunta' : 'Nueva Pregunta',
    contenido: contForm,
    acciones: [
      { texto: 'Cancelar', clase: 'btn--secundario' },
      {
        texto: esEdicion ? 'Guardar Cambios' : 'Crear Pregunta',
        clase: 'btn--primario',
        accion: async () => {
          const tipo = contForm.querySelector('#form-tipo').value;
          const nivel = parseInt(contForm.querySelector('#form-nivel').value, 10);
          const enunciado = contForm.querySelector('#form-enunciado').value.trim();
          const retroalimentacion = contForm.querySelector('#form-retro').value.trim();
          const estado = contForm.querySelector('#form-estado').value;

          if (!enunciado) {
            ui.aviso('El enunciado es obligatorio', 'advertencia');
            return false;
          }

          let opciones = [];
          let correcta;

          if (tipo === 'opcion') {
            const inputsOpciones = contForm.querySelectorAll('.form-opcion-texto');
            opciones = Array.from(inputsOpciones).map((inp) => inp.value.trim());
            if (opciones.some((op) => !op)) {
              ui.aviso('Debes completar las 4 opciones de respuesta', 'advertencia');
              return false;
            }
            const radioSel = contForm.querySelector('input[name="opcion-correcta"]:checked');
            correcta = radioSel ? parseInt(radioSel.value, 10) : 0;
          } else if (tipo === 'vf') {
            opciones = ['Verdadero', 'Falso'];
            const radioSel = contForm.querySelector('input[name="vf-correcta"]:checked');
            correcta = radioSel ? radioSel.value === 'true' : true;
          } else if (tipo === 'completar') {
            const respInp = contForm.querySelector('#form-completar-correcta');
            correcta = respInp?.value.trim() || '';
            if (!correcta) {
              ui.aviso('Debes indicar la respuesta esperada', 'advertencia');
              return false;
            }
            if (!enunciado.includes('____')) {
              ui.aviso("El enunciado debe incluir '____' donde irá la respuesta", 'advertencia');
              return false;
            }
          }

          const datos = {
            temaId: temaSeleccionadoId,
            nivel,
            tipo,
            enunciado,
            opciones,
            correcta,
            retroalimentacion,
            estado
          };

          ui.cargando(true);
          try {
            if (esEdicion) {
              await api.actualizar('preguntas', pregunta.id, datos);
              ui.aviso('Pregunta actualizada correctamente', 'exito');
            } else {
              datos.origen = pregunta?.origen || 'manual';
              await api.crear('preguntas', datos);
              ui.aviso('Pregunta creada exitosamente', 'exito');
            }
            await cargarPreguntas();
            return true;
          } catch (err) {
            ui.aviso(err.message || 'Error al guardar la pregunta', 'error');
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

/**
 * Modal para solicitar generación con IA
 */
function abrirModalGenerarIA() {
  if (!temaSeleccionadoId) {
    ui.aviso('Selecciona un tema primero', 'advertencia');
    return;
  }

  const cont = document.createElement('div');
  cont.innerHTML = `
    <p>Selecciona los parámetros para generar preguntas automáticamente utilizando el contenido y glosario del tema actual.</p>
    <div class="campo-fila" style="margin-top: var(--espacio-m);">
      <label for="ia-nivel">Nivel cognitivo (Bloom):</label>
      <select id="ia-nivel" class="control-select">
        ${NIVELES_BLOOM.map(
          (n) => `
          <option value="${n.nivel}" ${n.nivel === nivelActivo ? 'selected' : ''}>
            ${n.nivel} · ${n.nombre}
          </option>
        `
        ).join('')}
      </select>
    </div>
    <div class="campo-fila" style="margin-top: var(--espacio-m);">
      <label for="ia-cantidad">Cantidad de preguntas a generar (5 a 15):</label>
      <input type="number" id="ia-cantidad" class="control-input" min="5" max="15" value="5">
    </div>
  `;

  ui.modal({
    titulo: 'Generar Preguntas con IA',
    contenido: cont,
    acciones: [
      { texto: 'Cancelar', clase: 'btn--secundario' },
      {
        texto: 'Generar propuestas',
        clase: 'btn--primario',
        accion: async () => {
          const nivel = parseInt(cont.querySelector('#ia-nivel').value, 10);
          const cantidad = Math.max(5, Math.min(15, parseInt(cont.querySelector('#ia-cantidad').value, 10) || 5));

          ui.cargando(true);
          try {
            const propuestas = await api.ia('generar-preguntas', {
              temaId: temaSeleccionadoId,
              nivel,
              cantidad
            });

            if (!Array.isArray(propuestas) || propuestas.length === 0) {
              ui.aviso('No se recibieron propuestas de preguntas', 'advertencia');
              return false;
            }

            mostrarPropuestasIA(propuestas, nivel);
            return true;
          } catch (err) {
            ui.aviso(err.message || 'Error al generar preguntas con IA', 'error');
            return false;
          } finally {
            ui.cargando(false);
          }
        }
      }
    ]
  });
}

/**
 * Modal de revisión de propuestas generadas por IA
 */
function mostrarPropuestasIA(propuestasOriginales, nivel) {
  let listaPropuestas = propuestasOriginales.map((p, idx) => ({
    ...p,
    _tempId: `prop_${idx}`,
    aprobada: false
  }));

  const contPropuestas = document.createElement('div');
  contPropuestas.style.maxHeight = '65vh';
  contPropuestas.style.overflowY = 'auto';
  contPropuestas.style.paddingRight = 'var(--espacio-xs)';

  function renderizarPropuestas() {
    if (listaPropuestas.length === 0) {
      contPropuestas.innerHTML = `
        <p class="texto-suave" style="text-align: center; padding: var(--espacio-l);">
          No quedan propuestas pendientes.
        </p>
      `;
      return;
    }

    contPropuestas.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espacio-m); flex-wrap: wrap; gap: var(--espacio-s);">
        <span class="texto-suave">${listaPropuestas.filter((p) => !p.aprobada).length} propuestas pendientes de revisión.</span>
        <button type="button" id="btn-aprobar-todas" class="btn btn--primario btn--pequeno">
          ✓ Aprobar todas las restantes
        </button>
      </div>
      ${listaPropuestas
        .map((p) => {
          const tipoTexto =
            p.tipo === 'opcion'
              ? 'Opción múltiple'
              : p.tipo === 'vf'
              ? 'Verdadero / Falso'
              : 'Completar';

          let detalle = '';
          if (p.tipo === 'opcion' && Array.isArray(p.opciones)) {
            detalle = `
              <ul class="tarjeta-pregunta-opciones">
                ${p.opciones
                  .map(
                    (op, i) => `
                  <li class="tarjeta-pregunta-opcion ${i === Number(p.correcta) ? 'correcta' : ''}">
                    ${i === Number(p.correcta) ? '✓ ' : '• '} ${ui.escapar(op)}
                  </li>
                `
                  )
                  .join('')}
              </ul>
            `;
          } else if (p.tipo === 'vf') {
            detalle = `<div class="tarjeta-pregunta-detalle">Respuesta: <strong>${p.correcta ? 'Verdadero' : 'Falso'}</strong></div>`;
          } else {
            detalle = `<div class="tarjeta-pregunta-detalle">Respuesta esperada: <strong>${ui.escapar(p.correcta)}</strong></div>`;
          }

          return `
            <div class="propuesta-tarjeta ${p.aprobada ? 'aprobada' : ''}" data-tempid="${p._tempId}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--espacio-s);">
                <strong>${ui.escapar(p.enunciado)}</strong>
                <span class="badge badge--info">${ui.escapar(tipoTexto)}</span>
              </div>
              ${detalle}
              <div class="tarjeta-pregunta-retro">💡 ${ui.escapar(p.retroalimentacion || '')}</div>
              <div class="propuesta-acciones">
                ${
                  p.aprobada
                    ? `<span class="badge badge--exito">✓ Guardada</span>`
                    : `
                  <button type="button" class="btn btn--primario btn--pequeno btn-aprobar-propuesta" data-tempid="${p._tempId}">
                    Aprobar
                  </button>
                  <button type="button" class="btn btn--secundario btn--pequeno btn-editar-propuesta" data-tempid="${p._tempId}">
                    Editar
                  </button>
                  <button type="button" class="btn btn--peligro btn--pequeno btn-descartar-propuesta" data-tempid="${p._tempId}">
                    Descartar
                  </button>
                `
                }
              </div>
            </div>
          `;
        })
        .join('')}
    `;

    contPropuestas.querySelector('#btn-aprobar-todas')?.addEventListener('click', async () => {
      const pendientes = listaPropuestas.filter((p) => !p.aprobada);
      if (pendientes.length === 0) return;

      ui.cargando(true);
      try {
        for (const prop of pendientes) {
          await api.crear('preguntas', {
            temaId: temaSeleccionadoId,
            nivel,
            tipo: prop.tipo,
            enunciado: prop.enunciado,
            opciones: prop.opciones || [],
            correcta: prop.correcta,
            retroalimentacion: prop.retroalimentacion || '',
            origen: 'ia',
            estado: 'aprobado'
          });
          prop.aprobada = true;
        }
        ui.aviso(`Se aprobaron y guardaron ${pendientes.length} preguntas`, 'exito');
        await cargarPreguntas();
        renderizarPropuestas();
      } catch (err) {
        ui.aviso(err.message || 'Error al guardar algunas propuestas', 'error');
      } finally {
        ui.cargando(false);
      }
    });

    contPropuestas.querySelectorAll('.btn-aprobar-propuesta').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tempId = btn.dataset.tempid;
        const prop = listaPropuestas.find((p) => p._tempId === tempId);
        if (!prop) return;

        ui.cargando(true);
        try {
          await api.crear('preguntas', {
            temaId: temaSeleccionadoId,
            nivel,
            tipo: prop.tipo,
            enunciado: prop.enunciado,
            opciones: prop.opciones || [],
            correcta: prop.correcta,
            retroalimentacion: prop.retroalimentacion || '',
            origen: 'ia',
            estado: 'aprobado'
          });
          prop.aprobada = true;
          ui.aviso('Pregunta aprobada y guardada', 'exito');
          await cargarPreguntas();
          renderizarPropuestas();
        } catch (err) {
          ui.aviso(err.message || 'Error al guardar la propuesta', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });

    contPropuestas.querySelectorAll('.btn-descartar-propuesta').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tempId = btn.dataset.tempid;
        listaPropuestas = listaPropuestas.filter((p) => p._tempId !== tempId);
        renderizarPropuestas();
      });
    });

    contPropuestas.querySelectorAll('.btn-editar-propuesta').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tempId = btn.dataset.tempid;
        const prop = listaPropuestas.find((p) => p._tempId === tempId);
        if (!prop) return;
        abrirModalPregunta({
          ...prop,
          nivel,
          origen: 'ia',
          estado: 'aprobado'
        });
      });
    });
  }

  renderizarPropuestas();

  ui.modal({
    titulo: `Propuestas de Preguntas con IA (Nivel ${nivel})`,
    contenido: contPropuestas,
    acciones: [{ texto: 'Cerrar revisión', clase: 'btn--secundario' }]
  });
}

inicializar();
