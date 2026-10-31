import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

let intervaloConsulta = null;
let totalSinLeerCache = 0;

/**
 * Consulta la cantidad de notificaciones sin leer del usuario en sesión.
 * @returns {Promise<number>}
 */
export async function noLeidas() {
  try {
    const res = await api.llamar('GET', '/api/notificaciones');
    totalSinLeerCache = Number(res?.sinLeer || 0);
    return totalSinLeerCache;
  } catch {
    return totalSinLeerCache;
  }
}

/**
 * Monta el botón campana y el panel desplegable de notificaciones en el encabezado.
 */
export async function montarCampana() {
  const contenedor = document.getElementById('contenedorCampana');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="campana-bloque" id="campanaBloque">
      <button type="button" class="btn-campana" id="btnCampana" aria-label="Notificaciones (0 sin leer)" aria-expanded="false" aria-haspopup="true">
        🔔
        <span class="campana-contador" id="campanaContador" style="display: none;">0</span>
      </button>

      <div class="campana-panel" id="campanaPanel" role="region" aria-label="Panel de notificaciones" style="display: none;">
        <div class="campana-panel__cabecera">
          <h3>Notificaciones</h3>
          <button type="button" class="btn--texto btn--pequeno" id="btnMarcarTodasLeidas">
            Marcar todas como leídas
          </button>
        </div>
        <div class="campana-panel__lista" id="campanaLista">
          <p style="padding: var(--espacio-m); font-size: var(--tamano-s); color: var(--color-texto-suave); margin: 0; text-align: center;">
            Cargando notificaciones...
          </p>
        </div>
      </div>
    </div>
  `;

  const btnCampana = document.getElementById('btnCampana');
  const campanaPanel = document.getElementById('campanaPanel');
  const campanaContador = document.getElementById('campanaContador');
  const campanaLista = document.getElementById('campanaLista');
  const btnMarcarTodas = document.getElementById('btnMarcarTodasLeidas');
  const campanaBloque = document.getElementById('campanaBloque');

  let abierto = false;

  // Alternar panel desplegable
  btnCampana.addEventListener('click', (e) => {
    e.stopPropagation();
    abierto = !abierto;
    campanaPanel.style.display = abierto ? 'flex' : 'none';
    btnCampana.setAttribute('aria-expanded', String(abierto));
    if (abierto) {
      cargarNotificaciones();
    }
  });

  // Cerrar panel al hacer clic fuera o presionar Escape
  document.addEventListener('click', (e) => {
    if (abierto && !campanaBloque.contains(e.target)) {
      abierto = false;
      campanaPanel.style.display = 'none';
      btnCampana.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && abierto) {
      abierto = false;
      campanaPanel.style.display = 'none';
      btnCampana.setAttribute('aria-expanded', 'false');
      btnCampana.focus();
    }
  });

  // Marcar todas como leídas
  btnMarcarTodas.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await api.llamar('POST', '/api/notificaciones/leidas');
      await cargarNotificaciones();
      ui.aviso('Todas las notificaciones marcadas como leídas', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al actualizar notificaciones', 'error');
    }
  });

  /**
   * Consulta las notificaciones y actualiza la interfaz
   */
  async function cargarNotificaciones() {
    try {
      const res = await api.llamar('GET', '/api/notificaciones');
      const notificaciones = Array.isArray(res?.notificaciones) ? res.notificaciones : [];
      const sinLeer = Number(res?.sinLeer || 0);
      totalSinLeerCache = sinLeer;

      // Actualizar contador y aria-label
      if (sinLeer > 0) {
        campanaContador.style.display = 'flex';
        campanaContador.textContent = sinLeer > 99 ? '99+' : sinLeer;
        btnCampana.setAttribute('aria-label', `Notificaciones (${sinLeer} sin leer)`);
      } else {
        campanaContador.style.display = 'none';
        btnCampana.setAttribute('aria-label', 'Notificaciones (0 sin leer)');
      }

      // Renderizar listado
      if (notificaciones.length === 0) {
        campanaLista.innerHTML = `
          <div class="vacio" style="padding: var(--espacio-l);">
            <span class="vacio__icono" aria-hidden="true">🔕</span>
            <p class="vacio__descripcion" style="margin: 0;">No tienes notificaciones recibidas.</p>
          </div>
        `;
        return;
      }

      campanaLista.innerHTML = notificaciones
        .map((n) => {
          const noLeidaClase = !n.leida ? ' notif-item--no-leida' : '';
          const fechaStr = n.fecha ? util.fechaRelativa(n.fecha) : '';
          const enlaceHtml = n.enlace
            ? `<a href="${ui.escapar(n.enlace)}" class="notif-item__enlace">Ir al recurso &rarr;</a>`
            : '';

          return `
            <div class="notif-item${noLeidaClase}" data-id="${ui.escapar(n.id)}" data-leida="${n.leida ? 'true' : 'false'}" tabindex="0" role="article">
              <p class="notif-item__texto">${ui.escapar(n.mensaje)}</p>
              <div class="notif-item__pie">
                <span>${ui.escapar(fechaStr)}</span>
                ${enlaceHtml}
              </div>
            </div>
          `;
        })
        .join('');

      // Marcar una como leída al hacer clic sobre ella
      campanaLista.querySelectorAll('.notif-item').forEach((item) => {
        const id = item.dataset.id;
        const leida = item.dataset.leida === 'true';

        const marcarLeida = async () => {
          if (!leida) {
            try {
              await api.llamar('POST', `/api/notificaciones/${encodeURIComponent(id)}/leida`);
              item.classList.remove('notif-item--no-leida');
              item.dataset.leida = 'true';
              if (totalSinLeerCache > 0) {
                totalSinLeerCache--;
                if (totalSinLeerCache > 0) {
                  campanaContador.textContent = totalSinLeerCache;
                  btnCampana.setAttribute('aria-label', `Notificaciones (${totalSinLeerCache} sin leer)`);
                } else {
                  campanaContador.style.display = 'none';
                  btnCampana.setAttribute('aria-label', 'Notificaciones (0 sin leer)');
                }
              }
            } catch {}
          }
        };

        item.addEventListener('click', marcarLeida);
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            marcarLeida();
          }
        });
      });
    } catch {
      // Ignorar errores silenciosos en consultas de fondo
    }
  }

  // Carga inicial
  await cargarNotificaciones();

  // Consulta cada 60 s, solo con la pestaña visible
  if (intervaloConsulta) {
    clearInterval(intervaloConsulta);
  }
  intervaloConsulta = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      cargarNotificaciones();
    }
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      cargarNotificaciones();
    }
  });
}

