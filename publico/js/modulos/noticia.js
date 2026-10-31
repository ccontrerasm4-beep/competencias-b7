import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Noticia", roles: ["sesion"] });

const contenido = document.getElementById('contenido');
const noticiaId = util.parametro('id');
const usuario = usuarioActual();

if (contenido) {
  if (!noticiaId) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        No se especificó ninguna noticia.
        <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Noticias
        </a>
      </div>
    `;
  } else {
    contenido.innerHTML = `
      <div style="text-align: center; padding: var(--espacio-2xl);">
        <div class="cargando" role="status" aria-label="Cargando noticia"></div>
      </div>
    `;

    iniciarDetalleNoticia();
  }
}

async function iniciarDetalleNoticia() {
  try {
    const noticia = await api.obtener('noticias', noticiaId);
    if (!noticia) {
      throw new Error('Noticia no encontrada');
    }

    // Registrar lectura si no existe
    try {
      const lecturas = await api.listar('lecturas-noticias');
      const yaRegistrada = Array.isArray(lecturas) && lecturas.some((l) => l.noticiaId === noticiaId);
      if (!yaRegistrada) {
        await api.crear('lecturas-noticias', { noticiaId });
      }
    } catch {
      // Si falla o ya existe, no interrumpe la lectura
    }

    // Consultar tema relacionado si aplica
    let temaRelacionado = null;
    if (noticia.temaId) {
      try {
        temaRelacionado = await api.obtener('temas', noticia.temaId);
      } catch {
        temaRelacionado = null;
      }
    }

    const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');
    const fechaTexto = util.fechaLarga(noticia.fechaPublicacion || noticia.fecha);

    contenido.innerHTML = `
      <article class="noticia-articulo">
        <div class="fila" style="justify-content: space-between; align-items: center;">
          <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno">
            ← Volver a Noticias
          </a>

          ${
            esDocenteOAdmin
              ? `
                <a href="/paginas/editor-noticia.html?id=${encodeURIComponent(noticia.id)}" class="btn btn--secundario btn--pequeno">
                  ✏️ Editar noticia
                </a>
              `
              : ''
          }
        </div>

        ${
          noticia.imagen
            ? `<img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="noticia-imagen-hero">`
            : ''
        }

        <header class="noticia-encabezado">
          <div class="noticia-meta-fila">
            <span class="insignia insignia--primario">${ui.escapar(noticia.categoria || 'General')}</span>
            ${noticia.destacada ? `<span class="insignia insignia--acento">★ Destacada</span>` : ''}
            <span>Publicado el ${ui.escapar(fechaTexto)}</span>
          </div>

          <h1 class="noticia-titulo-principal">${ui.escapar(noticia.titulo)}</h1>

          <p class="noticia-resumen-destacado">${ui.escapar(noticia.resumen)}</p>
        </header>

        <div class="noticia-cuerpo tarjeta">
          ${ui.limpiar(util.formatoBasico(noticia.cuerpo || ''))}
        </div>

        ${
          temaRelacionado
            ? `
              <div class="noticia-tema-bloque">
                <div>
                  <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave); font-weight: var(--peso-seminegrita);">
                    TEMA RELACIONADO
                  </span>
                  <h3 style="margin: 0; font-size: var(--tamano-m); color: var(--color-primario);">
                    ${ui.escapar(temaRelacionado.titulo)}
                  </h3>
                </div>
                <a href="/paginas/tema.html?id=${encodeURIComponent(temaRelacionado.id)}" class="btn btn--primario btn--pequeno">
                  Ver tema de estudio →
                </a>
              </div>
            `
            : ''
        }
      </article>
    `;
  } catch (err) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        ${ui.escapar(err.message || 'Error al cargar noticia.')}
        <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Noticias
        </a>
      </div>
    `;
  }
}

