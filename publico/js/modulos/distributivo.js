import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Distributivo Docente", roles: ["admin"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="distributivo-cabecera">
      <div>
        <h1>Distributivo de Grupos</h1>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
          Asigna docentes y nóminas de estudiantes a cada paralelo y asignatura.
        </p>
      </div>
      <button type="button" class="btn btn--primario" id="btnNuevoGrupo">
        + Nuevo Grupo
      </button>
    </div>

    <div class="tarjeta" style="margin-bottom: var(--espacio-l);">
      <div class="tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th>Asignatura</th>
              <th>Paralelo</th>
              <th>Período</th>
              <th>Docente</th>
              <th style="text-align: center;">N.º Estudiantes</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpoTablaGrupos">
            <tr>
              <td colspan="6" style="text-align: center; padding: var(--espacio-xl);">
                <div class="cargando" role="status" aria-label="Cargando distributivo"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const cuerpoTabla = document.getElementById('cuerpoTablaGrupos');
  const btnNuevoGrupo = document.getElementById('btnNuevoGrupo');

  let grupos = [];
  let asignaturas = [];
  let usuarios = [];

  async function cargarDatos() {
    try {
      const [listaGrupos, listaAsig, listaUsr] = await Promise.all([
        api.listar('distributivo'),
        api.listar('asignaturas'),
        api.listar('usuarios')
      ]);

      grupos = Array.isArray(listaGrupos) ? listaGrupos : [];
      asignaturas = Array.isArray(listaAsig) ? listaAsig : [];
      usuarios = Array.isArray(listaUsr) ? listaUsr : [];

      renderizarTabla();
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar distributivo', 'error');
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--color-error); padding: var(--espacio-l);">
            No se pudo obtener la información del distributivo.
          </td>
        </tr>
      `;
    }
  }

  function obtenerNombreAsignatura(asigId) {
    const asig = asignaturas.find((a) => a.id === asigId);
    return asig ? asig.nombre : asigId;
  }

  function obtenerNombreDocente(docenteId) {
    const doc = usuarios.find((u) => u.id === docenteId);
    return doc ? `${doc.nombre} ${doc.apellido}` : (docenteId || 'Sin asignar');
  }

  function renderizarTabla() {
    if (grupos.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
            No hay grupos registrados en el distributivo. Haz clic en <strong>+ Nuevo Grupo</strong> para crear uno.
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTabla.innerHTML = grupos.map((g) => {
      const nombreAsig = obtenerNombreAsignatura(g.asignaturaId);
      const nombreDoc = obtenerNombreDocente(g.docenteId);
      const numEstudiantes = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

      return `
        <tr>
          <td>
            <strong>${ui.escapar(nombreAsig)}</strong>
          </td>
          <td>
            <span class="chip">${ui.escapar(g.paralelo || '-')}</span>
          </td>
          <td>${ui.escapar(g.periodo || '-')}</td>
          <td>${ui.escapar(nombreDoc)}</td>
          <td style="text-align: center;">
            <span class="insignia insignia--primario">${numEstudiantes}</span>
          </td>
          <td style="text-align: right;">
            <div class="fila" style="justify-content: flex-end; gap: var(--espacio-xs);">
              <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${g.id}">
                Editar
              </button>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${g.id}" data-paralelo="${ui.escapar(g.paralelo)}" data-asig="${ui.escapar(nombreAsig)}">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos de edición y eliminación
    cuerpoTabla.querySelectorAll('.btn-editar').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const grupo = grupos.find((g) => g.id === id);
        if (grupo) abrirModalGrupo(grupo);
      });
    });

    cuerpoTabla.querySelectorAll('.btn-eliminar').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const asig = btn.getAttribute('data-asig');
        const paralelo = btn.getAttribute('data-paralelo');

        const confirmado = await ui.confirmar(
          `¿Estás seguro de que deseas eliminar el grupo de "${asig}" (Paralelo ${paralelo})?`
        );
        if (!confirmado) return;

        try {
          await api.eliminar('distributivo', id);
          ui.aviso('Grupo eliminado del distributivo con éxito', 'exito');
          await cargarDatos();
        } catch (err) {
          ui.aviso(err.message || 'Error al eliminar grupo', 'error');
        }
      });
    });
  }

  async function abrirModalGrupo(grupo = null) {
    const esEdicion = Boolean(grupo);
    const docentes = usuarios.filter((u) => u.rol === 'docente');
    const estudiantes = usuarios.filter((u) => u.rol === 'estudiante');

    if (asignaturas.length === 0) {
      ui.aviso('Debes crear al menos una asignatura antes de registrar grupos en el distributivo.', 'advertencia');
      return;
    }

    const estudiantesSeleccionados = new Set(
      esEdicion && Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []
    );

    const formContenedor = document.createElement('div');
    formContenedor.className = 'pila';

    const opcionesAsignaturas = asignaturas.map((a) => {
      const selected = grupo?.asignaturaId === a.id ? 'selected' : '';
      return `<option value="${a.id}" ${selected}>${ui.escapar(a.nombre)} (${ui.escapar(a.nivel)})</option>`;
    }).join('');

    const opcionesDocentes = docentes.length > 0
      ? docentes.map((d) => {
          const selected = grupo?.docenteId === d.id ? 'selected' : '';
          return `<option value="${d.id}" ${selected}>${ui.escapar(d.nombre)} ${ui.escapar(d.apellido)} (${ui.escapar(d.correo)})</option>`;
        }).join('')
      : '<option value="">No hay docentes registrados</option>';

    formContenedor.innerHTML = `
      <div class="campo">
        <label for="grupoAsignatura">Asignatura</label>
        <select id="grupoAsignatura" required>
          ${opcionesAsignaturas}
        </select>
        <span class="campo__error" id="errorGrupoAsignatura"></span>
      </div>

      <div class="fila" style="gap: var(--espacio-m);">
        <div class="campo">
          <label for="grupoParalelo">Paralelo</label>
          <input type="text" id="grupoParalelo" value="${ui.escapar(grupo?.paralelo || 'A')}" placeholder="Ej. A, B, C" required>
          <span class="campo__error" id="errorGrupoParalelo"></span>
        </div>

        <div class="campo">
          <label for="grupoPeriodo">Período Académico</label>
          <input type="text" id="grupoPeriodo" value="${ui.escapar(grupo?.periodo || '2026-2027')}" placeholder="Ej. 2026-2027" required>
          <span class="campo__error" id="errorGrupoPeriodo"></span>
        </div>
      </div>

      <div class="campo">
        <label for="grupoDocente">Docente Asignado</label>
        <select id="grupoDocente" required>
          ${opcionesDocentes}
        </select>
        <span class="campo__error" id="errorGrupoDocente"></span>
      </div>

      <div class="campo">
        <div class="distributivo-estudiantes-selector">
          <div class="distributivo-estudiantes-acciones">
            <label style="margin: 0; font-weight: var(--peso-seminegrita);">
              Estudiantes inscritos:
            </label>
            <span id="contadorEstudiantes" class="chip">
              ${estudiantesSeleccionados.size} seleccionados
            </span>
          </div>

          <input type="search" id="filtroEstudiante" placeholder="Buscar por nombre o correo..." style="font-size: var(--tamano-s);">

          <div class="fila" style="gap: var(--espacio-s); margin-bottom: var(--espacio-xs);">
            <button type="button" class="btn btn--secundario btn--pequeno" id="btnMarcarTodos" style="font-size: var(--tamano-xs); padding: var(--espacio-xs) var(--espacio-s);">
              Seleccionar todos
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btnDesmarcarTodos" style="font-size: var(--tamano-xs); padding: var(--espacio-xs) var(--espacio-s);">
              Deseleccionar todos
            </button>
          </div>

          <div class="distributivo-estudiantes-lista" id="listaEstudiantesCheckboxes">
            ${
              estudiantes.length > 0
                ? estudiantes.map((e) => {
                    const marcado = estudiantesSeleccionados.has(e.id) ? 'checked' : '';
                    return `
                      <label class="distributivo-estudiante-item" data-nombre="${ui.escapar(e.nombre.toLowerCase())} ${ui.escapar(e.apellido.toLowerCase())}" data-correo="${ui.escapar(e.correo.toLowerCase())}">
                        <input type="checkbox" value="${e.id}" class="chk-estudiante" ${marcado}>
                        <div class="distributivo-estudiante-info">
                          <span class="distributivo-estudiante-nombre">${ui.escapar(e.nombre)} ${ui.escapar(e.apellido)}</span>
                          <span class="distributivo-estudiante-correo">${ui.escapar(e.correo)}</span>
                        </div>
                      </label>
                    `;
                  }).join('')
                : '<div style="padding: var(--espacio-s); color: var(--color-texto-suave); font-size: var(--tamano-s);">No hay estudiantes registrados</div>'
            }
          </div>
        </div>
        <span class="campo__error" id="errorGrupoEstudiantes"></span>
      </div>
    `;

    // Lógica interactiva de estudiantes (buscador, checkboxes y contador)
    const contador = formContenedor.querySelector('#contadorEstudiantes');
    const inputFiltro = formContenedor.querySelector('#filtroEstudiante');
    const checkboxes = formContenedor.querySelectorAll('.chk-estudiante');
    const items = formContenedor.querySelectorAll('.distributivo-estudiante-item');
    const btnMarcarTodos = formContenedor.querySelector('#btnMarcarTodos');
    const btnDesmarcarTodos = formContenedor.querySelector('#btnDesmarcarTodos');

    function actualizarContador() {
      const totalSeleccionados = Array.from(checkboxes).filter((c) => c.checked).length;
      contador.textContent = `${totalSeleccionados} ${totalSeleccionados === 1 ? 'seleccionado' : 'seleccionados'}`;
    }

    checkboxes.forEach((chk) => {
      chk.addEventListener('change', actualizarContador);
    });

    if (inputFiltro) {
      inputFiltro.addEventListener('input', () => {
        const query = inputFiltro.value.trim().toLowerCase();
        items.forEach((item) => {
          const nombre = item.getAttribute('data-nombre') || '';
          const correo = item.getAttribute('data-correo') || '';
          const visible = !query || nombre.includes(query) || correo.includes(query);
          item.style.display = visible ? 'flex' : 'none';
        });
      });
    }

    btnMarcarTodos?.addEventListener('click', () => {
      items.forEach((item) => {
        if (item.style.display !== 'none') {
          const chk = item.querySelector('.chk-estudiante');
          if (chk) chk.checked = true;
        }
      });
      actualizarContador();
    });

    btnDesmarcarTodos?.addEventListener('click', () => {
      items.forEach((item) => {
        if (item.style.display !== 'none') {
          const chk = item.querySelector('.chk-estudiante');
          if (chk) chk.checked = false;
        }
      });
      actualizarContador();
    });

    await ui.modal({
      titulo: esEdicion ? 'Editar Grupo del Distributivo' : 'Nuevo Grupo en Distributivo',
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
            const selectAsig = formContenedor.querySelector('#grupoAsignatura');
            const inputParalelo = formContenedor.querySelector('#grupoParalelo');
            const inputPeriodo = formContenedor.querySelector('#grupoPeriodo');
            const selectDocente = formContenedor.querySelector('#grupoDocente');

            const errorParalelo = formContenedor.querySelector('#errorGrupoParalelo');
            const errorPeriodo = formContenedor.querySelector('#errorGrupoPeriodo');
            const errorDocente = formContenedor.querySelector('#errorGrupoDocente');

            const asignaturaId = selectAsig.value;
            const paralelo = inputParalelo.value.trim().toUpperCase();
            const periodo = inputPeriodo.value.trim();
            const docenteId = selectDocente.value;

            let valido = true;

            if (!paralelo) {
              errorParalelo.textContent = 'El paralelo es obligatorio (ej. A).';
              valido = false;
            } else {
              errorParalelo.textContent = '';
            }

            if (!periodo) {
              errorPeriodo.textContent = 'El período académico es obligatorio.';
              valido = false;
            } else {
              errorPeriodo.textContent = '';
            }

            if (!docenteId) {
              errorDocente.textContent = 'Debes asignar un docente al grupo.';
              valido = false;
            } else {
              errorDocente.textContent = '';
            }

            if (!valido) return false;

            const listaEstudiantesIds = Array.from(checkboxes)
              .filter((c) => c.checked)
              .map((c) => c.value);

            const datosGrupo = {
              asignaturaId,
              paralelo,
              periodo,
              docenteId,
              estudiantes: listaEstudiantesIds
            };

            try {
              if (esEdicion) {
                await api.actualizar('distributivo', grupo.id, datosGrupo);
                ui.aviso('Grupo actualizado con éxito', 'exito');
              } else {
                await api.crear('distributivo', datosGrupo);
                ui.aviso('Grupo creado con éxito en el distributivo', 'exito');
              }
              cerrar(true);
              await cargarDatos();
            } catch (err) {
              ui.aviso(err.message || 'Error al guardar el grupo', 'error');
              return false;
            }
          }
        }
      ]
    });
  }

  btnNuevoGrupo.addEventListener('click', () => abrirModalGrupo());

  await cargarDatos();
}

