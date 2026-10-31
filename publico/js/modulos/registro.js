import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Registro de Cuenta", roles: ["publico"] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta auth-tarjeta">
      <h1>Crear Cuenta</h1>
      <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
        Regístrate como estudiante para acceder a los contenidos, actividades y tutoría inteligente.
      </p>

      <form id="formRegistro" class="pila" novalidate>
        <div class="campo">
          <label for="nombre">Nombre</label>
          <input type="text" id="nombre" name="nombre" placeholder="Ej. Ana" required autocomplete="given-name">
          <span class="campo__error" id="errorNombre"></span>
        </div>

        <div class="campo">
          <label for="apellido">Apellido</label>
          <input type="text" id="apellido" name="apellido" placeholder="Ej. López" required autocomplete="family-name">
          <span class="campo__error" id="errorApellido"></span>
        </div>

        <div class="campo">
          <label for="correo">Correo Electrónico Institucional</label>
          <input type="email" id="correo" name="correo" placeholder="usuario@unemi.edu.ec" required autocomplete="email">
          <span class="campo__error" id="errorCorreo"></span>
        </div>

        <div class="campo">
          <label for="clave">Contraseña</label>
          <input type="password" id="clave" name="clave" placeholder="Mínimo 8 caracteres (letras y números)" required autocomplete="new-password">
          <span class="campo__error" id="errorClave"></span>
        </div>

        <div class="campo">
          <div class="campo--casilla">
            <input type="checkbox" id="consentimiento" name="consentimiento" required>
            <label for="consentimiento" style="font-weight: var(--peso-regular); font-size: var(--tamano-s);">
              Acepto el <a href="/paginas/privacidad.html" target="_blank">aviso de privacidad</a>
            </label>
          </div>
          <span class="campo__error" id="errorConsentimiento"></span>
        </div>

        <div style="margin-top: var(--espacio-s);">
          <button type="submit" class="btn btn--primario" id="btnEnviar" style="width: 100%;">
            Registrarme
          </button>
        </div>
      </form>

      <p class="auth-enlace-alternativo">
        ¿Ya tienes una cuenta? <a href="/paginas/ingreso.html">Inicia sesión aquí</a>
      </p>
    </div>
  `;

  const form = document.getElementById('formRegistro');
  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const inputCorreo = document.getElementById('correo');
  const inputClave = document.getElementById('clave');
  const checkConsentimiento = document.getElementById('consentimiento');
  const btnEnviar = document.getElementById('btnEnviar');

  const errorNombre = document.getElementById('errorNombre');
  const errorApellido = document.getElementById('errorApellido');
  const errorCorreo = document.getElementById('errorCorreo');
  const errorClave = document.getElementById('errorClave');
  const errorConsentimiento = document.getElementById('errorConsentimiento');

  function validarNombre() {
    const val = inputNombre.value.trim();
    if (!val) {
      errorNombre.textContent = 'El nombre es obligatorio.';
      return false;
    }
    errorNombre.textContent = '';
    return true;
  }

  function validarApellido() {
    const val = inputApellido.value.trim();
    if (!val) {
      errorApellido.textContent = 'El apellido es obligatorio.';
      return false;
    }
    errorApellido.textContent = '';
    return true;
  }

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    if (!val) {
      errorCorreo.textContent = 'El correo es obligatorio.';
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      errorCorreo.textContent = 'Ingresa un formato de correo válido (ej. usuario@unemi.edu.ec).';
      return false;
    }
    errorCorreo.textContent = '';
    return true;
  }

  function validarClave() {
    const val = inputClave.value;
    if (!val) {
      errorClave.textContent = 'La contraseña es obligatoria.';
      return false;
    }
    if (val.length < 8 || !/[a-zA-Z]/.test(val) || !/\d/.test(val)) {
      errorClave.textContent = 'Debe tener al menos 8 caracteres y contener letras y números.';
      return false;
    }
    errorClave.textContent = '';
    return true;
  }

  function validarConsentimiento() {
    if (!checkConsentimiento.checked) {
      errorConsentimiento.textContent = 'Debes aceptar el aviso de privacidad para continuar.';
      return false;
    }
    errorConsentimiento.textContent = '';
    return true;
  }

  // Validación en vivo
  inputNombre.addEventListener('input', validarNombre);
  inputApellido.addEventListener('input', validarApellido);
  inputCorreo.addEventListener('input', validarCorreo);
  inputClave.addEventListener('input', validarClave);
  checkConsentimiento.addEventListener('change', validarConsentimiento);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okNombre = validarNombre();
    const okApellido = validarApellido();
    const okCorreo = validarCorreo();
    const okClave = validarClave();
    const okConsentimiento = validarConsentimiento();

    if (!okNombre || !okApellido || !okCorreo || !okClave || !okConsentimiento) {
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Registrando...';

    const nombre = inputNombre.value.trim();
    const apellido = inputApellido.value.trim();
    const correo = inputCorreo.value.trim();
    const clave = inputClave.value;

    try {
      await sesion.registrar({
        nombre,
        apellido,
        correo,
        clave,
        consentimiento: true
      });

      // Iniciar sesión automáticamente
      await sesion.iniciar(correo, clave);

      ui.aviso('¡Cuenta creada e inicio de sesión exitoso!', 'exito');

      setTimeout(() => {
        window.location.href = '/index.html';
      }, 500);
    } catch (err) {
      ui.aviso(err.message || 'Error al registrar la cuenta', 'error');
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Registrarme';
    }
  });
}

