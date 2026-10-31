import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: "Verificación de Certificados", roles: ["publico"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  iniciarModuloVerificar();
}

function iniciarModuloVerificar() {
  const codigoInicial = util.parametro('codigo') || '';

  contenido.innerHTML = `
    <header class="verificar-cabecera">
      <span class="insignia insignia--primario" style="margin-bottom: var(--espacio-xs);">Portal Público</span>
      <h1>Verificación de Certificados y Diplomas</h1>
      <p>
        Comprueba la autenticidad y validez oficial de los diplomas expedidos por la plataforma educativa.
      </p>
    </header>

    <section class="verificar-formulario-tarjeta" aria-label="Formulario de verificación">
      <form id="formVerificar" class="pila">
        <label for="inputCodigo" style="font-size: var(--tamano-s); font-weight: var(--peso-seminegrita);">
          Código del certificado (ej. EE-2026-ABC123)
        </label>
        <div class="verificar-input-grupo">
          <input
            type="text"
            id="inputCodigo"
            class="input"
            placeholder="EE-2026-XXXXXX"
            value="${ui.escapar(codigoInicial)}"
            required
            maxlength="20"
            style="text-transform: uppercase;"
            autocomplete="off"
            aria-required="true"
          >
          <button type="submit" class="btn btn--primario" id="btnVerificar">
            Verificar certificado
          </button>
        </div>
      </form>
    </section>

    <div id="resultadoVerificacion" class="verificar-resultado" aria-live="polite"></div>
  `;

  const form = document.getElementById('formVerificar');
  const input = document.getElementById('inputCodigo');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = input.value.trim().toUpperCase();
    if (!codigo) return;
    await ejecutarVerificacion(codigo);
  });

  // Si vino con el parámetro ?codigo= en la URL, verificar automáticamente
  if (codigoInicial) {
    ejecutarVerificacion(codigoInicial.trim().toUpperCase());
  }
}

async function ejecutarVerificacion(codigo) {
  const contenedorResultado = document.getElementById('resultadoVerificacion');
  const btn = document.getElementById('btnVerificar');

  if (btn) btn.disabled = true;

  contenedorResultado.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-xl);">
      <div class="cargando" role="status" aria-label="Verificando código"></div>
      <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-top: var(--espacio-s);">
        Consultando registro oficial...
      </p>
    </div>
  `;

  try {
    const res = await api.llamar('GET', `/api/certificados/verificar/${encodeURIComponent(codigo)}`);

    if (res && res.valido === true) {
      const fechaTexto = res.fecha ? util.fechaLarga(res.fecha) : 'Fecha no registrada';

      contenedorResultado.innerHTML = `
        <article class="certificado-valido-tarjeta" role="status">
          <div class="certificado-valido__cabecera">
            <div class="certificado-valido__sello">
              <span aria-hidden="true" style="font-size: var(--tamano-xl);">✓</span>
              <span>CERTIFICADO VÁLIDO Y AUTÉNTICO</span>
            </div>
            <div class="certificado-valido__codigo">${ui.escapar(codigo)}</div>
          </div>

          <div class="certificado-valido__campo">
            <span class="certificado-valido__campo-etiqueta">Otorgado a</span>
            <p class="certificado-valido__campo-valor certificado-valido__campo-valor--nombre">
              ${ui.escapar(res.nombreCompleto || 'Estudiante')}
            </p>
          </div>

          <div class="certificado-valido__campo">
            <span class="certificado-valido__campo-etiqueta">Detalle del logro</span>
            <p class="certificado-valido__campo-valor">
              ${ui.escapar(res.detalle || '')}
            </p>
          </div>

          <div class="certificado-valido__campo">
            <span class="certificado-valido__campo-etiqueta">Fecha de expedición</span>
            <p class="certificado-valido__campo-valor" style="color: var(--color-texto-suave); font-size: var(--tamano-s);">
              ${ui.escapar(fechaTexto)}
            </p>
          </div>

          <div style="margin-top: var(--espacio-s); border-top: 1px solid var(--color-borde); padding-top: var(--espacio-m); font-size: var(--tamano-xs); color: var(--color-texto-suave); text-align: center;">
            Documento emitido y respaldado por el Ecosistema Educativo Digital.
          </div>
        </article>
      `;
    } else {
      contenedorResultado.innerHTML = `
        <div class="alerta alerta--error" role="alert">
          <strong>Certificado no válido o no encontrado:</strong>
          No se encontró ningún registro oficial correspondiente al código <code>${ui.escapar(codigo)}</code>. Verifica que el código esté escrito correctamente.
        </div>
      `;
    }
  } catch (err) {
    contenedorResultado.innerHTML = `
      <div class="alerta alerta--error" role="alert">
        Error al verificar el certificado: ${ui.escapar(err.message || 'Error de conexión')}
      </div>
    `;
  } finally {
    if (btn) btn.disabled = false;
  }
}

