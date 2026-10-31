import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

export async function calcularAvance(asignaturaId) {
  try {
    const [unidades, temas, progreso] = await Promise.all([
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    const unidadesAsig = (unidades || []).filter(
      (u) => u.asignaturaId === asignaturaId && u.visible !== false
    );
    const idsUnidades = new Set(unidadesAsig.map((u) => u.id));

    const temasPublicados = (temas || []).filter(
      (t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado'
    );

    const total = temasPublicados.length;
    if (total === 0) {
      const res = { porcentaje: 0, revisados: 0, total: 0 };
      res[Symbol.toPrimitive] = () => 0;
      return res;
    }

    const revisadosSet = new Set((progreso || []).map((p) => p.temaId));
    const revisados = temasPublicados.filter((t) => revisadosSet.has(t.id)).length;
    const porcentaje = Math.round((revisados / total) * 100);

    const res = { porcentaje, revisados, total };
    res[Symbol.toPrimitive] = (hint) => (hint === 'string' ? `${porcentaje}%` : porcentaje);
    return res;
  } catch {
    const res = { porcentaje: 0, revisados: 0, total: 0 };
    res[Symbol.toPrimitive] = () => 0;
    return res;
  }
}

if (typeof window !== 'undefined' && window.location.pathname.includes('asignaturas.html')) {
  await montarPlantilla({ titulo: "Mis Asignaturas", roles: ["estudiante", "docente"] });

  const contenido = document.getElementById('contenido');
  if (contenido) {
    contenido.innerHTML = `
      <div class="asignaturas-estudiante-cabecera">
        <h1>Mis Asignaturas</h1>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
          Accede a tus materias, revisa las portadas temáticas, consulta contenidos y monitorea tu avance.
        </p>
      </div>

      <div id="contenedorAsignaturas">
        <div style="text-align: center; padding: var(--espacio-2xl);">
          <div class="cargando" role="status" aria-label="Cargando asignaturas"></div>
        </div>
      </div>
    `;

    iniciarVistaAsignaturas();
  }
}

async function iniciarVistaAsignaturas() {
  const contenedor = document.getElementById('contenedorAsignaturas');
  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

  try {
    const asignaturas = await api.listar('asignaturas');

    if (!Array.isArray(asignaturas) || asignaturas.length === 0) {
      contenedor.innerHTML = `
        <div class="tarjeta vacio">
          <p style="font-size: var(--tamano-l); font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            No tienes asignaturas registradas
          </p>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">
            Consulta con tu docente o administrador para que seas matriculado en un grupo.
          </p>
        </div>
      `;
      return;
    }

    const avances = await Promise.all(asignaturas.map((a) => calcularAvance(a.id)));

    const grid = document.createElement('div');
    grid.className = 'asignaturas-estudiante-grid';

    asignaturas.forEach((asig, index) => {
      const avance = avances[index] || { porcentaje: 0, revisados: 0, total: 0 };
      const tarjeta = document.createElement('article');
      tarjeta.className = 'asignatura-estudiante-tarjeta';

      tarjeta.innerHTML = `
        <div class="asignatura-estudiante-tarjeta__portada">
          ${asig.imagen 
            ? `<img src="${ui.escapar(asig.imagen)}" alt="${ui.escapar(asig.nombre)}" class="asignatura-estudiante-tarjeta__img">` 
            : `<div class="asignatura-estudiante-tarjeta__placeholder">
                <span class="asignatura-estudiante-tarjeta__placeholder-icono" aria-hidden="true">📚</span>
                <span class="asignatura-estudiante-tarjeta__placeholder-texto">Sin portada</span>
               </div>`
          }
          <span class="insignia insignia--primario asignatura-estudiante-tarjeta__badge-nivel">
            ${ui.escapar(asig.nivel || 'COLEGIO')}
          </span>
        </div>

        <div class="asignatura-estudiante-tarjeta__cuerpo">
          <div class="asignatura-estudiante-tarjeta__cabecera">
            <h2 class="asignatura-estudiante-tarjeta__titulo">${ui.escapar(asig.nombre)}</h2>
          </div>

          <p class="asignatura-estudiante-tarjeta__desc">
            ${ui.escapar(asig.descripcion || 'Sin descripción disponible.')}
          </p>

          <div class="asignatura-estudiante-tarjeta__avance">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Avance en temas</span>
              <strong style="font-size: var(--tamano-s); color: var(--color-primario);">${avance.porcentaje}%</strong>
            </div>
            <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
              <div class="progreso__barra" style="width: ${avance.porcentaje}%;"></div>
            </div>
            <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
              ${avance.revisados} de ${avance.total} temas revisados
            </span>
          </div>

          <div class="asignatura-estudiante-tarjeta__acciones">
            ${puedeEditar ? `
              <button type="button" class="btn btn--secundario btn--pequeno btn-editar-portada" data-id="${asig.id}">
                🎨 Editar portada
              </button>
            ` : ''}
            <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario btn--pequeno">
              Ingresar a la materia →
            </a>
          </div>
        </div>
      `;

      grid.appendChild(tarjeta);
    });

    contenedor.innerHTML = '';
    contenedor.appendChild(grid);

    if (puedeEditar) {
      grid.querySelectorAll('.btn-editar-portada').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const asig = asignaturas.find((a) => a.id === id);
          if (asig) abrirModalPortadaDocente(asig);
        });
      });
    }
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error">
        ${ui.escapar(err.message || 'Error al cargar asignaturas')}
      </div>
    `;
  }
}

async function abrirModalPortadaDocente(asig) {
  let urlImagenActual = asig?.imagen || '';

  const formContenedor = document.createElement('form');
  formContenedor.className = 'pila';
  formContenedor.noValidate = true;

  formContenedor.innerHTML = `
    <div class="campo">
      <label>Imagen de portada de "${ui.escapar(asig.nombre)}"</label>
      <div class="portada-editor">
        <div id="previewPortadaDocente" class="portada-editor__preview">
          ${urlImagenActual 
            ? `<img src="${ui.escapar(urlImagenActual)}" alt="Portada de la asignatura" class="portada-editor__img">` 
            : `<div class="portada-editor__placeholder">
                 <span>🖼️</span>
                 <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Ninguna portada seleccionada</span>
               </div>`
          }
        </div>
        <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-s); flex-wrap: wrap; align-items: center;">
          <label class="btn btn--secundario btn--pequeno" style="cursor: pointer; margin: 0;">
            📁 Subir imagen
            <input type="file" id="inputArchivoPortadaDocente" accept="image/jpeg,image/png,image/webp" style="display: none;">
          </label>
          <button type="button" class="btn btn--fantasma btn--pequeno" id="btnQuitarPortadaDocente" style="${urlImagenActual ? '' : 'display: none;'}">
            🗑️ Quitar portada
          </button>
        </div>
        <div style="margin-top: var(--espacio-xs);">
          <input type="url" id="inputUrlPortadaDocente" placeholder="O introduce enlace URL directo (opcional)" value="${ui.escapar(urlImagenActual)}">
        </div>
        <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave); display: block; margin-top: var(--espacio-2xs);">
          Formatos soportados: JPG, PNG, WEBP. Se mostrará tipo portada/noticia.
        </span>
      </div>
    </div>

    <div class="campo">
      <label for="campoDescDocente">Descripción pedagógica</label>
      <textarea id="campoDescDocente" rows="3" placeholder="Descripción breve de los objetivos de la materia...">${ui.escapar(asig.descripcion || '')}</textarea>
    </div>
  `;

  const inputArchivo = formContenedor.querySelector('#inputArchivoPortadaDocente');
  const inputUrl = formContenedor.querySelector('#inputUrlPortadaDocente');
  const previewBox = formContenedor.querySelector('#previewPortadaDocente');
  const btnQuitar = formContenedor.querySelector('#btnQuitarPortadaDocente');

  function actualizarPreview(url) {
    urlImagenActual = url ? url.trim() : '';
    if (urlImagenActual) {
      previewBox.innerHTML = `<img src="${ui.escapar(urlImagenActual)}" alt="Portada" class="portada-editor__img">`;
      btnQuitar.style.display = 'inline-block';
    } else {
      previewBox.innerHTML = `
        <div class="portada-editor__placeholder">
          <span>🖼️</span>
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Ninguna portada seleccionada</span>
        </div>
      `;
      btnQuitar.style.display = 'none';
    }
  }

  inputArchivo?.addEventListener('change', async () => {
    const file = inputArchivo.files && inputArchivo.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      ui.aviso('La imagen excede el límite máximo de 5 MB.', 'advertencia');
      inputArchivo.value = '';
      return;
    }

    try {
      ui.aviso('Subiendo portada...', 'info');
      const res = await api.subir(file);
      actualizarPreview(res.url);
      if (inputUrl) inputUrl.value = res.url;
      ui.aviso('Portada subida con éxito', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al subir imagen', 'error');
    }
  });

  inputUrl?.addEventListener('input', () => {
    actualizarPreview(inputUrl.value);
  });

  btnQuitar?.addEventListener('click', () => {
    actualizarPreview('');
    if (inputUrl) inputUrl.value = '';
    if (inputArchivo) inputArchivo.value = '';
  });

  await ui.modal({
    titulo: `Editar Portada: ${asig.nombre}`,
    contenido: formContenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      {
        texto: 'Guardar cambios',
        clase: 'btn--primario',
        accion: async (cerrar) => {
          const inputDesc = formContenedor.querySelector('#campoDescDocente');
          const descripcion = inputDesc ? inputDesc.value.trim() : asig.descripcion;
          const imagen = urlImagenActual || null;

          try {
            await api.actualizar('asignaturas', asig.id, { descripcion, imagen });
            ui.aviso('Portada de asignatura actualizada', 'exito');
            cerrar(true);
            await iniciarVistaAsignaturas();
          } catch (err) {
            ui.aviso(err.message || 'Error al actualizar portada', 'error');
            return false;
          }
        }
      }
    ]
  });
}
