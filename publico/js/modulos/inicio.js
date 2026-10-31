import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: "Inicio", roles: ["publico"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  const usuario = usuarioActual();

  if (!usuario) {
    renderizarSinSesion();
  } else {
    await renderizarConSesion(usuario);
  }
}

function renderizarSinSesion() {
  contenido.innerHTML = `
    <section class="inicio-hero">
      <span class="insignia insignia--acento" style="margin-bottom: var(--espacio-s);">Plataforma Web Educativa</span>
      <h1>Aprende, practica y domina tus asignaturas</h1>
      <p>
        Entorno digital integral de aprendizaje interactivo con retroalimentación inmediata,
        gamificación, tutoría socrática y seguimiento personalizado de tu progreso académico.
      </p>
      <div class="inicio-acciones">
        <a href="/paginas/ingreso.html" class="btn btn--primario">Ingresar</a>
        <a href="/paginas/registro.html" class="btn btn--secundario">Registrarse</a>
      </div>
    </section>

    <section class="inicio-seccion">
      <div class="inicio-caracteristicas">
        <article class="inicio-caracteristica-tarjeta">
          <div class="inicio-caracteristica-icono" aria-hidden="true">📚</div>
          <h2 style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">Contenidos Estructurados</h2>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
            Avanza paso a paso por asignaturas, unidades y temas con objetivos claros, resúmenes pedagógicos y recursos multimedia.
          </p>
        </article>

        <article class="inicio-caracteristica-tarjeta">
          <div class="inicio-caracteristica-icono" aria-hidden="true">🏆</div>
          <h2 style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">Gamificación y Logros</h2>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
            Gana puntos, desbloquea insignias de maestría y genera diplomas digitales con código único al completar tus desafíos.
          </p>
        </article>

        <article class="inicio-caracteristica-tarjeta">
          <div class="inicio-caracteristica-icono" aria-hidden="true">🤖</div>
          <h2 style="font-size: var(--tamano-l); color: var(--color-primario); margin: 0;">Tutor IA Socrático</h2>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
            Resuelve tus dudas mediante preguntas orientadoras y pistas reflexivas que estimulan el razonamiento crítico.
          </p>
        </article>
      </div>
    </section>
  `;
}

async function renderizarConSesion(usuario) {
  // 1. Verificar último tema explorado
  let ultimoTema = null;
  try {
    const raw = localStorage.getItem('ultimoTema');
    if (raw) {
      ultimoTema = JSON.parse(raw);
    }
  } catch {
    ultimoTema = null;
  }

  // 2. Banner de Saludo
  const rolEtiqueta = usuario.rol === 'admin'
    ? 'Administrador'
    : usuario.rol === 'docente'
      ? 'Docente'
      : 'Estudiante';

  let htmlSaludo = `
    <section class="inicio-saludo-banner">
      <div class="inicio-saludo-texto">
        <h1>¡Hola, ${ui.escapar(usuario.nombre)}!</h1>
        <p>Bienvenido de vuelta a tu espacio formativo. Explora tus temas y continúa con tus actividades.</p>
      </div>
      <div>
        <span class="insignia insignia--secundario" style="font-size: var(--tamano-s); padding: var(--espacio-xs) var(--espacio-m);">
          ${ui.escapar(rolEtiqueta)}
        </span>
      </div>
    </section>
  `;

  // 3. Banner "Continuar donde te quedaste"
  let htmlContinuar = '';
  if (ultimoTema && ultimoTema.id && ultimoTema.titulo) {
    htmlContinuar = `
      <section class="inicio-continuar" aria-labelledby="titulo-continuar">
        <div class="inicio-continuar__info">
          <div class="inicio-continuar__icono" aria-hidden="true">📖</div>
          <div>
            <div class="inicio-continuar__etiqueta" id="titulo-continuar">Continuar donde te quedaste</div>
            <h2 class="inicio-continuar__titulo">${ui.escapar(ultimoTema.titulo)}</h2>
          </div>
        </div>
        <a href="/paginas/tema.html?id=${encodeURIComponent(ultimoTema.id)}" class="btn btn--acento">
          Continuar tema →
        </a>
      </section>
    `;
  }

  // 4. Accesos rápidos para docentes y admin
  let htmlAccesos = '';
  if (usuario.rol === 'docente' || usuario.rol === 'admin') {
    htmlAccesos = `
      <section class="inicio-accesos-rapidos" aria-labelledby="titulo-accesos">
        <h2 id="titulo-accesos" class="inicio-accesos-rapidos__titulo">
          <span aria-hidden="true">⚡</span> Accesos Rápidos de Gestión
        </h2>
        <div class="inicio-accesos-grid">
          <a href="/paginas/editor-contenidos.html" class="inicio-acceso-btn">
            <span class="inicio-acceso-btn__icono" aria-hidden="true">📚</span>
            <div class="inicio-acceso-btn__texto">
              <strong>Contenidos</strong>
              <span>Gestionar unidades y temas</span>
            </div>
          </a>
          <a href="/paginas/editor-noticia.html" class="inicio-acceso-btn">
            <span class="inicio-acceso-btn__icono" aria-hidden="true">📰</span>
            <div class="inicio-acceso-btn__texto">
              <strong>Noticias</strong>
              <span>Redactar nueva publicación</span>
            </div>
          </a>
          ${
            usuario.rol === 'admin'
              ? `
            <a href="/paginas/distributivo.html" class="inicio-acceso-btn">
              <span class="inicio-acceso-btn__icono" aria-hidden="true">👥</span>
              <div class="inicio-acceso-btn__texto">
                <strong>Distributivo</strong>
                <span>Asignación de docentes y paralelos</span>
              </div>
            </a>
          `
              : ''
          }
        </div>
      </section>
    `;
  }

  // Estructura base con marcadores de carga
  contenido.innerHTML = `
    ${htmlSaludo}
    ${htmlContinuar}
    ${htmlAccesos}

    <section class="inicio-seccion" aria-labelledby="titulo-asignaturas">
      <div class="inicio-seccion__cabecera">
        <h2 id="titulo-asignaturas">Mis Asignaturas</h2>
        <a href="${usuario.rol === 'admin' ? '/paginas/admin-asignaturas.html' : '/paginas/asignaturas.html'}" class="btn btn--secundario btn--pequeno">
          ${usuario.rol === 'admin' ? 'Administrar asignaturas →' : 'Ver todas →'}
        </a>
      </div>
      <div id="inicioContenedorAsignaturas">
        <div style="text-align: center; padding: var(--espacio-xl);">
          <div class="cargando" role="status" aria-label="Cargando asignaturas"></div>
        </div>
      </div>
    </section>

    <section class="inicio-seccion" aria-labelledby="titulo-noticias">
      <div class="inicio-seccion__cabecera">
        <h2 id="titulo-noticias">Noticias Recientes</h2>
        <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno">
          Ver todas las noticias →
        </a>
      </div>
      <div id="inicioContenedorNoticias">
        <div style="text-align: center; padding: var(--espacio-xl);">
          <div class="cargando" role="status" aria-label="Cargando noticias"></div>
        </div>
      </div>
    </section>
  `;

  // Carga asíncrona de asignaturas y noticias
  await Promise.all([
    cargarMisAsignaturas(usuario),
    cargarNoticiasRecientes()
  ]);
}

async function cargarMisAsignaturas(usuario) {
  const contenedor = document.getElementById('inicioContenedorAsignaturas');
  if (!contenedor) return;

  try {
    const asignaturas = await api.listar('asignaturas');

    if (!Array.isArray(asignaturas) || asignaturas.length === 0) {
      contenedor.innerHTML = `
        <div class="tarjeta vacio">
          <p style="font-weight: var(--peso-seminegrita); color: var(--color-primario); margin: 0 0 var(--espacio-xs) 0;">
            No tienes asignaturas registradas
          </p>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
            ${usuario.rol === 'estudiante' ? 'Consulta con tu docente para verificar tu matrícula en el período actual.' : 'Crea o asigna materias para comenzar a gestionar contenidos.'}
          </p>
        </div>
      `;
      return;
    }

    const avances = await Promise.all(asignaturas.map((a) => calcularAvance(a.id)));

    const grid = document.createElement('div');
    grid.className = 'inicio-asignaturas-grid';

    asignaturas.forEach((asig, index) => {
      const avance = avances[index] || { porcentaje: 0, revisados: 0, total: 0 };
      const tarjeta = document.createElement('article');
      tarjeta.className = 'inicio-asignatura-tarjeta';

      tarjeta.innerHTML = `
        <div class="inicio-asignatura-tarjeta__cabecera">
          <h3 class="inicio-asignatura-tarjeta__titulo">${ui.escapar(asig.nombre)}</h3>
          <span class="insignia insignia--primario">${ui.escapar(asig.nivel || 'COLEGIO')}</span>
        </div>

        <p class="inicio-asignatura-tarjeta__desc">
          ${ui.escapar(asig.descripcion || 'Sin descripción disponible.')}
        </p>

        <div class="inicio-asignatura-tarjeta__avance">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Avance en temas</span>
            <strong style="font-size: var(--tamano-s); color: var(--color-primario);">${avance.porcentaje}%</strong>
          </div>
          <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
            <div class="progreso__barra" style="width: ${avance.porcentaje}%;"></div>
          </div>
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
            ${avance.revisados} de ${avance.total} temas revisados
          </span>
        </div>

        <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario btn--pequeno" style="align-self: flex-end;">
          Ingresar a la materia →
        </a>
      `;

      grid.appendChild(tarjeta);
    });

    contenedor.innerHTML = '';
    contenedor.appendChild(grid);
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error">
        Error al cargar asignaturas: ${ui.escapar(err.message || 'Error desconocido')}
      </div>
    `;
  }
}

async function cargarNoticiasRecientes() {
  const contenedor = document.getElementById('inicioContenedorNoticias');
  if (!contenedor) return;

  try {
    const noticias = await api.listar('noticias');

    // Filtrar solo las publicadas
    const publicadas = (Array.isArray(noticias) ? noticias : []).filter(
      (n) => n.estado === 'publicado'
    );

    if (publicadas.length === 0) {
      contenedor.innerHTML = `
        <div class="tarjeta vacio">
          <p style="font-size: var(--tamano-m); color: var(--color-texto-suave); margin: 0;">
            No hay noticias publicadas por el momento.
          </p>
        </div>
      `;
      return;
    }

    // Ordenar: destacadas primero, luego por fecha de publicación descendente
    publicadas.sort((a, b) => {
      const destA = a.destacada ? 1 : 0;
      const destB = b.destacada ? 1 : 0;
      if (destA !== destB) return destB - destA;

      const fechaA = a.fechaPublicacion || a.fecha || '';
      const fechaB = b.fechaPublicacion || b.fecha || '';
      return fechaB.localeCompare(fechaA);
    });

    const top3 = publicadas.slice(0, 3);

    const grid = document.createElement('div');
    grid.className = 'inicio-noticias-grid';

    top3.forEach((noticia) => {
      const tarjeta = document.createElement('article');
      tarjeta.className = `inicio-noticia-tarjeta ${noticia.destacada ? 'inicio-noticia-tarjeta--destacada' : ''}`;

      const fechaIso = noticia.fechaPublicacion || noticia.fecha;
      const fechaTexto = fechaIso ? util.fechaRelativa(fechaIso) : '';

      tarjeta.innerHTML = `
        ${
          noticia.imagen
            ? `<img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="inicio-noticia-tarjeta__img" loading="lazy">`
            : `<div class="inicio-noticia-tarjeta__img-fallback" aria-hidden="true">📰</div>`
        }

        <div class="inicio-noticia-tarjeta__cuerpo">
          <div class="inicio-noticia-tarjeta__metas">
            <span class="insignia insignia--secundario">${ui.escapar(noticia.categoria || 'General')}</span>
            ${noticia.destacada ? '<span class="insignia insignia--acento">Destacada</span>' : ''}
            ${fechaTexto ? `<span>• ${ui.escapar(fechaTexto)}</span>` : ''}
          </div>

          <h3 class="inicio-noticia-tarjeta__titulo">${ui.escapar(noticia.titulo)}</h3>

          <p class="inicio-noticia-tarjeta__resumen">
            ${ui.escapar(noticia.resumen || '')}
          </p>

          <div class="inicio-noticia-tarjeta__pie">
            <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" class="btn btn--secundario btn--pequeno">
              Leer noticia →
            </a>
          </div>
        </div>
      `;

      grid.appendChild(tarjeta);
    });

    contenedor.innerHTML = '';
    contenedor.appendChild(grid);
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error">
        Error al cargar noticias: ${ui.escapar(err.message || 'Error desconocido')}
      </div>
    `;
  }
}
