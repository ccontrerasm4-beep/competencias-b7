import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Mi Progreso", roles: ["estudiante"] });

const NOMBRES_ACTIVIDADES = {
  ahorcado: 'Ahorcado',
  pareja: 'Encuentra la pareja',
  'sopa-letras': 'Sopa de letras',
  crucigrama: 'Crucigrama',
  quiz: 'Quiz evaluativo',
  simulacion: 'Simulador'
};

/**
 * Carga dinámicamente Chart.js si no se encuentra disponible en window.
 * @returns {Promise<Function>} Constructor de Chart.js
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
    script.onerror = () => reject(new Error('Error al cargar Chart.js desde CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Obtiene los valores reales de los tokens CSS para los gráficos.
 */
function obtenerColoresTema() {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return {
      primario: '#002e45',
      secundario: '#264763',
      acento: '#ff6900',
      texto: '#182d3e',
      textoSuave: '#526677',
      borde: '#dfe7ec'
    };
  }
  const estilos = getComputedStyle(document.documentElement);
  return {
    primario: estilos.getPropertyValue('--color-primario').trim() || '#002e45',
    secundario: estilos.getPropertyValue('--color-secundario').trim() || '#264763',
    acento: estilos.getPropertyValue('--color-acento').trim() || '#ff6900',
    texto: estilos.getPropertyValue('--color-texto').trim() || '#182d3e',
    textoSuave: estilos.getPropertyValue('--color-texto-suave').trim() || '#526677',
    borde: estilos.getPropertyValue('--color-borde').trim() || '#dfe7ec'
  };
}

const contenido = document.getElementById('contenido');

if (contenido) {
  try {
    ui.cargando(true);
    const resumen = await api.llamar('GET', '/api/resumen/estudiante/yo');

    const puntos = Number(resumen?.puntos || 0);
    const nivelQuiz = Number(resumen?.nivelQuizMax || 0);
    const pctTemas = Number(resumen?.pctTemas || 0);
    const promedio = Number(resumen?.promedio || 0);
    const evolucion = Array.isArray(resumen?.evolucion) ? resumen.evolucion : [];
    const porActividad = Array.isArray(resumen?.porActividad) ? resumen.porActividad : [];
    const pendientes = Array.isArray(resumen?.pendientes) ? resumen.pendientes : [];

    contenido.innerHTML = `
      <div class="progreso-panel">
        <header class="progreso-cabecera">
          <h1 class="progreso-cabecera__titulo">Panel de Progreso</h1>
          <p class="progreso-cabecera__desc">
            Revisa tu rendimiento académico, avance en los temas y evolución de actividades.
          </p>
        </header>

        <!-- 1. Tarjetas de métricas -->
        <section class="progreso-metricas" aria-label="Métricas generales de progreso">
          <article class="metrica-tarjeta">
            <div class="metrica-tarjeta__icono" aria-hidden="true">⭐</div>
            <div class="metrica-tarjeta__info">
              <span class="metrica-tarjeta__valor" id="valPuntos">${puntos}</span>
              <span class="metrica-tarjeta__etiqueta">Puntos Totales</span>
            </div>
          </article>

          <article class="metrica-tarjeta">
            <div class="metrica-tarjeta__icono" aria-hidden="true">🎯</div>
            <div class="metrica-tarjeta__info">
              <span class="metrica-tarjeta__valor" id="valNivelQuiz">${nivelQuiz}</span>
              <span class="metrica-tarjeta__etiqueta">Nivel de Quiz Máximo</span>
            </div>
          </article>

          <article class="metrica-tarjeta">
            <div class="metrica-tarjeta__icono" aria-hidden="true">📚</div>
            <div class="metrica-tarjeta__info">
              <span class="metrica-tarjeta__valor" id="valPctTemas">${pctTemas}%</span>
              <span class="metrica-tarjeta__etiqueta">Temas Revisados</span>
            </div>
          </article>

          <article class="metrica-tarjeta">
            <div class="metrica-tarjeta__icono" aria-hidden="true">📊</div>
            <div class="metrica-tarjeta__info">
              <span class="metrica-tarjeta__valor" id="valPromedio">${promedio} / 10</span>
              <span class="metrica-tarjeta__etiqueta">Promedio General</span>
            </div>
          </article>
        </section>

        <!-- 2. Gráficos de evolución y promedio por actividad -->
        <section class="progreso-graficos-grid" aria-label="Gráficos de rendimiento">
          <article class="tarjeta grafico-tarjeta">
            <h2>Evolución de Rendimiento</h2>
            <p style="color: var(--color-texto-suave); font-size: var(--tamano-xs); margin-bottom: var(--espacio-m);">
              Promedio de tus actividades en las últimas semanas con datos.
            </p>
            <div class="grafico-contenedor" id="contenedorGraficoEvolucion">
              <canvas id="canvasEvolucion" role="img" aria-label="Gráfico de evolución semanal"></canvas>
            </div>
          </article>

          <article class="tarjeta grafico-tarjeta">
            <h2>Promedio por Actividad</h2>
            <p style="color: var(--color-texto-suave); font-size: var(--tamano-xs); margin-bottom: var(--espacio-m);">
              Calificación promedio obtenida en cada tipo de actividad formativa.
            </p>
            <div class="grafico-contenedor" id="contenedorGraficoActividades">
              <canvas id="canvasActividades" role="img" aria-label="Gráfico de promedio por actividad"></canvas>
            </div>
          </article>
        </section>

        <!-- 3. Lista de temas pendientes -->
        <section class="tarjeta pendientes-seccion" aria-label="Temas pendientes de revisión">
          <div class="fila" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
            <div>
              <h2>Temas Pendientes</h2>
              <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
                Temas publicados de tus asignaturas que aún no has revisado.
              </p>
            </div>
            ${
              pendientes.length > 0
                ? `<span class="chip" style="font-weight: var(--peso-seminegrita);">${pendientes.length} pendientes</span>`
                : ''
            }
          </div>

          <div class="lista-pendientes" id="contenedorPendientes">
            ${
              pendientes.length === 0
                ? `
                <div class="vacio">
                  <span class="vacio__icono" aria-hidden="true">🎉</span>
                  <h3 class="vacio__titulo">¡Estás al día!</h3>
                  <p class="vacio__descripcion">No tienes temas pendientes por revisar en tus asignaturas.</p>
                </div>
              `
                : pendientes
                    .map(
                      (p) => `
                <article class="pendiente-tarjeta">
                  <div class="pendiente-tarjeta__info">
                    <span class="pendiente-tarjeta__icono" aria-hidden="true">📖</span>
                    <h3 class="pendiente-tarjeta__titulo">${ui.escapar(p.titulo)}</h3>
                  </div>
                  <a href="/paginas/tema.html?id=${encodeURIComponent(p.temaId)}" class="btn btn--primario btn--pequeno">
                    Revisar tema
                  </a>
                </article>
              `
                    )
                    .join('')
            }
          </div>
        </section>
      </div>
    `;

    // 4. Renderizado de gráficos con Chart.js
    await renderizarGraficos({ evolucion, porActividad });
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar tu panel de progreso', 'error');
    contenido.innerHTML = `
      <div class="vacio" style="padding: var(--espacio-2xl);">
        <span class="vacio__icono" aria-hidden="true">⚠️</span>
        <h2 class="vacio__titulo">No se pudo cargar tu progreso</h2>
        <p class="vacio__descripcion">${ui.escapar(err.message || 'Ocurrió un error al consultar tus datos.')}</p>
        <button type="button" class="btn btn--primario" onclick="location.reload()" style="margin-top: var(--espacio-m);">
          Reintentar
        </button>
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

/**
 * Dibuja los gráficos de línea y barra utilizando Chart.js y los tokens de diseño.
 */
async function renderizarGraficos({ evolucion = [], porActividad = [] }) {
  const contenedorEvolucion = document.getElementById('contenedorGraficoEvolucion');
  const contenedorActividades = document.getElementById('contenedorGraficoActividades');
  const canvasEvolucion = document.getElementById('canvasEvolucion');
  const canvasActividades = document.getElementById('canvasActividades');

  // Si no hay datos de evolución, mostrar .vacio
  if (evolucion.length === 0 && contenedorEvolucion) {
    contenedorEvolucion.innerHTML = `
      <div class="vacio">
        <span class="vacio__icono" aria-hidden="true">📈</span>
        <h3 class="vacio__titulo">Sin datos semanales</h3>
        <p class="vacio__descripcion">Completa actividades para visualizar tu evolución a lo largo del tiempo.</p>
      </div>
    `;
  }

  // Si no hay datos de actividades, mostrar .vacio
  if (porActividad.length === 0 && contenedorActividades) {
    contenedorActividades.innerHTML = `
      <div class="vacio">
        <span class="vacio__icono" aria-hidden="true">📊</span>
        <h3 class="vacio__titulo">Sin actividades aún</h3>
        <p class="vacio__descripcion">Participa en juegos y quices para ver tu rendimiento por actividad.</p>
      </div>
    `;
  }

  // Si ambos están vacíos, no se necesita inicializar Chart.js
  if (evolucion.length === 0 && porActividad.length === 0) {
    return;
  }

  try {
    const ChartClass = await asegurarChartJS();
    const colores = obtenerColoresTema();

    // 1. Gráfico de líneas (Evolución)
    if (evolucion.length > 0 && canvasEvolucion) {
      const etiquetasEvolucion = evolucion.map((e) => {
        if (typeof e.semana === 'string' && e.semana.includes('-W')) {
          const partes = e.semana.split('-W');
          return `Sem. ${partes[1]}`;
        }
        return e.semana;
      });
      const datosEvolucion = evolucion.map((e) => Number(e.promedio) || 0);

      new ChartClass(canvasEvolucion, {
        type: 'line',
        data: {
          labels: etiquetasEvolucion,
          datasets: [
            {
              label: 'Promedio semanal',
              data: datosEvolucion,
              borderColor: colores.acento,
              backgroundColor: 'rgba(255, 105, 0, 0.1)',
              pointBackgroundColor: colores.primario,
              pointBorderColor: colores.acento,
              pointRadius: 5,
              pointHoverRadius: 7,
              borderWidth: 3,
              fill: true,
              tension: 0.3
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
                label: (ctx) => `Promedio: ${ctx.parsed.y} / 10`
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
              ticks: { color: colores.textoSuave },
              grid: { display: false }
            }
          }
        }
      });
    }

    // 2. Gráfico de barras (Promedio por Actividad)
    if (porActividad.length > 0 && canvasActividades) {
      const etiquetasActividades = porActividad.map((a) => {
        return NOMBRES_ACTIVIDADES[a.actividad] || a.actividad;
      });
      const datosActividades = porActividad.map((a) => Number(a.promedio) || 0);

      new ChartClass(canvasActividades, {
        type: 'bar',
        data: {
          labels: etiquetasActividades,
          datasets: [
            {
              label: 'Promedio',
              data: datosActividades,
              backgroundColor: colores.secundario,
              hoverBackgroundColor: colores.primario,
              borderRadius: 6,
              maxBarThickness: 45
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
                label: (ctx) => `Promedio: ${ctx.parsed.y} / 10 (${porActividad[ctx.dataIndex]?.intentos || 0} intentos)`
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
              ticks: { color: colores.textoSuave },
              grid: { display: false }
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn('No se pudieron inicializar los gráficos de Chart.js:', err);
  }
}

