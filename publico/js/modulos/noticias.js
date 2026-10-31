import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Noticias y Novedades", roles: ["sesion"] });

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const POR_PAGINA = 9;
let paginaActual = 1;

let todasNoticias = [];
let lecturasUsuario = new Set();
let temas = [];

if (contenido) {
  contenido.innerHTML = `
    <div class="noticias-cabecera">
      <div>
        <h1>Noticias y Novedades</h1>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
          Entérate de los eventos, logros y actividades del ecosistema educativo.
        </p>
      </div>
      ${
        esDocenteOAdmin
          ? `
            <a href="/paginas/editor-noticia.html" class="btn btn--primario">
              + Nueva Noticia
            </a>
          `
          : ''
      }
    </div>

    <div class="noticias-filtros">
      <div class="campo" style="max-width: 220px;">
        <label for="filtroCategoria">Categoría</label>
        <select id="filtroCategoria">
          <option value="todas">Todas las categorías</option>
          <option value="Institucional">Institucional</option>
          <option value="Académica">Académica</option>
          <option value="Eventos">Eventos</option>
          <option value="Logros">Logros</option>
        </select>
      </div>

      <div class="campo" style="max-width: 280px;">
        <label for="filtroTema">Tema relacionado</label>
        <select id="filtroTema">
          <option value="todos">Todos los temas</option>
        </select>
      </div>
    </div>

    <div id="contenedorGridNoticias">
      <div style="text-align: center; padding: var(--espacio-2xl);">
        <div class="cargando" role="status" aria-label="Cargando noticias"></div>
      </div>
    </div>

    <div class="noticias-paginacion" id="contenedorPaginacion" style="display: none;">
      <button type="button" class="btn btn--secundario btn--pequeno" id="btnPaginaAnt" disabled>
        ← Anterior
      </button>
      <span id="textoPaginacion" style="font-size: var(--tamano-s); color: var(--color-texto-suave);">
        Página 1 de 1
      </span>
      <button type="button" class="btn btn--secundario btn--pequeno" id="btnPaginaSig" disabled>
        Siguiente →
      </button>
    </div>
  `;

  iniciarCatalogoNoticias();
}

async function iniciarCatalogoNoticias() {
  const selectCategoria = document.getElementById('filtroCategoria');
  const selectTema = document.getElementById('filtroTema');

  const btnPaginaAnt = document.getElementById('btnPaginaAnt');
  const btnPaginaSig = document.getElementById('btnPaginaSig');

  try {
    const [listaNoticias, listaLecturas, listaTemas] = await Promise.all([
      api.listar('noticias'),
      api.listar('lecturas-noticias'),
      api.listar('temas')
    ]);

    todasNoticias = Array.isArray(listaNoticias) ? listaNoticias : [];
    lecturasUsuario = new Set((listaLecturas || []).map((l) => l.noticiaId));
    temas = Array.isArray(listaTemas) ? listaTemas : [];

    // Poblar selector de temas
    temas.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selectTema.appendChild(opt);
    });

    selectCategoria.addEventListener('change', () => {
      paginaActual = 1;
      renderizarNoticias();
    });

    selectTema.addEventListener('change', () => {
      paginaActual = 1;
      renderizarNoticias();
    });

    btnPaginaAnt.addEventListener('click', () => {
      if (paginaActual > 1) {
        paginaActual--;
        renderizarNoticias();
      }
    });

    btnPaginaSig.addEventListener('click', () => {
      paginaActual++;
      renderizarNoticias();
    });

    renderizarNoticias();
  } catch (err) {
    document.getElementById('contenedorGridNoticias').innerHTML = `
      <div class="alerta alerta--error">
        ${ui.escapar(err.message || 'Error al cargar noticias')}
      </div>
    `;
  }
}

function renderizarNoticias() {
  const contenedorGrid = document.getElementById('contenedorGridNoticias');
  const contenedorPaginacion = document.getElementById('contenedorPaginacion');
  const textoPaginacion = document.getElementById('textoPaginacion');
  const btnPaginaAnt = document.getElementById('btnPaginaAnt');
  const btnPaginaSig = document.getElementById('btnPaginaSig');

  const categoriaSel = document.getElementById('filtroCategoria').value;
  const temaSel = document.getElementById('filtroTema').value;

  // Filtrado
  const filtradas = todasNoticias.filter((n) => {
    const cumpleCat = categoriaSel === 'todas' || n.categoria === categoriaSel;
    const cumpleTema = temaSel === 'todos' || n.temaId === temaSel;
    return cumpleCat && cumpleTema;
  });

  // Orden: destacadas primero, luego por fecha descendente
  filtradas.sort((a, b) => {
    if (a.destacada && !b.destacada) return -1;
    if (!a.destacada && b.destacada) return 1;
    const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fechaB - fechaA;
  });

  if (filtradas.length === 0) {
    contenedorGrid.innerHTML = `
      <div class="tarjeta vacio">
        <p style="font-size: var(--tamano-l); font-weight: var(--peso-seminegrita); color: var(--color-primario);">
          No hay noticias disponibles
        </p>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">
          Prueba cambiando los filtros seleccionados o vuelve a consultar más tarde.
        </p>
      </div>
    `;
    contenedorPaginacion.style.display = 'none';
    return;
  }

  // Paginación
  const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA);
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;

  const inicio = (paginaActual - 1) * POR_PAGINA;
  const paginaItems = filtradas.slice(inicio, inicio + POR_PAGINA);

  const grid = document.createElement('div');
  grid.className = 'noticias-grid';

  paginaItems.forEach((n) => {
    const yaLeida = lecturasUsuario.has(n.id);
    const esBorrador = n.estado === 'borrador';
    const fechaFormateada = util.fechaRelativa(n.fechaPublicacion || n.fecha);

    const tarjeta = document.createElement('article');
    tarjeta.className = 'noticia-tarjeta';

    tarjeta.innerHTML = `
      ${
        n.imagen
          ? `<img src="${ui.escapar(n.imagen)}" alt="${ui.escapar(n.titulo)}" class="noticia-tarjeta__img">`
          : ''
      }

      <div class="noticia-tarjeta__cuerpo">
        <div class="noticia-tarjeta__meta">
          <span class="insignia insignia--primario">${ui.escapar(n.categoria || 'General')}</span>
          ${n.destacada ? `<span class="insignia insignia--acento">★ Destacada</span>` : ''}
          ${!yaLeida ? `<span class="insignia insignia--exito">Nuevo</span>` : ''}
          ${esBorrador ? `<span class="insignia insignia--advertencia">Borrador</span>` : ''}
          <span style="color: var(--color-texto-suave); margin-left: auto;">${ui.escapar(fechaFormateada)}</span>
        </div>

        <h2 class="noticia-tarjeta__titulo">${ui.escapar(n.titulo)}</h2>
        <p class="noticia-tarjeta__resumen">${ui.escapar(n.resumen)}</p>
      </div>

      <div class="noticia-tarjeta__pie">
        <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--primario btn--pequeno">
          Leer noticia →
        </a>

        ${
          esDocenteOAdmin
            ? `
              <a href="/paginas/editor-noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--secundario btn--pequeno">
                Editar
              </a>
            `
            : ''
        }
      </div>
    `;

    grid.appendChild(tarjeta);
  });

  contenedorGrid.innerHTML = '';
  contenedorGrid.appendChild(grid);

  // Actualizar controles de paginación
  if (totalPaginas > 1) {
    contenedorPaginacion.style.display = 'flex';
    textoPaginacion.textContent = `Página ${paginaActual} de ${totalPaginas}`;
    btnPaginaAnt.disabled = paginaActual <= 1;
    btnPaginaSig.disabled = paginaActual >= totalPaginas;
  } else {
    contenedorPaginacion.style.display = 'none';
  }
}

