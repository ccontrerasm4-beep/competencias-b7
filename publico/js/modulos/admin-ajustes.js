import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

let configuracionActual = {
  iaProveedor: 'gemini',
  iaModelo: 'gemini-1.5-flash',
  iaClave: '',
  limiteIADiario: 30
};

async function inicializar() {
  await montarPlantilla({
    titulo: 'Configuración del Sistema',
    roles: ['admin']
  });

  ui.cargando(true);
  try {
    const config = await api.llamar('GET', '/api/ia/config');
    configuracionActual = { ...configuracionActual, ...config };
    renderizar();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar la configuración', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizar() {
  const main = document.getElementById('contenido');
  if (!main) return;

  const tieneClave = Boolean(configuracionActual.iaClave);

  main.innerHTML = `
    <div class="ajustes-contenedor">
      <header class="ajustes-cabecera">
        <h1>Ajustes y Configuración de IA</h1>
        <p class="texto-suave">Configura el proveedor de Inteligencia Artificial (Google Gemini), el modelo y las credenciales de acceso para la plataforma.</p>
      </header>

      <div class="ajustes-seccion">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
          <h2>Google Gemini / Inteligencia Artificial</h2>
          <span class="badge ${tieneClave ? 'badge--exito' : 'badge--advertencia'}">
            ${tieneClave ? '● Clave configurada' : '○ Modo simulado (Sin clave)'}
          </span>
        </div>

        <form id="form-ajustes-ia" class="ajustes-formulario">
          <div class="ajustes-campo">
            <label for="ia-proveedor">Proveedor de IA:</label>
            <select id="ia-proveedor" class="control-select">
              <option value="gemini" ${configuracionActual.iaProveedor === 'gemini' ? 'selected' : ''}>Google Gemini API</option>
            </select>
            <small class="ajustes-campo-pista">Proveedor principal para generación de preguntas, glosarios y retroalimentación pedagógica.</small>
          </div>

          <div class="ajustes-campo">
            <label for="ia-modelo">Modelo de IA:</label>
            <input type="text" id="ia-modelo" class="control-input" list="lista-modelos-gemini" value="${ui.escapar(
              configuracionActual.iaModelo || 'gemini-1.5-flash'
            )}" placeholder="Ej: gemini-3.8-flash, gemini-4-argon, gemini-1.5-flash" required>
            <datalist id="lista-modelos-gemini">
              <option value="gemini-3.8-flash">
              <option value="gemini-4-argon">
              <option value="gemini-2.0-flash">
              <option value="gemini-1.5-flash">
              <option value="gemini-1.5-pro">
            </datalist>
            <small class="ajustes-campo-pista">Puedes seleccionar uno de la lista o escribir el identificador exacto de tu modelo (ej. <code>gemini-3.8-flash</code> o <code>gemini-4-argon</code>).</small>
          </div>

          <div class="ajustes-campo">
            <label for="ia-clave">Clave de API de Gemini (API Key):</label>
            <div style="display: flex; gap: var(--espacio-xs);">
              <input type="password" id="ia-clave" class="control-input" value="${ui.escapar(
                configuracionActual.iaClave || ''
              )}" placeholder="Pega aquí tu clave de API (ej: AQ.Ab8RN6Lwh... o AIzaSy...)" autocomplete="off">
              <button type="button" id="btn-toggle-clave" class="btn btn--secundario" title="Mostrar/ocultar clave">
                👁️
              </button>
            </div>
            <small class="ajustes-campo-pista">Tu clave se almacena de forma segura en <code>datos/config/ajustes.json</code> y no se expone a roles no administradores.</small>
          </div>

          <div class="ajustes-campo">
            <label for="ia-limite">Límite diario de consultas por usuario (no admin):</label>
            <input type="number" id="ia-limite" class="control-input" min="1" max="500" value="${configuracionActual.limiteIADiario || 30}" required>
            <small class="ajustes-campo-pista">Protege tu cuota diaria limitando las peticiones automáticas de docentes y estudiantes.</small>
          </div>

          <div id="resultado-prueba" class="ajustes-resultado-prueba" aria-live="polite"></div>

          <div class="ajustes-acciones">
            <button type="button" id="btn-probar-ia" class="btn btn--secundario">
              🔌 Probar conexión con IA
            </button>
            <button type="submit" id="btn-guardar-ia" class="btn btn--primario">
              💾 Guardar configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Toggle visibilidad clave
  const btnToggle = document.getElementById('btn-toggle-clave');
  const inputClave = document.getElementById('ia-clave');
  btnToggle?.addEventListener('click', () => {
    if (inputClave.type === 'password') {
      inputClave.type = 'text';
    } else {
      inputClave.type = 'password';
    }
  });

  // Probar conexión
  document.getElementById('btn-probar-ia')?.addEventListener('click', async () => {
    const contenedorResultado = document.getElementById('resultado-prueba');
    const iaClave = document.getElementById('ia-clave').value.trim();
    const iaModelo = document.getElementById('ia-modelo').value.trim();

    if (!iaClave) {
      ui.aviso('Ingresa una clave de API antes de probar la conexión', 'advertencia');
      return;
    }

    if (contenedorResultado) {
      contenedorResultado.innerHTML = `
        <div class="alerta alerta--info">
          Conectando con Google Gemini usando el modelo <strong>${ui.escapar(iaModelo)}</strong>...
        </div>
      `;
    }

    ui.cargando(true);
    try {
      const res = await api.llamar('POST', '/api/ia/probar-conexion', { iaClave, iaModelo });
      if (res.ok) {
        if (contenedorResultado) {
          contenedorResultado.innerHTML = `
            <div class="alerta alerta--exito">
              <strong>¡Conexión exitosa!</strong> ${ui.escapar(res.mensaje)}.<br>
              <small>Respuesta recibida: <code>${ui.escapar(JSON.stringify(res.respuesta))}</code></small>
            </div>
          `;
        }
        ui.aviso('Conexión con Gemini verificada correctamente', 'exito');
      } else {
        throw new Error(res.error || 'Error al conectar');
      }
    } catch (err) {
      if (contenedorResultado) {
        contenedorResultado.innerHTML = `
          <div class="alerta alerta--error">
            <strong>Error de conexión:</strong> ${ui.escapar(err.message)}
          </div>
        `;
      }
      ui.aviso(err.message || 'Error en la prueba de conexión', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Guardar configuración
  document.getElementById('form-ajustes-ia')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const iaProveedor = document.getElementById('ia-proveedor').value.trim();
    const iaModelo = document.getElementById('ia-modelo').value.trim();
    const iaClave = document.getElementById('ia-clave').value.trim();
    const limiteIADiario = parseInt(document.getElementById('ia-limite').value, 10) || 30;

    ui.cargando(true);
    try {
      const res = await api.llamar('PUT', '/api/ia/config', {
        iaProveedor,
        iaModelo,
        iaClave,
        limiteIADiario
      });

      configuracionActual = { ...configuracionActual, ...res.ajustes };
      ui.aviso('Configuración guardada exitosamente', 'exito');
      renderizar();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar configuración', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

inicializar();

