import { MENU } from './menu.js';
import { escapar, aviso } from './ui.js';
import { usuarioActual, cerrar, exigirRol } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import * as api from './api.js';

export const NOMBRE = "Ecosistema Educativo";

export async function montarPlantilla({ titulo, roles = [] }) {
  // Validar permisos si se indican roles
  if (roles && roles.length > 0) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  document.title = `${titulo} · ${NOMBRE}`;

  const usuario = usuarioActual();

  // Registrar visita en bitácora si hay sesión activa (sin esperar la respuesta)
  if (usuario && typeof window !== 'undefined' && window.location) {
    registrarEvento('pagina', window.location.pathname).catch(() => {});
  }

  const contenedorPlantilla = document.getElementById('plantilla');
  if (contenedorPlantilla) {
    const rutaActual = window.location.pathname;

    let sinLeerNoticias = 0;
    if (usuario) {
      try {
        const [noticias, lecturas] = await Promise.all([
          api.listar('noticias'),
          api.listar('lecturas-noticias')
        ]);
        const publicadas = (noticias || []).filter((n) => n.estado === 'publicado');
        const leidasIds = new Set((lecturas || []).map((l) => l.noticiaId));
        sinLeerNoticias = publicadas.filter((n) => !leidasIds.has(n.id)).length;
      } catch {
        sinLeerNoticias = 0;
      }
    }

    // Filtrar enlaces del menú según el estado de la sesión y el rol
    const enlacesVisibles = MENU.filter((item) => {
      const rolesItem = item.roles || ['publico'];
      if (rolesItem.includes('publico')) return true;
      if (!usuario) return false;
      if (rolesItem.includes('sesion')) return true;
      return rolesItem.includes(usuario.rol);
    });

    const enlacesHtml = enlacesVisibles.map((item) => {
      const esActual = rutaActual === item.href ||
        (rutaActual === '/' && item.href === '/index.html') ||
        (rutaActual.endsWith(item.href));

      const claseActivo = esActual ? ' menu__enlace--activo' : '';
      const ariaPagina = esActual ? ' aria-current="page"' : '';

      const badgeNoticias = (item.texto === 'Noticias' && sinLeerNoticias > 0)
        ? ` <span class="insignia insignia--primario" style="margin-left: auto; font-size: var(--tamano-xs);">${sinLeerNoticias}</span>`
        : '';

      return `<a href="${item.href}" class="menu__enlace${claseActivo}"${ariaPagina}><span>${escapar(item.texto)}</span>${badgeNoticias}</a>`;
    }).join('\n');

    // Sección de usuario en el encabezado
    let authHtml = '';
    if (usuario) {
      const fotoAvatar = usuario.foto
        ? `<img src="${escapar(usuario.foto)}" alt="Foto de ${escapar(usuario.nombre)}" style="width: 28px; height: 28px; border-radius: var(--radio-completo); object-fit: cover; border: 1px solid var(--color-borde);">`
        : '';

      const puntosHtml = usuario.rol === 'estudiante'
        ? `<span id="puntos-usuario" class="puntos-usuario" title="Puntos acumulados">0 pts</span>`
        : '';

      authHtml = `
        <div class="fila" style="gap: var(--espacio-s); align-items: center;">
          ${puntosHtml}
          <div id="contenedorCampana"></div>
          <a href="/paginas/perfil.html" class="fila" style="gap: var(--espacio-xs); color: var(--color-texto); font-size: var(--tamano-s); font-weight: var(--peso-seminegrita);">
            ${fotoAvatar}
            <span>${escapar(usuario.nombre)}</span>
            <span class="insignia insignia--primario" style="text-transform: capitalize;">${escapar(usuario.rol)}</span>
          </a>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btnCerrarSesion">
            Salir
          </button>
        </div>
      `;
    } else {
      authHtml = `
        <div class="fila" style="gap: var(--espacio-s);">
          <a href="/paginas/ingreso.html" class="btn btn--secundario btn--pequeno">Ingresar</a>
          <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno">Registrarse</a>
        </div>
      `;
    }

    contenedorPlantilla.innerHTML = `
      <header class="encabezado" role="banner">
        <div class="contenedor encabezado__contenedor">
          <div class="fila" style="gap: var(--espacio-s);">
            <button type="button" class="btn btn--secundario btn--pequeno menu-toggle" id="btnMenuToggle" aria-label="Alternar menú de navegación" aria-expanded="false">
              ☰ Menú
            </button>
            <span class="encabezado__marca" style="font-weight: var(--peso-extranegrita); font-size: var(--tamano-l); color: var(--color-primario);">
              ${escapar(NOMBRE)}
            </span>
            <span class="encabezado__titulo" style="font-size: var(--tamano-m); font-weight: var(--peso-seminegrita); color: var(--color-texto-suave);">
              ${escapar(titulo)}
            </span>
          </div>
          ${authHtml}
        </div>
      </header>

      <aside class="menu" id="menuPrincipal" aria-label="Navegación principal">
        <nav class="pila" style="gap: var(--espacio-xs);">
          ${enlacesHtml}
        </nav>
      </aside>
    `;

    // Interacción del menú desplegable en dispositivos móviles
    const btnToggle = document.getElementById('btnMenuToggle');
    const menuEl = document.getElementById('menuPrincipal');

    if (btnToggle && menuEl) {
      btnToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const abierto = menuEl.classList.toggle('menu--abierto');
        btnToggle.setAttribute('aria-expanded', String(abierto));
      });

      document.addEventListener('click', (e) => {
        if (!menuEl.contains(e.target) && e.target !== btnToggle && menuEl.classList.contains('menu--abierto')) {
          menuEl.classList.remove('menu--abierto');
          btnToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Botón de cerrar sesión
    const btnSalir = document.getElementById('btnCerrarSesion');
    if (btnSalir) {
      btnSalir.addEventListener('click', async () => {
        await cerrar();
        window.location.href = '/index.html';
      });
    }

    // Montar campana de notificaciones si hay sesión
    if (usuario) {
      try {
        const { montarCampana } = await import('./notificaciones.js');
        await montarCampana();
      } catch (err) {
        console.warn('Error al montar campana de notificaciones:', err);
      }
    }

    // Cargar puntos del estudiante en el encabezado
    if (usuario && usuario.rol === 'estudiante') {
      try {
        const { logrosDe } = await import('./gamificacion.js');
        const logros = await logrosDe('yo');
        const elemPuntos = document.getElementById('puntos-usuario');
        if (elemPuntos && typeof logros.puntos === 'number') {
          elemPuntos.textContent = `${logros.puntos} pts`;
          elemPuntos.title = `${logros.puntos} puntos acumulados`;
        }
      } catch {
        // En caso de error de red, se mantiene el valor por defecto
      }
    }
  }

  // Agregar pie con el año al final del body si no existe
  if (!document.querySelector('footer.pie')) {
    const pie = document.createElement('footer');
    pie.className = 'pie';
    pie.setAttribute('role', 'contentinfo');
    pie.innerHTML = `
      <div class="contenedor fila" style="justify-content: space-between;">
        <span>${escapar(NOMBRE)} &copy; ${new Date().getFullYear()}</span>
        <span>Plataforma Web Educativa</span>
      </div>
    `;
    document.body.appendChild(pie);
  }

  // Mostrar avisos pendientes guardados entre redirecciones
  if (typeof sessionStorage !== 'undefined') {
    const rawAviso = sessionStorage.getItem('aviso_pendiente');
    if (rawAviso) {
      sessionStorage.removeItem('aviso_pendiente');
      try {
        const datosAviso = JSON.parse(rawAviso);
        if (datosAviso && datosAviso.texto) {
          aviso(datosAviso.texto, datosAviso.tipo || 'info');
        }
      } catch {}
    }
  }
}
