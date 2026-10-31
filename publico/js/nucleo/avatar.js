/**
 * Módulo de Avatar Pedagógico del Tutor Socrático
 * Estados: "reposo" | "hablando" | "pensando" | "celebrando"
 */

let estadoActual = 'reposo';
let elementoAvatar = null;
let elementoGlobo = null;

const ICONOS_ESTADO = {
  reposo: '🦉',
  hablando: '💬',
  pensando: '🤔',
  celebrando: '🎉'
};

export function montarAvatar({ contenedor = null, estadoInicial = 'reposo' } = {}) {
  estadoActual = estadoInicial;

  const div = document.createElement('div');
  div.className = `avatar-tutor avatar--${estadoActual}`;
  div.setAttribute('role', 'region');
  div.setAttribute('aria-label', 'Avatar del Tutor Socrático');

  div.innerHTML = `
    <div class="avatar-tutor__figura" id="avatar-figura" aria-hidden="true">
      <span class="avatar-tutor__icono">${ICONOS_ESTADO[estadoActual] || '🦉'}</span>
    </div>
    <div class="avatar-tutor__globo" id="avatar-globo" style="display: none;" aria-live="polite">
      <p class="avatar-tutor__texto" id="avatar-texto"></p>
    </div>
  `;

  elementoAvatar = div;
  elementoGlobo = div.querySelector('#avatar-globo');

  if (contenedor) {
    contenedor.appendChild(div);
  }

  return div;
}

export function cambiarEstado(nuevoEstado) {
  if (!['reposo', 'hablando', 'pensando', 'celebrando'].includes(nuevoEstado)) {
    return;
  }
  estadoActual = nuevoEstado;

  if (elementoAvatar) {
    elementoAvatar.className = `avatar-tutor avatar--${estadoActual}`;
    const icono = elementoAvatar.querySelector('.avatar-tutor__icono');
    if (icono) {
      icono.textContent = ICONOS_ESTADO[estadoActual] || '🦉';
    }
  }
}

export function decir(texto) {
  if (!elementoAvatar) return;

  const elementoTexto = elementoAvatar.querySelector('#avatar-texto');
  if (elementoTexto && elementoGlobo) {
    if (texto) {
      elementoTexto.textContent = texto;
      elementoGlobo.style.display = 'block';
      cambiarEstado('hablando');
    } else {
      elementoGlobo.style.display = 'none';
      cambiarEstado('reposo');
    }
  }
}

