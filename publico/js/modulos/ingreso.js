import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Iniciar Sesión", roles: ["publico"] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta auth-tarjeta">
      <h1>Iniciar Sesión</h1>
      <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
        Ingresa tus credenciales institucionales para acceder a tu entorno educativo.
      </p>

      <form id="formIngreso" class="pila" novalidate>
        <div class="campo">
          <label for="correo">Correo Institucional</label>
          <input type="email" id="correo" name="correo" placeholder="usuario@unemi.edu.ec" required autocomplete="email">
          <span class="campo__error" id="errorCorreo"></span>
        </div>

        <div class="campo">
          <label for="clave">Contraseña</label>
          <input type="password" id="clave" name="clave" placeholder="Tu contraseña" required autocomplete="current-password">
          <span class="campo__error" id="errorClave"></span>
        </div>

        <div style="margin-top: var(--espacio-s);">
          <button type="submit" class="btn btn--primario" id="btnIngresar" style="width: 100%;">
            Ingresar
          </button>
        </div>
      </form>

      <p class="auth-enlace-alternativo">
        ¿Aún no tienes una cuenta? <a href="/paginas/registro.html">Regístrate aquí</a>
      </p>
    </div>
  `;

  const form = document.getElementById('formIngreso');
  const inputCorreo = document.getElementById('correo');
  const inputClave = document.getElementById('clave');
  const btnIngresar = document.getElementById('btnIngresar');

  const errorCorreo = document.getElementById('errorCorreo');
  const errorClave = document.getElementById('errorClave');

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    if (!val) {
      errorCorreo.textContent = 'El correo es obligatorio.';
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      errorCorreo.textContent = 'Ingresa un formato de correo válido.';
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
    errorClave.textContent = '';
    return true;
  }

  inputCorreo.addEventListener('input', validarCorreo);
  inputClave.addEventListener('input', validarClave);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okCorreo = validarCorreo();
    const okClave = validarClave();

    if (!okCorreo || !okClave) {
      return;
    }

    btnIngresar.disabled = true;
    btnIngresar.textContent = 'Ingresando...';

    const correo = inputCorreo.value.trim();
    const clave = inputClave.value;

    try {
      await sesion.iniciar(correo, clave);
      ui.aviso('Sesión iniciada con éxito', 'exito');

      setTimeout(() => {
        window.location.href = '/index.html';
      }, 400);
    } catch (err) {
      ui.aviso(err.message || 'Error al iniciar sesión', 'error');
      btnIngresar.disabled = false;
      btnIngresar.textContent = 'Ingresar';
    }
  });
}

