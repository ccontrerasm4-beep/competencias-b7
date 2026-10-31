import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Panel Docente", roles: ["docente", "admin"] });

/**
 * Carga dinámicamente Chart.js si no se encuentra disponible.
 */
async function asegurarChartJS() {
  if (typeof window !== 'undefined' && window.Chart) {
    return window.Chart;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    script.onload = () => {
      if (window.Chart) resolve(window.Chart);
      else reject(new Error('No se pudo inicializar Chart.js'));
    };
    script.onerror = () => reject(new Error('Error al cargar Chart.js'));
    document.head.appendChild(script);
  });
}

function obtenerColoresTema() {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return {
      primario: '#002e45',
      secundario: '#264763',
      acento: '#ff6900',
      textoSuave: '#526677',
      borde: '#dfe7ec'
    };
  }
  const estilos = getComputedStyle(document.documentElement);
  return {
    primario: estilos.getPropertyValue('--color-primario').trim() || '#002e45',
    secundario: estilos.getPropertyValue('--color-secundario').trim() || '#264763',
    acento: estilos.getPropertyValue('--color-acento').trim() || '#ff6900',
    textoSuave: estilos.getPropertyValue('--color-texto-suave').trim() || '#526677',
    borde: estilos.getPropertyValue('--color-borde').trim() || '#dfe7ec'
  };
}

const contenido = document.getElementById('contenido');

if (contenido) {
  iniciarPanelDocente();
}

let graficoPorTemaInstancia = null;
let estudiantesActuales = [];
let grupoActual = null;
let columnaOrdenActual = 'nombre';
let ordenAscendente = true;

async function iniciarPanelDocente() {
  try {
    ui.cargando(true);
    const usuario = usuarioActual();

    // 1. Cargar grupos del distributivo y asignaturas
    const [distributivo, asignaturas] = await Promise.all([
      api.listar('distributivo'),
      api.listar('asignaturas')
    ]);

    const asignaturasMap = new Map(asignaturas.map((a) => [a.id, a]));

    // Filtrar grupos según rol: docente solo ve los suyos, admin todos
    const misGrupos =
      usuario?.rol === 'admin'
        ? distributivo
        : distributivo.filter((g) => g.docenteId === usuario?.id);

    if (misGrupos.length === 0) {
      contenido.innerHTML = `
        <div class="panel-docente-contenedor">
          <div class="vacio" style="padding: var(--espacio-2xl);">
            <span class="vacio__icono" aria-hidden="true">📋</span>
            <h2 class="vacio__titulo">Sin grupos asignados</h2>
            <p class="vacio__descripcion">No tienes grupos registrados en el distributivo académico.</p>
          </div>
        </div>
      `;
      return;
    }

    // Seleccionar grupo por parámetro de URL o el primero disponible
    const paramGrupoId = util.parametro('grupoId');
    const grupoInicial = misGrupos.find((g) => g.id === paramGrupoId) || misGrupos[0];

    contenido.innerHTML = `
      <div class="panel-docente-contenedor">
        <header class="panel-docente-cabecera">
          <div class="panel-docente-selector">
            <label for="selectorGrupo">Seleccionar Grupo / Asignatura:</label>
            <select id="selectorGrupo">
              ${misGrupos
                .map((g) => {
                  const asig = asignaturasMap.get(g.asignaturaId);
                  const nombreAsig = asig ? asig.nombre : 'Asignatura';
                  const seleccionado = g.id === grupoInicial.id ? 'selected' : '';
                  return `<option value="${ui.escapar(g.id)}" ${seleccionado}>${ui.escapar(nombreAsig)} - Paralelo ${ui.escapar(g.paralelo || 'A')} (${ui.escapar(g.periodo || 'Periodo')})</option>`;
                })
                .join('')}
            </select>
          </div>

          <div class="fila" style="gap: var(--espacio-s);">
            <button type="button" class="btn btn--primario" id="btnExportarCSV">
              Exportar CSV
            </button>
          </div>
        </header>

        <!-- Gráfico de promedio por tema -->
        <section class="tarjeta" aria-label="Rendimiento del grupo por tema">
          <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-m);">
            <div>
              <h2>Promedio por Tema</h2>
              <p style="color: var(--color-texto-suave); font-size: var(--tamano-xs); margin: 0;">
                Calificación media obtenida por los estudiantes en cada tema evaluado.
              </p>
            </div>
          </div>
          <div class="grafico-contenedor" id="contenedorGraficoTema">
            <canvas id="canvasGraficoTema" role="img" aria-label="Gráfico de barras de promedio por tema"></canvas>
          </div>
        </section>

        <!-- Tabla de estudiantes del grupo -->
        <section class="tarjeta" aria-label="Listado de estudiantes y rendimiento">
          <div class="fila" style="justify-content: space-between; align-items: baseline; margin-bottom: var(--espacio-m); flex-wrap: wrap; gap: var(--espacio-s);">
            <div>
              <h2>Estudiantes del Grupo</h2>
              <p style="color: var(--color-texto-suave); font-size: var(--tamano-xs); margin: 0;">
                Haz clic en el encabezado de cualquier columna para ordenar o en una fila para ver el detalle individual.
              </p>
            </div>
            <span class="chip" id="chipTotalEstudiantes" style="font-weight: var(--peso-seminegrita);">0 estudiantes</span>
          </div>

          <div class="tabla-contenedor">
            <table class="tabla" id="tablaEstudiantes" aria-label="Tabla de calificaciones y avance de estudiantes">
              <thead>
                <tr>
                  <th class="th-ordenable" data-col="nombre" tabindex="0" role="columnheader" aria-sort="none">
                    <span class="th-ordenable__contenido">
                      Estudiante <span class="icono-orden" aria-hidden="true">↕</span>
                    </span>
                  </th>
                  <th class="th-ordenable" data-col="promedio" tabindex="0" role="columnheader" aria-sort="none">
                    <span class="th-ordenable__contenido">
                      Promedio <span class="icono-orden" aria-hidden="true">↕</span>
                    </span>
                  </th>
                  <th class="th-ordenable" data-col="actividades" tabindex="0" role="columnheader" aria-sort="none">
                    <span class="th-ordenable__contenido">
                      Actividades <span class="icono-orden" aria-hidden="true">↕</span>
                    </span>
                  </th>
                  <th class="th-ordenable" data-col="pctTemas" tabindex="0" role="columnheader" aria-sort="none">
                    <span class="th-ordenable__contenido">
                      % Temas <span class="icono-orden" aria-hidden="true">↕</span>
                    </span>
                  </th>
                  <th class="th-ordenable" data-col="ultimaConexion" tabindex="0" role="columnheader" aria-sort="none">
                    <span class="th-ordenable__contenido">
                      Última Conexión <span class="icono-orden" aria-hidden="true">↕</span>
                    </span>
                  </th>
                  <th class="th-ordenable" data-col="alertasActivas" tabindex="0" role="columnheader" aria-sort="none">
                    <span class="th-ordenable__contenido">
                      Alertas <span class="icono-orden" aria-hidden="true">↕</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody id="tbodyEstudiantes">
                <tr>
                  <td colspan="6" style="text-align: center; color: var(--color-texto-suave); padding: var(--espacio-l);">
                    Cargando datos del grupo...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    // Eventos de controles
    const selectGrupo = document.getElementById('selectorGrupo');
    selectGrupo.addEventListener('change', () => {
      cargarDatosGrupo(selectGrupo.value);
    });

    const btnExportar = document.getElementById('btnExportarCSV');
    btnExportar.addEventListener('click', () => {
      exportarCSV();
    });

    // Configurar ordenamiento en los encabezados
    configurarOrdenamientoTabla();

    // Cargar grupo inicial
    await cargarDatosGrupo(grupoInicial.id);
  } catch (err) {
    ui.aviso(err.message || 'Error al iniciar el panel docente', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Consulta y renderiza los datos del grupo seleccionado.
 * @param {string} grupoId ID del grupo
 */
async function cargarDatosGrupo(grupoId) {
  if (!grupoId) return;

  try {
    ui.cargando(true);
    const resumen = await api.llamar('GET', `/api/resumen/grupo/${encodeURIComponent(grupoId)}`);

    grupoActual = resumen?.grupo || null;
    estudiantesActuales = Array.isArray(resumen?.estudiantes) ? resumen.estudiantes : [];
    const porTema = Array.isArray(resumen?.porTema) ? resumen.porTema : [];

    // Actualizar chip contador
    const chipTotal = document.getElementById('chipTotalEstudiantes');
    if (chipTotal) {
      chipTotal.textContent = `${estudiantesActuales.length} ${estudiantesActuales.length === 1 ? 'estudiante' : 'estudiantes'}`;
    }

    // Renderizar tabla ordenada
    renderizarTablaEstudiantes();

    // Renderizar gráfico de temas
    await renderizarGraficoTemas(porTema);
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar los datos del grupo', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Configura los encabezados clickeables para ordenar las columnas de la tabla.
 */
function configurarOrdenamientoTabla() {
  const encabezados = document.querySelectorAll('.th-ordenable');
  encabezados.forEach((th) => {
    const columna = th.dataset.col;

    const ejecutarOrden = () => {
      if (columnaOrdenActual === columna) {
        ordenAscendente = !ordenAscendente;
      } else {
        columnaOrdenActual = columna;
        ordenAscendente = true;
      }

      encabezados.forEach((h) => {
        h.setAttribute('aria-sort', 'none');
        const icon = h.querySelector('.icono-orden');
        if (icon) icon.textContent = '↕';
      });

      th.setAttribute('aria-sort', ordenAscendente ? 'ascending' : 'descending');
      const icon = th.querySelector('.icono-orden');
      if (icon) icon.textContent = ordenAscendente ? '▲' : '▼';

      renderizarTablaEstudiantes();
    };

    th.addEventListener('click', ejecutarOrden);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ejecutarOrden();
      }
    });
  });
}

/**
 * Dibuja las filas de estudiantes ordenadas en la tabla.
 */
function renderizarTablaEstudiantes() {
  const tbody = document.getElementById('tbodyEstudiantes');
  if (!tbody) return;

  if (estudiantesActuales.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--color-texto-suave); padding: var(--espacio-l);">
          No hay estudiantes matriculados en este grupo.
        </td>
      </tr>
    `;
    return;
  }

  // Ordenar lista de estudiantes según columna actual
  const copia = [...estudiantesActuales].sort((a, b) => {
    let valorA = a[columnaOrdenActual];
    let valorB = b[columnaOrdenActual];

    if (columnaOrdenActual === 'nombre') {
      const nomA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
      const nomB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
      return ordenAscendente ? nomA.localeCompare(nomB) : nomB.localeCompare(nomA);
    }

    if (columnaOrdenActual === 'ultimaConexion') {
      const fA = valorA ? new Date(valorA).getTime() : 0;
      const fB = valorB ? new Date(valorB).getTime() : 0;
      return ordenAscendente ? fA - fB : fB - fA;
    }

    const numA = Number(valorA) || 0;
    const numB = Number(valorB) || 0;
    return ordenAscendente ? numA - numB : numB - numA;
  });

  tbody.innerHTML = copia
    .map((e) => {
      const tieneAlertas = Number(e.alertasActivas) > 0;
      const claseFila = tieneAlertas ? 'fila-estudiante fila-alerta' : 'fila-estudiante';
      const fechaConexion = e.ultimaConexion ? util.fechaLarga(e.ultimaConexion) : 'Sin registro';

      return `
        <tr class="${claseFila}" data-id="${ui.escapar(e.id)}" tabindex="0" role="button" aria-label="Ver detalles de ${ui.escapar(e.nombre)} ${ui.escapar(e.apellido)}">
          <td>
            <button type="button" class="btn-estudiante-nombre" data-id="${ui.escapar(e.id)}">
              ${ui.escapar(e.nombre)} ${ui.escapar(e.apellido)}
            </button>
          </td>
          <td><strong>${e.promedio}</strong> / 10</td>
          <td>${e.actividades}</td>
          <td>${e.pctTemas}%</td>
          <td style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">${ui.escapar(fechaConexion)}</td>
          <td>
            <button type="button" class="btn-chip-alerta ${tieneAlertas ? 'btn-chip-alerta--activa' : 'btn-chip-alerta--ok'} btn-ver-alertas" data-id="${ui.escapar(e.id)}" title="${tieneAlertas ? 'Ver alertas pedagógicas' : 'Sin alertas activas'}" aria-label="${e.alertasActivas} alertas de ${ui.escapar(e.nombre)}">
              ${tieneAlertas ? `⚠️ ${e.alertasActivas}` : '✓ 0'}
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  // Evento para abrir modal de alertas al hacer clic en el chip de alertas
  tbody.querySelectorAll('.btn-ver-alertas').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      mostrarModalAlertasEstudiante(id);
    });
  });

  // Eventos para abrir el modal del estudiante al hacer clic en la fila o botón
  tbody.querySelectorAll('tr.fila-estudiante').forEach((fila) => {
    const id = fila.dataset.id;
    const abrirModal = () => mostrarModalEstudiante(id);

    fila.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModal();
    });

    fila.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirModal();
      }
    });
  });
}

/**
 * Dibuja el gráfico de barras con el promedio de cada tema evaluado.
 * @param {Array} porTema Lista de temas con promedio e intentos
 */
async function renderizarGraficoTemas(porTema = []) {
  const contenedor = document.getElementById('contenedorGraficoTema');
  if (!contenedor) return;

  if (graficoPorTemaInstancia) {
    graficoPorTemaInstancia.destroy();
    graficoPorTemaInstancia = null;
  }

  if (porTema.length === 0) {
    contenedor.innerHTML = `
      <div class="vacio">
        <span class="vacio__icono" aria-hidden="true">📊</span>
        <h3 class="vacio__titulo">Sin datos de temas</h3>
        <p class="vacio__descripcion">Aún no se registran actividades evaluadas en los temas de este grupo.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `<canvas id="canvasGraficoTema" role="img" aria-label="Promedio por tema"></canvas>`;
  const canvas = document.getElementById('canvasGraficoTema');

  try {
    const ChartClass = await asegurarChartJS();
    const colores = obtenerColoresTema();

    const etiquetas = porTema.map((t) => t.titulo || 'Tema');
    const datos = porTema.map((t) => Number(t.promedio) || 0);

    graficoPorTemaInstancia = new ChartClass(canvas, {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [
          {
            label: 'Promedio del tema',
            data: datos,
            backgroundColor: colores.secundario,
            hoverBackgroundColor: colores.acento,
            borderRadius: 6,
            maxBarThickness: 50
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `Promedio: ${ctx.parsed.y} / 10 (${porTema[ctx.dataIndex]?.intentos || 0} intentos)`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 10,
            ticks: { stepSize: 2, color: colores.textoSuave },
            grid: { color: colores.borde }
          },
          x: {
            ticks: {
              color: colores.textoSuave,
              maxRotation: 45,
              minRotation: 0,
              callback: function (val, index) {
                const label = this.getLabelForValue(val);
                return label.length > 20 ? label.slice(0, 18) + '...' : label;
              }
            },
            grid: { display: false }
          }
        }
      }
    });
  } catch (err) {
    console.warn('No se pudo inicializar el gráfico de temas:', err);
  }
}

/**
 * Abre un modal con el resumen detallado del estudiante y sus últimos 20 intentos.
 * @param {string} estudianteId ID del estudiante
 */
async function mostrarModalEstudiante(estudianteId) {
  if (!estudianteId) return;

  try {
    ui.cargando(true);
    const resumen = await api.llamar('GET', `/api/resumen/estudiante/${encodeURIComponent(estudianteId)}`);

    const estBase = estudiantesActuales.find((e) => e.id === estudianteId) || {};
    const nombreCompleto = `${estBase.nombre || 'Estudiante'} ${estBase.apellido || ''}`.trim();

    const ultimosIntentos = Array.isArray(resumen?.ultimosIntentos) ? resumen.ultimosIntentos : [];
    const ultimaConexion = resumen?.ultimaConexion ? util.fechaLarga(resumen.ultimaConexion) : 'Sin registro';

    const modalContenido = document.createElement('div');
    modalContenido.className = 'modal-estudiante';
    modalContenido.innerHTML = `
      <div class="modal-estudiante-metricas">
        <div class="modal-estudiante-caja">
          <span class="modal-estudiante-caja__val">${resumen?.puntos || 0}</span>
          <span class="modal-estudiante-caja__lbl">Puntos Totales</span>
        </div>
        <div class="modal-estudiante-caja">
          <span class="modal-estudiante-caja__val">${resumen?.nivelQuizMax || 0}</span>
          <span class="modal-estudiante-caja__lbl">Nivel Quiz</span>
        </div>
        <div class="modal-estudiante-caja">
          <span class="modal-estudiante-caja__val">${resumen?.pctTemas || 0}%</span>
          <span class="modal-estudiante-caja__lbl">% Temas</span>
        </div>
        <div class="modal-estudiante-caja">
          <span class="modal-estudiante-caja__val">${resumen?.promedio || 0} / 10</span>
          <span class="modal-estudiante-caja__lbl">Promedio</span>
        </div>
        <div class="modal-estudiante-caja">
          <span class="modal-estudiante-caja__val">${resumen?.tiempoMin || 0} min</span>
          <span class="modal-estudiante-caja__lbl">Tiempo Total</span>
        </div>
      </div>

      <div style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin-bottom: var(--espacio-xs);">
        <strong>Última conexión:</strong> ${ui.escapar(ultimaConexion)}
      </div>

      <div>
        <h4 style="margin-bottom: var(--espacio-s);">Últimos 20 Intentos</h4>
        <div class="tabla-contenedor" style="max-height: 280px; overflow-y: auto;">
          <table class="tabla tabla--compacta" style="font-size: var(--tamano-xs);">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actividad</th>
                <th>Calificación</th>
                <th>Errores</th>
                <th>Duración</th>
              </tr>
            </thead>
            <tbody>
              ${
                ultimosIntentos.length === 0
                  ? `<tr><td colspan="5" style="text-align: center; color: var(--color-texto-suave);">No hay intentos registrados.</td></tr>`
                  : ultimosIntentos
                      .map((i) => {
                        const fechaStr = i.fecha ? util.fechaRelativa(i.fecha) : '—';
                        return `
                          <tr>
                            <td>${ui.escapar(fechaStr)}</td>
                            <td>${ui.escapar(i.actividad)}</td>
                            <td><strong>${i.puntaje || 0}</strong> / ${i.maximo || 0}</td>
                            <td>${i.errores || 0}</td>
                            <td>${i.duracionSeg || 0}s</td>
                          </tr>
                        `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    await ui.modal({
      titulo: `Progreso: ${nombreCompleto}`,
      contenido: modalContenido,
      acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn btn--primario' }]
    });
  } catch (err) {
    ui.aviso(err.message || 'No se pudo cargar el resumen del estudiante', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Abre un modal con las alertas del estudiante y permite enviar mensajes de apoyo
 * o marcar alertas como atendidas.
 * @param {string} estudianteId ID del estudiante
 */
async function mostrarModalAlertasEstudiante(estudianteId) {
  if (!estudianteId || !grupoActual) return;

  try {
    ui.cargando(true);
    const { alertas, mensajesApoyo } = await api.llamar(
      'GET',
      `/api/alertas?grupoId=${encodeURIComponent(grupoActual.id)}`
    );

    const estBase = estudiantesActuales.find((e) => e.id === estudianteId) || {};
    const nombreCompleto = `${estBase.nombre || 'Estudiante'} ${estBase.apellido || ''}`.trim();

    const alertasEstudiante = (alertas || []).filter((a) => a.estudianteId === estudianteId);

    const nombresReglas = {
      promedioBajo: 'Promedio Bajo',
      fallosQuiz: 'Dificultad en Quiz',
      inactividad: 'Inactividad Prolongada',
      vencidas: 'Actividades Vencidas'
    };

    const modalContenido = document.createElement('div');
    modalContenido.className = 'modal-estudiante';
    modalContenido.innerHTML = `
      <div style="font-size: var(--tamano-s); color: var(--color-texto-suave); margin-bottom: var(--espacio-xs);">
        Seguimiento de alertas pedagógicas y apoyo académico personalizado.
      </div>

      <!-- Listado de alertas -->
      <div class="pila" style="gap: var(--espacio-s);">
        <h4 style="margin: 0;">Alertas del Estudiante</h4>
        <div id="listaAlertasModal" class="pila" style="gap: var(--espacio-xs); max-height: 220px; overflow-y: auto;">
          ${
            alertasEstudiante.length === 0
              ? `<div class="vacio" style="padding: var(--espacio-m);"><p class="vacio__descripcion" style="margin: 0;">No hay alertas activas para este estudiante.</p></div>`
              : alertasEstudiante
                  .map((a) => {
                    const esActiva = a.estado === 'activa';
                    const reglaTitulo = nombresReglas[a.regla] || a.regla;
                    const claseAlerta = esActiva
                      ? 'alerta-tarjeta-item alerta-tarjeta-item--activa'
                      : 'alerta-tarjeta-item alerta-tarjeta-item--atendida';

                    const estadoBadge = esActiva
                      ? `<span class="insignia-alerta">Activa</span>`
                      : `<span class="chip" style="color: var(--color-exito);">Atendida</span>`;

                    const btnAccion = esActiva
                      ? `<button type="button" class="btn btn--secundario btn--pequeno btn-atender-alerta" data-alerta-id="${ui.escapar(a.id)}">Marcar como atendida</button>`
                      : '';

                    return `
                      <article class="${claseAlerta}">
                        <div class="alerta-tarjeta-cabecera">
                          <h5 class="alerta-tarjeta-titulo">${ui.escapar(reglaTitulo)}</h5>
                          <div class="fila" style="gap: var(--espacio-xs); align-items: center;">
                            ${estadoBadge}
                            ${btnAccion}
                          </div>
                        </div>
                        <p class="alerta-tarjeta-desc">${ui.escapar(a.detalle || '')}</p>
                      </article>
                    `;
                  })
                  .join('')
          }
        </div>
      </div>

      <!-- Enviar mensaje de apoyo -->
      <section class="tarjeta" style="background-color: var(--color-fondo); border: 1px solid var(--color-borde); padding: var(--espacio-m); margin-top: var(--espacio-s);">
        <h4 style="margin-top: 0; margin-bottom: var(--espacio-xs); color: var(--color-primario);">
          Enviar Mensaje de Apoyo
        </h4>
        <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin-bottom: var(--espacio-s);">
          Envía un mensaje motivacional directo a la campana de notificaciones del estudiante.
        </p>

        <div class="campo" style="margin-bottom: var(--espacio-s);">
          <label for="selectMensajePredefinido">Mensajes recomendados:</label>
          <select id="selectMensajePredefinido" style="font-size: var(--tamano-s);">
            <option value="">-- Elige un mensaje de apoyo predefinido --</option>
            ${(mensajesApoyo || [])
              .map((m) => `<option value="${ui.escapar(m)}">${ui.escapar(m)}</option>`)
              .join('')}
          </select>
        </div>

        <div class="campo" style="margin-bottom: var(--espacio-s);">
          <label for="textoMensajePersonalizado">Mensaje:</label>
          <textarea id="textoMensajePersonalizado" rows="3" placeholder="Escribe un mensaje de aliento y orientación pedagógica..." style="font-size: var(--tamano-s);"></textarea>
        </div>

        <div class="fila" style="justify-content: flex-end;">
          <button type="button" class="btn btn--primario btn--pequeno" id="btnEnviarMensajeApoyo">
            Enviar mensaje de apoyo
          </button>
        </div>
      </section>
    `;

    // Evento de selección de mensaje predefinido
    const selectMsg = modalContenido.querySelector('#selectMensajePredefinido');
    const textareaMsg = modalContenido.querySelector('#textoMensajePersonalizado');
    selectMsg.addEventListener('change', () => {
      if (selectMsg.value) {
        textareaMsg.value = selectMsg.value;
      }
    });

    // Evento para enviar mensaje de apoyo
    const btnEnviar = modalContenido.querySelector('#btnEnviarMensajeApoyo');
    btnEnviar.addEventListener('click', async () => {
      const texto = textareaMsg.value.trim();
      if (!texto) {
        ui.aviso('Escribe o selecciona un mensaje de apoyo antes de enviar', 'advertencia');
        return;
      }

      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Enviando...';

      try {
        await api.llamar('POST', '/api/notificaciones', {
          usuarioId: estudianteId,
          mensaje: texto,
          enlace: '/paginas/mi-progreso.html'
        });
        ui.aviso('Mensaje de apoyo enviado al estudiante con éxito', 'exito');
        textareaMsg.value = '';
        selectMsg.value = '';
      } catch (err) {
        ui.aviso(err.message || 'No se pudo enviar el mensaje', 'error');
      } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar mensaje de apoyo';
      }
    });

    // Eventos para marcar alertas como atendidas
    modalContenido.querySelectorAll('.btn-atender-alerta').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const alertaId = btn.dataset.alertaId;
        btn.disabled = true;
        btn.textContent = 'Actualizando...';

        try {
          await api.actualizar('alertas', alertaId, { estado: 'atendida' });
          ui.aviso('Alerta marcada como atendida', 'exito');
          await cargarDatosGrupo(grupoActual.id);
          const article = btn.closest('.alerta-tarjeta-item');
          if (article) {
            article.className = 'alerta-tarjeta-item alerta-tarjeta-item--atendida';
            const cabecera = article.querySelector('.alerta-tarjeta-cabecera .fila');
            if (cabecera) {
              cabecera.innerHTML = `<span class="chip" style="color: var(--color-exito);">Atendida</span>`;
            }
          }
        } catch (err) {
          ui.aviso(err.message || 'Error al actualizar alerta', 'error');
          btn.disabled = false;
          btn.textContent = 'Marcar como atendida';
        }
      });
    });

    await ui.modal({
      titulo: `Alertas de ${nombreCompleto}`,
      contenido: modalContenido,
      acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn btn--primario' }]
    });
  } catch (err) {
    ui.aviso(err.message || 'No se pudieron cargar las alertas del estudiante', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Escapa un valor para incluirlo de forma segura en formato CSV.
 */
function escaparCampoCSV(valor) {
  if (valor === null || valor === undefined) return '""';
  const texto = String(valor).replace(/"/g, '""');
  return `"${texto}"`;
}

/**
 * Exporta los datos de los estudiantes del grupo en formato CSV (punto y coma, UTF-8 con BOM).
 */
function exportarCSV() {
  if (estudiantesActuales.length === 0) {
    ui.aviso('No hay estudiantes para exportar en este grupo', 'advertencia');
    return;
  }

  const cabeceras = [
    'Estudiante',
    'Promedio',
    'Actividades',
    '% Temas',
    'Última conexión',
    'Alertas activas'
  ];

  const filas = estudiantesActuales.map((e) => {
    const nombreCompleto = `${e.nombre || ''} ${e.apellido || ''}`.trim();
    const conexionStr = e.ultimaConexion ? util.fechaLarga(e.ultimaConexion) : 'Sin conexión';

    return [
      escaparCampoCSV(nombreCompleto),
      escaparCampoCSV(e.promedio),
      escaparCampoCSV(e.actividades),
      escaparCampoCSV(`${e.pctTemas}%`),
      escaparCampoCSV(conexionStr),
      escaparCampoCSV(e.alertasActivas)
    ].join(';');
  });

  // UTF-8 BOM para correcta visualización de tildes y caracteres especiales en Excel
  const contenidoCSV = '\uFEFF' + cabeceras.join(';') + '\r\n' + filas.join('\r\n');

  const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  const fechaHoy = new Date().toISOString().slice(0, 10);
  const idGrupo = grupoActual?.id || 'grupo';

  enlace.href = url;
  enlace.download = `resumen-${idGrupo}-${fechaHoy}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);

  ui.aviso('Archivo CSV exportado con éxito', 'exito');
}

