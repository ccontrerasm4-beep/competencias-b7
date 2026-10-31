import * as ui from './ui.js';

/**
 * Muestra un panel accesible de retroalimentación inmediata sobre la respuesta del usuario.
 * @param {Object} opciones
 * @param {boolean} opciones.correcto Si la acción fue correcta o incorrecta
 * @param {string} [opciones.explicacion] Texto explicativo pedagógico
 * @param {string} [opciones.sugerencia] Pista o recomendación orientadora
 * @param {string} [opciones.enlaceTema] URL para repasar el tema correspondiente
 * @param {HTMLElement} [opciones.contenedor] Contenedor opcional donde renderizar el panel
 * @returns {HTMLElement} Elemento del panel creado
 */
export function mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema, contenedor = null }) {
  const panel = document.createElement('div');
  panel.className = `retro retro--${correcto ? 'correcto' : 'incorrecto'}`;
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');

  const icono = correcto ? '✓' : '✗';
  const titulo = correcto ? '¡Correcto!' : '¡Incorrecto!';

  panel.innerHTML = `
    <div class="retro__cabecera">
      <span class="retro__icono" aria-hidden="true">${icono}</span>
      <strong class="retro__titulo">${titulo}</strong>
    </div>
    ${explicacion ? `<p class="retro__explicacion">${ui.escapar(explicacion)}</p>` : ''}
    ${sugerencia ? `<p class="retro__sugerencia"><strong>Pista:</strong> ${ui.escapar(sugerencia)}</p>` : ''}
    ${enlaceTema ? `<a href="${ui.escapar(enlaceTema)}" class="retro__enlace btn btn--secundario btn--pequeno">Repasar el tema →</a>` : ''}
  `;

  let destino = contenedor;
  if (!destino && typeof document !== 'undefined') {
    destino = document.getElementById('panel-retro') ||
              document.getElementById('retroalimentacion') ||
              document.querySelector('.contenedor-retro') ||
              document.getElementById('contenido') ||
              document.body;
  }

  if (destino) {
    const retroPrevio = destino.querySelector('.retro');
    if (retroPrevio && destino !== document.body) {
      retroPrevio.replaceWith(panel);
    } else {
      destino.appendChild(panel);
    }
  }

  return panel;
}

/**
 * Presenta un modal resumen al finalizar la partida con métricas de desempeño y opciones.
 * @param {Object} opciones
 * @param {string} [opciones.titulo] Título del modal
 * @param {number} [opciones.aciertos] Número de aciertos
 * @param {number} [opciones.errores] Número de errores
 * @param {string} [opciones.recomendaciones] Recomendaciones pedagógicas
 * @param {string} [opciones.enlaceTema] Enlace para repasar el tema
 * @returns {Promise<"repetir" | "salir">}
 */
export async function mostrarResumen({ titulo, aciertos = 0, errores = 0, recomendaciones, enlaceTema }) {
  const div = document.createElement('div');
  div.className = 'resumen-actividad';
  div.innerHTML = `
    <div class="resumen-estadisticas" style="display: flex; gap: var(--espacio-m); justify-content: center; margin: var(--espacio-m) 0;">
      <div class="tarjeta" style="text-align: center; min-width: 120px; border-color: var(--color-exito);">
        <div style="font-size: var(--tamano-2xl); font-weight: var(--peso-negrita); color: var(--color-exito);">
          ${aciertos}
        </div>
        <div style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Aciertos</div>
      </div>
      <div class="tarjeta" style="text-align: center; min-width: 120px; border-color: var(--color-error);">
        <div style="font-size: var(--tamano-2xl); font-weight: var(--peso-negrita); color: var(--color-error);">
          ${errores}
        </div>
        <div style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Errores</div>
      </div>
    </div>
    ${
      recomendaciones
        ? `
      <div class="alerta alerta--info" style="margin-top: var(--espacio-m);">
        <strong>Recomendación:</strong> ${ui.escapar(recomendaciones)}
      </div>
    `
        : ''
    }
  `;

  const acciones = [];

  if (enlaceTema) {
    acciones.push({
      texto: 'Repasar el tema',
      valor: 'salir',
      clase: 'btn btn--secundario',
      accion: () => {
        window.location.href = enlaceTema;
      }
    });
  } else {
    acciones.push({
      texto: 'Salir',
      valor: 'salir',
      clase: 'btn btn--secundario'
    });
  }

  acciones.push({
    texto: 'Jugar de nuevo',
    valor: 'repetir',
    clase: 'btn btn--primario'
  });

  const res = await ui.modal({
    titulo: titulo || 'Resumen de la Actividad',
    contenido: div,
    acciones
  });

  return res === 'repetir' ? 'repetir' : 'salir';
}

