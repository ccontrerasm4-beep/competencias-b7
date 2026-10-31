import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: "Actividades", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  const temaId = util.parametro('temaId');
  const queryParam = temaId ? `?temaId=${encodeURIComponent(temaId)}` : '';

  const iconosPorId = {
    ahorcado: '🎯',
    pareja: '🃏',
    'sopa-letras': '🔍',
    crucigrama: '✏️',
    quiz: '❓',
    canciones: '🎵',
    simulacion: '🎭'
  };

  contenido.innerHTML = `
    <header class="actividades-cabecera">
      <h1>Actividades de Aprendizaje</h1>
      <p>Practica y refuerza tus conocimientos mediante desafíos lúdicos, canciones y juegos interactivos.</p>
    </header>

    <div class="actividades-grid">
      ${ACTIVIDADES.map((act) => {
        const icono = iconosPorId[act.id] || '🎮';
        const urlDestino = `${act.href}${queryParam}`;

        return `
          <article class="actividad-tarjeta">
            <div>
              <div class="actividad-tarjeta__icono" aria-hidden="true">${icono}</div>
              <h2 class="actividad-tarjeta__titulo">${ui.escapar(act.texto)}</h2>
              <p class="actividad-tarjeta__desc">${ui.escapar(act.descripcion || '')}</p>
            </div>
            <div class="actividad-tarjeta__pie">
              <a href="${urlDestino}" class="btn btn--primario">
                Jugar →
              </a>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

