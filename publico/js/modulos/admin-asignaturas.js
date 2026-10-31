import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Gestión de Asignaturas", roles: ["admin", "docente"] });

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();
const esAdmin = usuario && usuario.rol === 'admin';

if (contenido) {
  contenido.innerHTML = `
    <div class="asignaturas-cabecera">
      <div>
        <h1>${esAdmin ? 'Asignaturas Académicas' : 'Mis Asignaturas Asignadas'}</h1>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
          ${esAdmin 
            ? 'Gestiona el catálogo de asignaturas, portadas y sus niveles para el ecosistema educativo.'
            : 'Gestiona la imagen de portada y los detalles pedagógicos de tus asignaturas.'}
        </p>
      </div>
      ${esAdmin ? `
        <button type="button" class="btn btn--primario" id="btnNuevaAsignatura">
          + Nueva Asignatura
        </button>
      ` : ''}
    </div>

    <div id="contenedorTarjetas">
      <div style="text-align: center; padding: var(--espacio-2xl);">
        <div class="cargando" role="status" aria-label="Cargando asignaturas"></div>
      </div>
    </div>
  `;

  const contenedorTarjetas = document.getElementById('contenedorTarjetas');
  const btnNuevaAsignatura = document.getElementById('btnNuevaAsignatura');

  let asignaturas = [];
  let distributivo = [];

  async function cargarDatos() {
    try {
      const [listaAsig, listaDist] = await Promise.all([
        api.listar('asignaturas'),
        api.listar('distributivo')
      ]);
      asignaturas = Array.isArray(listaAsig) ? listaAsig : [];
      distributivo = Array.isArray(listaDist) ? listaDist : [];
      renderizarTarjetas();
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar asignaturas', 'error');
      contenedorTarjetas.innerHTML = `
        <div class="alerta alerta--error">
          No se pudieron cargar las asignaturas. Por favor, reintenta más tarde.
        </div>
      `;
    }
  }

  function contarGrupos(asignaturaId) {
    return distributivo.filter((g) => g.asignaturaId === asignaturaId).length;
  }

  function renderizarTarjetas() {
    if (asignaturas.length === 0) {
      contenedorTarjetas.innerHTML = `
        <div class="tarjeta vacio">
          <p style="font-size: var(--tamano-l); font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            No hay asignaturas disponibles
          </p>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
            ${esAdmin 
              ? 'Empieza creando la primera asignatura para habilitar el distributivo docente.'
              : 'Aún no tienes asignaturas asignadas en el distributivo académico.'}
          </p>
          ${esAdmin ? `
            <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearVacio">
              Crear Asignatura
            </button>
          ` : ''}
        </div>
      `;
      if (esAdmin) {
        document.getElementById('btnCrearVacio')?.addEventListener('click', () => abrirModalFormulario());
      }
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'asignaturas-grid';

    asignaturas.forEach((asig) => {
      const numGrupos = contarGrupos(asig.id);
      const tarjeta = document.createElement('article');
      tarjeta.className = 'asignatura-tarjeta';

      tarjeta.innerHTML = `
        <div class="asignatura-tarjeta__portada">
          ${asig.imagen 
            ? `<img src="${ui.escapar(asig.imagen)}" alt="${ui.escapar(asig.nombre)}" class="asignatura-tarjeta__img">` 
            : `<div class="asignatura-tarjeta__placeholder">
                <span class="asignatura-tarjeta__placeholder-icono" aria-hidden="true">📚</span>
                <span class="asignatura-tarjeta__placeholder-texto">Sin imagen de portada</span>
               </div>`
          }
          <span class="insignia insignia--primario asignatura-tarjeta__badge-nivel">
            ${ui.escapar(asig.nivel || 'COLEGIO')}
          </span>
        </div>

        <div class="asignatura-tarjeta__cuerpo">
          <div class="asignatura-tarjeta__cabecera">
            <h2 class="asignatura-tarjeta__titulo">${ui.escapar(asig.nombre)}</h2>
          </div>

          <p class="asignatura-tarjeta__desc">
            ${ui.escapar(asig.descripcion || 'Sin descripción detallada.')}
          </p>

          <div class="asignatura-tarjeta__meta">
            <span>👥 ${numGrupos} ${numGrupos === 1 ? 'grupo asignado' : 'grupos asignados'}</span>
          </div>

          <div class="asignatura-tarjeta__acciones">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${asig.id}">
              ✏️ ${esAdmin ? 'Editar' : 'Editar portada'}
            </button>
            ${esAdmin ? `
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${asig.id}" data-nombre="${ui.escapar(asig.nombre)}" data-grupos="${numGrupos}">
                Eliminar
              </button>
            ` : ''}
          </div>
        </div>
      `;

      grid.appendChild(tarjeta);
    });

    contenedorTarjetas.innerHTML = '';
    contenedorTarjetas.appendChild(grid);

    // Eventos editar y eliminar
    contenedorTarjetas.querySelectorAll('.btn-editar').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const asig = asignaturas.find((a) => a.id === id);
        if (asig) abrirModalFormulario(asig);
      });
    });

    if (esAdmin) {
      contenedorTarjetas.querySelectorAll('.btn-eliminar').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const nombre = btn.getAttribute('data-nombre');
          const numGrupos = parseInt(btn.getAttribute('data-grupos') || '0', 10);

          if (numGrupos > 0) {
            ui.aviso(`No se puede eliminar "${nombre}" porque tiene ${numGrupos} grupo(s) en el distributivo.`, 'advertencia');
            return;
          }

          const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar la asignatura "${nombre}"?`);
          if (!confirmado) return;

          try {
            await api.eliminar('asignaturas', id);
            ui.aviso('Asignatura eliminada con éxito', 'exito');
            await cargarDatos();
          } catch (err) {
            ui.aviso(err.message || 'Error al eliminar la asignatura', 'error');
          }
        });
      });
    }
  }

  async function abrirModalFormulario(asig = null) {
    const esEdicion = Boolean(asig);
    let urlImagenActual = asig?.imagen || '';

    const formContenedor = document.createElement('form');
    formContenedor.className = 'pila';
    formContenedor.noValidate = true;

    formContenedor.innerHTML = `
      <!-- Portada de la Asignatura -->
      <div class="campo">
        <label>Imagen de portada (tipo noticia / banner)</label>
        <div class="portada-editor">
          <div id="previewPortadaBox" class="portada-editor__preview">
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
              <input type="file" id="inputArchivoPortada" accept="image/jpeg,image/png,image/webp" style="display: none;">
            </label>
            <button type="button" class="btn btn--fantasma btn--pequeno" id="btnQuitarPortada" style="${urlImagenActual ? '' : 'display: none;'}">
              🗑️ Quitar portada
            </button>
          </div>
          <div style="margin-top: var(--espacio-xs);">
            <input type="url" id="inputUrlPortada" placeholder="O introduce enlace URL directo (opcional)" value="${ui.escapar(urlImagenActual)}">
          </div>
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave); display: block; margin-top: var(--espacio-2xs);">
            Formatos recomendados: JPG, PNG o WEBP. Proporción horizontal recomendada (16:9 o 2:1).
          </span>
        </div>
      </div>

      <div class="campo">
        <label for="campoNombre">Nombre de la Asignatura</label>
        <input type="text" id="campoNombre" value="${ui.escapar(asig?.nombre || '')}" placeholder="Ej. EMPRENDIMIENTO Y GESTIÓN" ${!esAdmin && esEdicion ? 'readonly' : 'required'}>
        <span class="campo__error" id="errorNombre"></span>
      </div>

      <div class="campo">
        <label for="campoNivel">Nivel Educativo</label>
        <select id="campoNivel" ${!esAdmin && esEdicion ? 'disabled' : 'required'}>
          <option value="COLEGIO" ${asig?.nivel === 'COLEGIO' ? 'selected' : ''}>COLEGIO</option>
          <option value="BÁSICA SUPERIOR" ${asig?.nivel === 'BÁSICA SUPERIOR' ? 'selected' : ''}>BÁSICA SUPERIOR</option>
          <option value="BÁSICA MEDIA" ${asig?.nivel === 'BÁSICA MEDIA' ? 'selected' : ''}>BÁSICA MEDIA</option>
          <option value="BÁSICA ELEMENTAL" ${asig?.nivel === 'BÁSICA ELEMENTAL' ? 'selected' : ''}>BÁSICA ELEMENTAL</option>
          <option value="SUPERIOR" ${asig?.nivel === 'SUPERIOR' ? 'selected' : ''}>SUPERIOR</option>
        </select>
        <span class="campo__error" id="errorNivel"></span>
      </div>

      <div class="campo">
        <label for="campoDescripcion">Descripción pedagógica</label>
        <textarea id="campoDescripcion" rows="3" placeholder="Descripción breve de los objetivos o temas de la materia...">${ui.escapar(asig?.descripcion || '')}</textarea>
      </div>
    `;

    const inputArchivoPortada = formContenedor.querySelector('#inputArchivoPortada');
    const inputUrlPortada = formContenedor.querySelector('#inputUrlPortada');
    const previewPortadaBox = formContenedor.querySelector('#previewPortadaBox');
    const btnQuitarPortada = formContenedor.querySelector('#btnQuitarPortada');

    function actualizarPreview(url) {
      urlImagenActual = url ? url.trim() : '';
      if (urlImagenActual) {
        previewPortadaBox.innerHTML = `<img src="${ui.escapar(urlImagenActual)}" alt="Portada de la asignatura" class="portada-editor__img">`;
        btnQuitarPortada.style.display = 'inline-block';
      } else {
        previewPortadaBox.innerHTML = `
          <div class="portada-editor__placeholder">
            <span>🖼️</span>
            <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Ninguna portada seleccionada</span>
          </div>
        `;
        btnQuitarPortada.style.display = 'none';
      }
    }

    inputArchivoPortada?.addEventListener('change', async () => {
      const file = inputArchivoPortada.files && inputArchivoPortada.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        ui.aviso('La imagen excede el límite máximo de 5 MB.', 'advertencia');
        inputArchivoPortada.value = '';
        return;
      }

      try {
        ui.aviso('Subiendo imagen de portada...', 'info');
        const res = await api.subir(file);
        actualizarPreview(res.url);
        if (inputUrlPortada) inputUrlPortada.value = res.url;
        ui.aviso('Imagen subida con éxito', 'exito');
      } catch (err) {
        ui.aviso(err.message || 'Error al subir la imagen', 'error');
      }
    });

    inputUrlPortada?.addEventListener('input', () => {
      actualizarPreview(inputUrlPortada.value);
    });

    btnQuitarPortada?.addEventListener('click', () => {
      actualizarPreview('');
      if (inputUrlPortada) inputUrlPortada.value = '';
      if (inputArchivoPortada) inputArchivoPortada.value = '';
    });

    await ui.modal({
      titulo: esEdicion ? 'Editar Asignatura' : 'Nueva Asignatura',
      contenido: formContenedor,
      acciones: [
        {
          texto: 'Cancelar',
          valor: null,
          clase: 'btn--secundario'
        },
        {
          texto: esEdicion ? 'Actualizar' : 'Guardar',
          clase: 'btn--primario',
          accion: async (cerrar) => {
            const inputNombre = formContenedor.querySelector('#campoNombre');
            const inputNivel = formContenedor.querySelector('#campoNivel');
            const inputDesc = formContenedor.querySelector('#campoDescripcion');
            const errorNombre = formContenedor.querySelector('#errorNombre');

            const nombre = inputNombre ? inputNombre.value.trim() : (asig?.nombre || '');
            const nivel = inputNivel ? inputNivel.value.trim() : (asig?.nivel || 'COLEGIO');
            const descripcion = inputDesc ? inputDesc.value.trim() : '';
            const imagen = urlImagenActual || null;

            if (!nombre) {
              if (errorNombre) errorNombre.textContent = 'El nombre de la asignatura es obligatorio.';
              inputNombre?.focus();
              return false;
            }
            if (errorNombre) errorNombre.textContent = '';

            try {
              if (esEdicion) {
                const payload = { descripcion, imagen };
                if (esAdmin) {
                  payload.nombre = nombre;
                  payload.nivel = nivel;
                }
                await api.actualizar('asignaturas', asig.id, payload);
                ui.aviso('Asignatura actualizada con éxito', 'exito');
              } else {
                await api.crear('asignaturas', { nombre, nivel, descripcion, imagen });
                ui.aviso('Asignatura creada con éxito', 'exito');
              }
              cerrar(true);
              await cargarDatos();
            } catch (err) {
              ui.aviso(err.message || 'Error al guardar la asignatura', 'error');
              return false;
            }
          }
        }
      ]
    });
  }

  btnNuevaAsignatura?.addEventListener('click', () => abrirModalFormulario());

  await cargarDatos();
}
