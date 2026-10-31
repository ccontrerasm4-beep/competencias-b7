import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Administración de Usuarios", roles: ["admin"] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta" style="margin-bottom: var(--espacio-l);">
      <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-m);">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">
            Administra los roles, estados de activación y restablecimiento de claves de acceso.
          </p>
        </div>
        <button type="button" class="btn btn--secundario btn--pequeno" id="btnRecargar">Actualizar lista</button>
      </div>

      <div class="admin-filtros">
        <div class="campo" style="max-width: 320px;">
          <label for="filtroTexto">Buscar por nombre, apellido o correo</label>
          <input type="search" id="filtroTexto" placeholder="Buscar usuario...">
        </div>

        <div class="campo" style="max-width: 220px;">
          <label for="filtroRol">Filtrar por rol</label>
          <select id="filtroRol">
            <option value="todos">Todos los roles</option>
            <option value="estudiante">Estudiantes</option>
            <option value="docente">Docentes</option>
            <option value="admin">Administradores</option>
          </select>
        </div>
      </div>

      <div class="tabla-contenedor">
        <table class="tabla admin-tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th style="text-align: center;">Activo</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpoTabla">
            <tr>
              <td colspan="5" style="text-align: center; padding: var(--espacio-xl);">
                <div class="cargando" role="status" aria-label="Cargando"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let listaUsuarios = [];
  const cuerpoTabla = document.getElementById('cuerpoTabla');
  const filtroTexto = document.getElementById('filtroTexto');
  const filtroRol = document.getElementById('filtroRol');
  const btnRecargar = document.getElementById('btnRecargar');

  async function cargarLista() {
    try {
      listaUsuarios = await api.listar('usuarios');
      renderizarTabla();
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar usuarios', 'error');
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--color-error); padding: var(--espacio-l);">
            No se pudo obtener la lista de usuarios.
          </td>
        </tr>
      `;
    }
  }

  function renderizarTabla() {
    const textoBuscado = filtroTexto.value.trim().toLowerCase();
    const rolSeleccionado = filtroRol.value;

    const filtrados = listaUsuarios.filter((u) => {
      const coincideTexto = !textoBuscado ||
        (u.nombre && u.nombre.toLowerCase().includes(textoBuscado)) ||
        (u.apellido && u.apellido.toLowerCase().includes(textoBuscado)) ||
        (u.correo && u.correo.toLowerCase().includes(textoBuscado));

      const coincideRol = rolSeleccionado === 'todos' || u.rol === rolSeleccionado;

      return coincideTexto && coincideRol;
    });

    if (filtrados.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
            No se encontraron usuarios que coincidan con los filtros aplicados.
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTabla.innerHTML = filtrados.map((u) => `
      <tr data-id="${ui.escapar(u.id)}">
        <td>
          <div class="fila" style="gap: var(--espacio-s);">
            <strong style="color: var(--color-primario);">${ui.escapar(u.nombre || '')} ${ui.escapar(u.apellido || '')}</strong>
          </div>
        </td>
        <td>
          <span style="font-size: var(--tamano-s);">${ui.escapar(u.correo || '')}</span>
        </td>
        <td>
          <select class="sel-rol" data-id="${ui.escapar(u.id)}" aria-label="Rol para ${ui.escapar(u.nombre || '')}">
            <option value="estudiante"${u.rol === 'estudiante' ? ' selected' : ''}>Estudiante</option>
            <option value="docente"${u.rol === 'docente' ? ' selected' : ''}>Docente</option>
            <option value="admin"${u.rol === 'admin' ? ' selected' : ''}>Admin</option>
          </select>
        </td>
        <td style="text-align: center;">
          <input type="checkbox" class="check-activo" data-id="${ui.escapar(u.id)}" ${u.activo ? 'checked' : ''} aria-label="Estado activo para ${ui.escapar(u.nombre || '')}">
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn btn--secundario btn--pequeno btn-restablecer" data-id="${ui.escapar(u.id)}" data-nombre="${ui.escapar(u.nombre || '')}">
            Restablecer clave
          </button>
        </td>
      </tr>
    `).join('\n');

    // Conectar eventos de cambio de rol
    cuerpoTabla.querySelectorAll('.sel-rol').forEach((select) => {
      let valorPrevio = select.value;
      select.addEventListener('change', async () => {
        const id = select.getAttribute('data-id');
        const nuevoRol = select.value;
        try {
          await api.actualizar('usuarios', id, { rol: nuevoRol });
          valorPrevio = nuevoRol;
          const index = listaUsuarios.findIndex((it) => it.id === id);
          if (index !== -1) listaUsuarios[index].rol = nuevoRol;
          ui.aviso('Rol actualizado con éxito', 'exito');
        } catch (err) {
          select.value = valorPrevio;
          ui.aviso(err.message || 'Error al actualizar el rol', 'error');
        }
      });
    });

    // Conectar eventos de cambio de estado activo
    cuerpoTabla.querySelectorAll('.check-activo').forEach((checkbox) => {
      let estadoPrevio = checkbox.checked;
      checkbox.addEventListener('change', async () => {
        const id = checkbox.getAttribute('data-id');
        const nuevoActivo = checkbox.checked;
        try {
          await api.actualizar('usuarios', id, { activo: nuevoActivo });
          estadoPrevio = nuevoActivo;
          const index = listaUsuarios.findIndex((it) => it.id === id);
          if (index !== -1) listaUsuarios[index].activo = nuevoActivo;
          ui.aviso(nuevoActivo ? 'Usuario activado' : 'Usuario desactivado', 'exito');
        } catch (err) {
          checkbox.checked = estadoPrevio;
          ui.aviso(err.message || 'Error al cambiar el estado del usuario', 'error');
        }
      });
    });

    // Conectar botones de restablecimiento de clave
    cuerpoTabla.querySelectorAll('.btn-restablecer').forEach((boton) => {
      boton.addEventListener('click', async () => {
        const id = boton.getAttribute('data-id');
        const nombre = boton.getAttribute('data-nombre');

        const confirmado = await ui.confirmar(`¿Estás seguro de que deseas restablecer la contraseña de ${nombre}?`);
        if (!confirmado) return;

        try {
          const res = await api.llamar('POST', `/api/admin/usuarios/${id}/restablecer`);
          const claveTemporal = res.claveTemporal;

          const divContenido = document.createElement('div');
          divContenido.innerHTML = `
            <p>Se ha generado una nueva contraseña temporal para <strong>${ui.escapar(nombre)}</strong>.</p>
            <p style="font-size: var(--tamano-s); color: var(--color-texto-suave);">Esta clave se muestra una sola vez:</p>
            <div style="background-color: var(--color-fondo); border: 1px dashed var(--color-borde); padding: var(--espacio-m); border-radius: var(--radio-m); text-align: center; margin: var(--espacio-m) 0;">
              <code style="font-size: var(--tamano-xl); font-weight: var(--peso-negrita); letter-spacing: 0.08em; color: var(--color-primario);">${ui.escapar(claveTemporal)}</code>
            </div>
          `;

          const accion = await ui.modal({
            titulo: 'Contraseña Temporal Generada',
            contenido: divContenido,
            acciones: [
              { texto: 'Copiar clave', valor: 'copiar', clase: 'btn-primario' },
              { texto: 'Cerrar', valor: null, clase: 'btn-secundario' }
            ]
          });

          if (accion === 'copiar') {
            await navigator.clipboard.writeText(claveTemporal);
            ui.aviso('Contraseña temporal copiada al portapapeles', 'exito');
          }
        } catch (err) {
          ui.aviso(err.message || 'Error al restablecer la contraseña', 'error');
        }
      });
    });
  }

  filtroTexto.addEventListener('input', renderizarTabla);
  filtroRol.addEventListener('change', renderizarTabla);
  btnRecargar.addEventListener('click', cargarLista);

  await cargarLista();
}

