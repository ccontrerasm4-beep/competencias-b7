export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function limpiar(html) {
  if (!html) return '';
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html);
  }
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function obtenerContenedorAvisos() {
  let cont = document.getElementById('contenedor-avisos');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'contenedor-avisos';
    cont.className = 'contenedor-avisos';
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }
  return cont;
}

export function aviso(texto, tipo = 'info') {
  if (typeof document === 'undefined') return;
  const cont = obtenerContenedorAvisos();
  const elemento = document.createElement('div');
  elemento.className = `aviso aviso-${tipo}`;
  elemento.setAttribute('role', 'status');
  elemento.textContent = texto;

  cont.appendChild(elemento);

  setTimeout(() => {
    elemento.remove();
  }, 4000);
}

export function modal({ titulo, contenido, acciones = [] }) {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const previoFoco = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal-dialogo';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    const idTitulo = `modal-titulo-${Date.now()}`;
    dialogo.setAttribute('aria-labelledby', idTitulo);

    const encabezado = document.createElement('div');
    encabezado.className = 'modal-encabezado';
    const h2 = document.createElement('h2');
    h2.id = idTitulo;
    h2.textContent = titulo || '';
    encabezado.appendChild(h2);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal-cuerpo';
    if (typeof contenido === 'string') {
      cuerpo.textContent = contenido;
    } else if (contenido instanceof HTMLElement) {
      cuerpo.appendChild(contenido);
    }

    const pie = document.createElement('div');
    pie.className = 'modal-pie';

    let resuelto = false;
    function cerrar(valor) {
      if (resuelto) return;
      resuelto = true;
      document.removeEventListener('keydown', manejarTeclado);
      overlay.remove();
      if (previoFoco && typeof previoFoco.focus === 'function') {
        previoFoco.focus();
      }
      resolve(valor);
    }

    const listaAcciones = acciones.length > 0
      ? acciones
      : [{ texto: 'Cerrar', valor: null, clase: 'btn btn--secundario' }];

    for (const acc of listaAcciones) {
      const boton = document.createElement('button');
      boton.type = 'button';
      let clase = acc.clase || 'btn--secundario';
      if (!clase.includes('btn--') && (clase === 'btn-primario' || clase === 'btn-secundario' || clase === 'btn-peligro')) {
        clase = `btn--${clase.replace('btn-', '')}`;
      }
      boton.className = clase.includes('btn') ? clase : `btn ${clase}`;
      boton.textContent = acc.texto;
      boton.addEventListener('click', async () => {
        if (typeof acc.accion === 'function') {
          const continuar = await acc.accion(cerrar);
          if (continuar === false) return;
        }
        cerrar(acc.valor !== undefined ? acc.valor : null);
      });
      pie.appendChild(boton);
    }

    dialogo.appendChild(encabezado);
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(pie);
    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);

    function obtenerElementosEnfocables() {
      return dialogo.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    }

    function manejarTeclado(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(null);
        return;
      }

      if (e.key === 'Tab') {
        const enfocables = Array.from(obtenerElementosEnfocables());
        if (enfocables.length === 0) {
          e.preventDefault();
          return;
        }
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
          }
        } else {
          if (document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', manejarTeclado);

    const enfocables = obtenerElementosEnfocables();
    if (enfocables.length > 0) {
      enfocables[0].focus();
    } else {
      dialogo.setAttribute('tabindex', '-1');
      dialogo.focus();
    }
  });
}

export async function confirmar(texto) {
  const resultado = await modal({
    titulo: 'Confirmación',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ]
  });
  return Boolean(resultado);
}

export function cargando(bool) {
  if (typeof document === 'undefined') return;
  let indicador = document.querySelector('.cargando');

  if (bool) {
    if (!indicador) {
      indicador = document.createElement('div');
      indicador.className = 'cargando';
      indicador.setAttribute('role', 'status');
      indicador.setAttribute('aria-label', 'Cargando');
      document.body.appendChild(indicador);
    }
    indicador.hidden = false;
  } else if (indicador) {
    indicador.hidden = true;
    indicador.remove();
  }
}

