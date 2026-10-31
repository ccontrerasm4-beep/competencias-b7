import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Prueba de datos", roles: ["publico"] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="prueba-contenedor">
      <section class="tarjeta prueba-form-tarjeta">
        <h2>Crear nuevo registro</h2>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">
          Guarda un registro en la colección <code>prueba</code> mediante el cliente de la API.
        </p>

        <form id="formPrueba" class="pila" style="margin-top: var(--espacio-m);">
          <div class="campo">
            <label for="campoTexto">Texto del registro</label>
            <input type="text" id="campoTexto" name="texto" placeholder="Escribe un mensaje de prueba..." required autocomplete="off">
          </div>

          <div class="fila" style="justify-content: flex-end;">
            <button type="submit" class="btn btn--primario" id="btnGuardar">Guardar registro</button>
          </div>
        </form>
      </section>

      <section class="tarjeta prueba-lista-tarjeta">
        <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-m);">
          <h2>Registros en la colección</h2>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btnRecargar">Actualizar lista</button>
        </div>

        <div id="contenedorLista">
          <div class="fila" style="justify-content: center; padding: var(--espacio-xl);">
            <div class="cargando" role="status" aria-label="Cargando"></div>
          </div>
        </div>
      </section>
    </div>
  `;

  const form = document.getElementById('formPrueba');
  const inputTexto = document.getElementById('campoTexto');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnRecargar = document.getElementById('btnRecargar');
  const contenedorLista = document.getElementById('contenedorLista');

  async function cargarRegistros() {
    try {
      const registros = await api.listar('prueba');

      if (!Array.isArray(registros) || registros.length === 0) {
        contenedorLista.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono">📝</div>
            <h3 class="vacio__titulo">No hay registros</h3>
            <p class="vacio__descripcion">La colección está vacía. Agrega tu primer registro usando el formulario de arriba.</p>
          </div>
        `;
        return;
      }

      const filasHtml = registros.map((reg) => `
        <div class="prueba-registro">
          <div class="prueba-registro__info">
            <strong style="color: var(--color-primario); font-size: var(--tamano-m);">${ui.escapar(reg.texto || reg.nombre || reg.mensaje || '(sin texto)')}</strong>
            <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
              ID: <code>${ui.escapar(reg.id || '')}</code> · Fecha: ${ui.escapar(reg.fecha || '')}
            </span>
          </div>
          <span class="insignia insignia--primario">${ui.escapar(reg.id || '')}</span>
        </div>
      `).join('\n');

      contenedorLista.innerHTML = `
        <div style="border: 1px solid var(--color-borde); border-radius: var(--radio-m); overflow: hidden;">
          ${filasHtml}
        </div>
      `;
    } catch (err) {
      ui.aviso(err.message || 'Error al obtener los registros', 'error');
      contenedorLista.innerHTML = `
        <div class="alerta alerta--error">
          No se pudo cargar la lista: ${ui.escapar(err.message || 'Error desconocido')}
        </div>
      `;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = inputTexto.value.trim();
    if (!texto) {
      ui.aviso('El campo de texto no puede estar vacío', 'advertencia');
      return;
    }

    btnGuardar.disabled = true;
    try {
      await api.crear('prueba', { texto });
      ui.aviso('Registro guardado correctamente', 'exito');
      inputTexto.value = '';
      await cargarRegistros();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar el registro', 'error');
    } finally {
      btnGuardar.disabled = false;
      inputTexto.focus();
    }
  });

  btnRecargar.addEventListener('click', async () => {
    await cargarRegistros();
    ui.aviso('Lista actualizada', 'info');
  });

  // Carga inicial
  await cargarRegistros();
}

