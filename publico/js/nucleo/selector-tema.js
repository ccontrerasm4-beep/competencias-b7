import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

/**
 * Obtiene el tema para una actividad interactiva:
 * - Si existe el parámetro ?temaId= en la URL, obtiene ese tema.
 * - Si no, abre un modal con selectores en cascada (asignatura -> unidad -> tema publicado)
 *   y retorna el tema seleccionado.
 * @returns {Promise<Object|null>} Tema seleccionado o null si cancela
 */
export async function obtenerTemaActividad() {
  const temaIdParam = util.parametro('temaId') || util.parametro('id');

  if (temaIdParam) {
    try {
      const tema = await api.obtener('temas', temaIdParam);
      if (tema && tema.id) {
        return tema;
      }
    } catch (err) {
      console.warn('Tema indicado en URL no encontrado:', err.message);
    }
  }

  // Si no hay parámetro o falló la obtención directa, mostrar modal
  const [asignaturas, unidades, temas] = await Promise.all([
    api.listar('asignaturas').catch(() => []),
    api.listar('unidades').catch(() => []),
    api.listar('temas').catch(() => [])
  ]);

  const temasPublicados = (temas || []).filter((t) => t.estado === 'publicado');
  const idsUnidadesConTemas = new Set(temasPublicados.map((t) => t.unidadId));
  const unidadesDisponibles = (unidades || []).filter(
    (u) => u.visible !== false && idsUnidadesConTemas.has(u.id)
  );
  const idsAsignaturasConTemas = new Set(unidadesDisponibles.map((u) => u.asignaturaId));
  const asignaturasDisponibles = (asignaturas || []).filter((a) =>
    idsAsignaturasConTemas.has(a.id)
  );

  if (asignaturasDisponibles.length === 0 || temasPublicados.length === 0) {
    ui.aviso('No hay temas publicados disponibles en tus materias para realizar esta actividad', 'advertencia');
    return null;
  }

  return new Promise((resolve) => {
    const contenedor = document.createElement('div');
    contenedor.className = 'pila';

    contenedor.innerHTML = `
      <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0 0 var(--espacio-s) 0;">
        Selecciona la asignatura, unidad y el tema que deseas practicar:
      </p>

      <div class="campo">
        <label for="selectorAsignatura">Asignatura</label>
        <select id="selectorAsignatura" class="input">
          <option value="">-- Elige una asignatura --</option>
          ${asignaturasDisponibles
            .map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)}</option>`)
            .join('')}
        </select>
      </div>

      <div class="campo">
        <label for="selectorUnidad">Unidad</label>
        <select id="selectorUnidad" class="input" disabled>
          <option value="">-- Primero elige una asignatura --</option>
        </select>
      </div>

      <div class="campo">
        <label for="selectorTema">Tema</label>
        <select id="selectorTema" class="input" disabled>
          <option value="">-- Primero elige una unidad --</option>
        </select>
      </div>
      <div id="selectorTemaError" style="color: var(--color-error); font-size: var(--tamano-xs); display: none;"></div>
    `;

    const selAsig = contenedor.querySelector('#selectorAsignatura');
    const selUni = contenedor.querySelector('#selectorUnidad');
    const selTema = contenedor.querySelector('#selectorTema');
    const msgError = contenedor.querySelector('#selectorTemaError');

    selAsig.addEventListener('change', () => {
      msgError.style.display = 'none';
      const asigId = selAsig.value;
      selUni.innerHTML = '<option value="">-- Elige una unidad --</option>';
      selTema.innerHTML = '<option value="">-- Primero elige una unidad --</option>';
      selTema.disabled = true;

      if (!asigId) {
        selUni.disabled = true;
        return;
      }

      const unidadesDeAsig = unidadesDisponibles
        .filter((u) => u.asignaturaId === asigId)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      unidadesDeAsig.forEach((u) => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.titulo || u.nombre || `Unidad ${u.orden || ''}`;
        selUni.appendChild(opt);
      });

      selUni.disabled = false;
    });

    selUni.addEventListener('change', () => {
      msgError.style.display = 'none';
      const uniId = selUni.value;
      selTema.innerHTML = '<option value="">-- Elige un tema --</option>';

      if (!uniId) {
        selTema.disabled = true;
        return;
      }

      const temasDeUnidad = temasPublicados
        .filter((t) => t.unidadId === uniId)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      temasDeUnidad.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.titulo;
        selTema.appendChild(opt);
      });

      selTema.disabled = false;
    });

    ui.modal({
      titulo: 'Elegir Tema de la Actividad',
      contenido: contenedor,
      acciones: [
        {
          texto: 'Cancelar',
          valor: null,
          clase: 'btn btn--secundario'
        },
        {
          texto: 'Comenzar actividad',
          clase: 'btn btn--primario',
          accion: (cerrar) => {
            const temaElegidoId = selTema.value;
            if (!temaElegidoId) {
              msgError.textContent = 'Debes seleccionar un tema para continuar.';
              msgError.style.display = 'block';
              return false; // No cerrar el modal
            }
            const temaObj = temasPublicados.find((t) => t.id === temaElegidoId);
            cerrar(temaObj || null);
          }
        }
      ]
    }).then((temaFinal) => {
      resolve(temaFinal || null);
    });
  });
}

