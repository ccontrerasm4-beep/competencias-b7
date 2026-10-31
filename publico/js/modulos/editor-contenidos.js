import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Editor de Contenidos", roles: ["docente", "admin"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="editor-cabecera">
      <div>
        <h1>Editor de Unidades y Temas</h1>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
          Estructura los contenidos curriculares, su visibilidad y estado de publicación.
        </p>
      </div>
    </div>

    <div class="editor-selector-bloque">
      <div class="campo" style="max-width: 480px;">
        <label for="selectorAsignatura">Selecciona una Asignatura</label>
        <select id="selectorAsignatura">
          <option value="">Cargando asignaturas...</option>
        </select>
      </div>
    </div>

    <div id="zonaContenidos" style="display: none;">
      <div class="editor-paneles">
        <!-- Panel de Unidades -->
        <section class="panel-columna tarjeta" aria-labelledby="tituloUnidades">
          <div class="panel-cabecera">
            <div>
              <h2 class="panel-titulo" id="tituloUnidades">Unidades</h2>
              <span id="contadorUnidades" style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">0 unidades</span>
            </div>
            <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevaUnidad">
              + Nueva Unidad
            </button>
          </div>

          <div class="lista-items" id="listaUnidades">
            <div style="text-align: center; padding: var(--espacio-l);">
              <div class="cargando" role="status" aria-label="Cargando unidades"></div>
            </div>
          </div>
        </section>

        <!-- Panel de Temas -->
        <section class="panel-columna tarjeta" aria-labelledby="tituloTemas">
          <div class="panel-cabecera">
            <div>
              <h2 class="panel-titulo" id="tituloTemas">Temas de la Unidad</h2>
              <span id="subtituloUnidadActual" style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
                Selecciona una unidad para ver sus temas
              </span>
            </div>
            <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevoTema" disabled>
              + Nuevo Tema
            </button>
          </div>

          <div class="lista-items" id="listaTemas">
            <div class="vacio" style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
              Ninguna unidad seleccionada
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  const selectorAsignatura = document.getElementById('selectorAsignatura');
  const zonaContenidos = document.getElementById('zonaContenidos');

  const listaUnidadesEl = document.getElementById('listaUnidades');
  const contadorUnidadesEl = document.getElementById('contadorUnidades');
  const btnNuevaUnidad = document.getElementById('btnNuevaUnidad');

  const listaTemasEl = document.getElementById('listaTemas');
  const subtituloUnidadActual = document.getElementById('subtituloUnidadActual');
  const btnNuevoTema = document.getElementById('btnNuevoTema');

  let misAsignaturas = [];
  let asignaturaActualId = null;

  let todasLasUnidades = [];
  let unidadesAsignatura = [];
  let unidadSeleccionada = null;

  let todosLosTemas = [];
  let temasUnidad = [];

  async function cargarAsignaturas() {
    try {
      misAsignaturas = await api.listar('asignaturas');

      if (!Array.isArray(misAsignaturas) || misAsignaturas.length === 0) {
        selectorAsignatura.innerHTML = '<option value="">No tienes asignaturas asignadas</option>';
        zonaContenidos.style.display = 'none';
        return;
      }

      selectorAsignatura.innerHTML = misAsignaturas
        .map((a) => `<option value="${a.id}">${ui.escapar(a.nombre)} (${ui.escapar(a.nivel || 'COLEGIO')})</option>`)
        .join('');

      asignaturaActualId = misAsignaturas[0].id;
      zonaContenidos.style.display = 'block';
      await recargarUnidades();
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar asignaturas', 'error');
      selectorAsignatura.innerHTML = '<option value="">Error al cargar</option>';
    }
  }

  async function recargarUnidades() {
    if (!asignaturaActualId) return;

    listaUnidadesEl.innerHTML = `
      <div style="text-align: center; padding: var(--espacio-l);">
        <div class="cargando" role="status" aria-label="Cargando unidades"></div>
      </div>
    `;

    try {
      todasLasUnidades = await api.listar('unidades');
      unidadesAsignatura = (todasLasUnidades || [])
        .filter((u) => u.asignaturaId === asignaturaActualId)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      contadorUnidadesEl.textContent = `${unidadesAsignatura.length} ${unidadesAsignatura.length === 1 ? 'unidad' : 'unidades'}`;
      renderizarUnidades();

      // Si teníamos una unidad seleccionada, verificar si sigue existiendo
      if (unidadSeleccionada) {
        const existe = unidadesAsignatura.find((u) => u.id === unidadSeleccionada.id);
        if (existe) {
          seleccionarUnidad(existe);
        } else if (unidadesAsignatura.length > 0) {
          seleccionarUnidad(unidadesAsignatura[0]);
        } else {
          deseleccionarUnidad();
        }
      } else if (unidadesAsignatura.length > 0) {
        seleccionarUnidad(unidadesAsignatura[0]);
      } else {
        deseleccionarUnidad();
      }
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar unidades', 'error');
      listaUnidadesEl.innerHTML = `
        <div class="alerta alerta--error">No se pudieron cargar las unidades.</div>
      `;
    }
  }

  function renderizarUnidades() {
    if (unidadesAsignatura.length === 0) {
      listaUnidadesEl.innerHTML = `
        <div class="vacio" style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
          No hay unidades creadas en esta asignatura. Usa <strong>+ Nueva Unidad</strong> para comenzar.
        </div>
      `;
      return;
    }

    listaUnidadesEl.innerHTML = '';

    unidadesAsignatura.forEach((u, index) => {
      const esActiva = unidadSeleccionada && unidadSeleccionada.id === u.id;
      const esPrimera = index === 0;
      const esUltima = index === unidadesAsignatura.length - 1;

      const itemEl = document.createElement('article');
      itemEl.className = `item-tarjeta${esActiva ? ' item-tarjeta--activa' : ''}`;

      itemEl.innerHTML = `
        <div class="item-tarjeta__fila-superior">
          <div class="item-tarjeta__titulo-bloque" data-id="${u.id}">
            <span class="chip" style="font-weight: var(--peso-negrita); font-size: var(--tamano-xs);">
              Unidad ${u.orden || (index + 1)}
            </span>
            <h3 class="item-tarjeta__titulo">${ui.escapar(u.titulo)}</h3>
          </div>
          <span class="insignia ${u.visible !== false ? 'insignia--exito' : 'insignia--advertencia'}">
            ${u.visible !== false ? 'Visible' : 'Oculta'}
          </span>
        </div>

        <div class="item-tarjeta__acciones">
          <button type="button" class="btn btn--secundario btn-orden btn-subir-unidad" title="Subir orden" ${esPrimera ? 'disabled' : ''} data-index="${index}">
            ▲
          </button>
          <button type="button" class="btn btn--secundario btn-orden btn-bajar-unidad" title="Bajar orden" ${esUltima ? 'disabled' : ''} data-index="${index}">
            ▼
          </button>
          <button type="button" class="btn btn--secundario btn--pequeno btn-renombrar-unidad" data-id="${u.id}" data-titulo="${ui.escapar(u.titulo)}">
            Renombrar
          </button>
          <button type="button" class="btn btn--secundario btn--pequeno btn-visibilidad-unidad" data-id="${u.id}" data-visible="${u.visible !== false}">
            ${u.visible !== false ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      `;

      // Clic en el título o tarjeta para seleccionar
      itemEl.querySelector('.item-tarjeta__titulo-bloque').addEventListener('click', () => {
        seleccionarUnidad(u);
      });

      listaUnidadesEl.appendChild(itemEl);
    });

    // Eventos de botones
    listaUnidadesEl.querySelectorAll('.btn-subir-unidad').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        await moverUnidad(idx, idx - 1);
      });
    });

    listaUnidadesEl.querySelectorAll('.btn-bajar-unidad').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        await moverUnidad(idx, idx + 1);
      });
    });

    listaUnidadesEl.querySelectorAll('.btn-renombrar-unidad').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const tituloActual = btn.getAttribute('data-titulo');
        await abrirModalRenombrarUnidad(id, tituloActual);
      });
    });

    listaUnidadesEl.querySelectorAll('.btn-visibilidad-unidad').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const estaVisible = btn.getAttribute('data-visible') === 'true';
        await toggleVisibilidadUnidad(id, !estaVisible);
      });
    });
  }

  async function seleccionarUnidad(u) {
    unidadSeleccionada = u;
    subtituloUnidadActual.textContent = `Unidad ${u.orden || ''}: ${u.titulo}`;
    btnNuevoTema.disabled = false;

    // Resaltar activa en la lista
    const todasTarjetas = listaUnidadesEl.querySelectorAll('.item-tarjeta');
    todasTarjetas.forEach((tarjeta, index) => {
      if (unidadesAsignatura[index] && unidadesAsignatura[index].id === u.id) {
        tarjeta.classList.add('item-tarjeta--activa');
      } else {
        tarjeta.classList.remove('item-tarjeta--activa');
      }
    });

    await recargarTemas();
  }

  function deseleccionarUnidad() {
    unidadSeleccionada = null;
    subtituloUnidadActual.textContent = 'Selecciona una unidad para ver sus temas';
    btnNuevoTema.disabled = true;
    listaTemasEl.innerHTML = `
      <div class="vacio" style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
        Ninguna unidad seleccionada
      </div>
    `;
  }

  async function moverUnidad(desdeIdx, haciaIdx) {
    if (desdeIdx < 0 || haciaIdx < 0 || desdeIdx >= unidadesAsignatura.length || haciaIdx >= unidadesAsignatura.length) {
      return;
    }

    const copia = [...unidadesAsignatura];
    const [movido] = copia.splice(desdeIdx, 1);
    copia.splice(haciaIdx, 0, movido);

    try {
      ui.aviso('Actualizando orden de unidades...', 'info');
      // Actualizar los dos elementos intercambiados
      for (let i = 0; i < copia.length; i++) {
        const nuevoOrden = i + 1;
        if (copia[i].orden !== nuevoOrden) {
          await api.actualizar('unidades', copia[i].id, {
            asignaturaId: asignaturaActualId,
            orden: nuevoOrden
          });
          copia[i].orden = nuevoOrden;
        }
      }
      ui.aviso('Orden de unidades actualizado', 'exito');
      await recargarUnidades();
    } catch (err) {
      ui.aviso(err.message || 'Error al ordenar unidades', 'error');
    }
  }

  async function toggleVisibilidadUnidad(id, nuevoVisible) {
    try {
      await api.actualizar('unidades', id, {
        asignaturaId: asignaturaActualId,
        visible: nuevoVisible
      });
      ui.aviso(nuevoVisible ? 'Unidad ahora visible para estudiantes' : 'Unidad oculta para estudiantes', 'exito');
      await recargarUnidades();
    } catch (err) {
      ui.aviso(err.message || 'Error al cambiar visibilidad', 'error');
    }
  }

  async function abrirModalNuevaUnidad() {
    const div = document.createElement('div');
    div.className = 'pila';
    div.innerHTML = `
      <div class="campo">
        <label for="inputTituloUnidad">Título de la Unidad</label>
        <input type="text" id="inputTituloUnidad" placeholder="Ej. Conceptos financieros básicos" required>
        <span class="campo__error" id="errorTituloUnidad"></span>
      </div>
    `;

    await ui.modal({
      titulo: 'Nueva Unidad',
      contenido: div,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        {
          texto: 'Crear Unidad',
          clase: 'btn--primario',
          accion: async (cerrar) => {
            const input = div.querySelector('#inputTituloUnidad');
            const error = div.querySelector('#errorTituloUnidad');
            const titulo = input.value.trim();

            if (!titulo) {
              error.textContent = 'El título de la unidad es obligatorio.';
              input.focus();
              return false;
            }

            const maxOrden = unidadesAsignatura.reduce((max, u) => Math.max(max, u.orden || 0), 0);

            try {
              const nueva = await api.crear('unidades', {
                asignaturaId: asignaturaActualId,
                titulo,
                orden: maxOrden + 1,
                visible: true
              });
              ui.aviso('Unidad creada exitosamente', 'exito');
              cerrar(true);
              await recargarUnidades();
              seleccionarUnidad(nueva);
            } catch (err) {
              ui.aviso(err.message || 'Error al crear la unidad', 'error');
              return false;
            }
          }
        }
      ]
    });
  }

  async function abrirModalRenombrarUnidad(id, tituloActual) {
    const div = document.createElement('div');
    div.className = 'pila';
    div.innerHTML = `
      <div class="campo">
        <label for="inputRenombrarUnidad">Nuevo título de la Unidad</label>
        <input type="text" id="inputRenombrarUnidad" value="${ui.escapar(tituloActual)}" required>
        <span class="campo__error" id="errorRenombrarUnidad"></span>
      </div>
    `;

    await ui.modal({
      titulo: 'Renombrar Unidad',
      contenido: div,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        {
          texto: 'Guardar',
          clase: 'btn--primario',
          accion: async (cerrar) => {
            const input = div.querySelector('#inputRenombrarUnidad');
            const error = div.querySelector('#errorRenombrarUnidad');
            const titulo = input.value.trim();

            if (!titulo) {
              error.textContent = 'El título no puede estar vacío.';
              input.focus();
              return false;
            }

            try {
              await api.actualizar('unidades', id, {
                asignaturaId: asignaturaActualId,
                titulo
              });
              ui.aviso('Unidad renombrada con éxito', 'exito');
              cerrar(true);
              await recargarUnidades();
            } catch (err) {
              ui.aviso(err.message || 'Error al renombrar unidad', 'error');
              return false;
            }
          }
        }
      ]
    });
  }

  // =================== GESTIÓN DE TEMAS ===================

  async function recargarTemas() {
    if (!unidadSeleccionada) {
      deseleccionarUnidad();
      return;
    }

    listaTemasEl.innerHTML = `
      <div style="text-align: center; padding: var(--espacio-l);">
        <div class="cargando" role="status" aria-label="Cargando temas"></div>
      </div>
    `;

    try {
      todosLosTemas = await api.listar('temas');
      temasUnidad = (todosLosTemas || [])
        .filter((t) => t.unidadId === unidadSeleccionada.id)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      renderizarTemas();
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar temas', 'error');
      listaTemasEl.innerHTML = `
        <div class="alerta alerta--error">No se pudieron cargar los temas de esta unidad.</div>
      `;
    }
  }

  function renderizarTemas() {
    if (temasUnidad.length === 0) {
      listaTemasEl.innerHTML = `
        <div class="vacio" style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
          Esta unidad aún no tiene temas. Haz clic en <strong>+ Nuevo Tema</strong> para agregar uno.
        </div>
      `;
      return;
    }

    listaTemasEl.innerHTML = '';

    temasUnidad.forEach((t, index) => {
      const esPrimero = index === 0;
      const esUltimo = index === temasUnidad.length - 1;
      const esPublicado = t.estado === 'publicado';

      const itemEl = document.createElement('article');
      itemEl.className = 'item-tarjeta';

      itemEl.innerHTML = `
        <div class="item-tarjeta__fila-superior">
          <div class="fila" style="align-items: center; gap: var(--espacio-s); flex-grow: 1;">
            <span class="chip" style="font-weight: var(--peso-negrita); font-size: var(--tamano-xs);">
              Tema ${t.orden || (index + 1)}
            </span>
            <h3 class="item-tarjeta__titulo">${ui.escapar(t.titulo)}</h3>
          </div>
          <span class="insignia ${esPublicado ? 'insignia--exito' : 'insignia--advertencia'}">
            ${esPublicado ? 'Publicado' : 'Borrador'}
          </span>
        </div>

        <div class="item-tarjeta__acciones">
          <button type="button" class="btn btn--secundario btn-orden btn-subir-tema" title="Subir orden" ${esPrimero ? 'disabled' : ''} data-index="${index}">
            ▲
          </button>
          <button type="button" class="btn btn--secundario btn-orden btn-bajar-tema" title="Bajar orden" ${esUltimo ? 'disabled' : ''} data-index="${index}">
            ▼
          </button>
          <button type="button" class="btn ${esPublicado ? 'btn--secundario' : 'btn--primario'} btn--pequeno btn-estado-tema" data-id="${t.id}" data-estado="${t.estado}">
            ${esPublicado ? 'Pasar a borrador' : 'Publicar'}
          </button>
          <a href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--secundario btn--pequeno">
            Editar ficha
          </a>
        </div>
      `;

      listaTemasEl.appendChild(itemEl);
    });

    // Eventos de temas
    listaTemasEl.querySelectorAll('.btn-subir-tema').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        await moverTema(idx, idx - 1);
      });
    });

    listaTemasEl.querySelectorAll('.btn-bajar-tema').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        await moverTema(idx, idx + 1);
      });
    });

    listaTemasEl.querySelectorAll('.btn-estado-tema').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const estadoActual = btn.getAttribute('data-estado');
        const nuevoEstado = estadoActual === 'publicado' ? 'borrador' : 'publicado';
        await cambiarEstadoTema(id, nuevoEstado);
      });
    });
  }

  async function moverTema(desdeIdx, haciaIdx) {
    if (desdeIdx < 0 || haciaIdx < 0 || desdeIdx >= temasUnidad.length || haciaIdx >= temasUnidad.length) {
      return;
    }

    const copia = [...temasUnidad];
    const [movido] = copia.splice(desdeIdx, 1);
    copia.splice(haciaIdx, 0, movido);

    try {
      ui.aviso('Actualizando orden de temas...', 'info');
      for (let i = 0; i < copia.length; i++) {
        const nuevoOrden = i + 1;
        if (copia[i].orden !== nuevoOrden) {
          await api.actualizar('temas', copia[i].id, {
            unidadId: unidadSeleccionada.id,
            orden: nuevoOrden
          });
          copia[i].orden = nuevoOrden;
        }
      }
      ui.aviso('Orden de temas actualizado', 'exito');
      await recargarTemas();
    } catch (err) {
      ui.aviso(err.message || 'Error al ordenar temas', 'error');
    }
  }

  async function cambiarEstadoTema(id, nuevoEstado) {
    try {
      await api.actualizar('temas', id, {
        unidadId: unidadSeleccionada.id,
        estado: nuevoEstado
      });
      ui.aviso(`Tema marcado como ${nuevoEstado}`, 'exito');
      await recargarTemas();
    } catch (err) {
      ui.aviso(err.message || 'Error al cambiar estado del tema', 'error');
    }
  }

  async function abrirModalNuevoTema() {
    if (!unidadSeleccionada) return;

    const div = document.createElement('div');
    div.className = 'pila';
    div.innerHTML = `
      <div class="campo">
        <label for="inputTituloTema">Título del Tema</label>
        <input type="text" id="inputTituloTema" placeholder="Ej. Ingresos y costos" required>
        <span class="campo__error" id="errorTituloTema"></span>
        <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
          El tema se creará inicialmente en estado <strong>borrador</strong>.
        </span>
      </div>
    `;

    await ui.modal({
      titulo: 'Nuevo Tema',
      contenido: div,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        {
          texto: 'Crear Tema',
          clase: 'btn--primario',
          accion: async (cerrar) => {
            const input = div.querySelector('#inputTituloTema');
            const error = div.querySelector('#errorTituloTema');
            const titulo = input.value.trim();

            if (!titulo) {
              error.textContent = 'El título del tema es obligatorio.';
              input.focus();
              return false;
            }

            const maxOrden = temasUnidad.reduce((max, t) => Math.max(max, t.orden || 0), 0);

            try {
              await api.crear('temas', {
                unidadId: unidadSeleccionada.id,
                titulo,
                orden: maxOrden + 1,
                estado: 'borrador'
              });
              ui.aviso('Tema creado como borrador', 'exito');
              cerrar(true);
              await recargarTemas();
            } catch (err) {
              ui.aviso(err.message || 'Error al crear el tema', 'error');
              return false;
            }
          }
        }
      ]
    });
  }

  // Eventos principales
  selectorAsignatura.addEventListener('change', async () => {
    asignaturaActualId = selectorAsignatura.value;
    unidadSeleccionada = null;
    await recargarUnidades();
  });

  btnNuevaUnidad.addEventListener('click', abrirModalNuevaUnidad);
  btnNuevoTema.addEventListener('click', abrirModalNuevoTema);

  await cargarAsignaturas();
}

