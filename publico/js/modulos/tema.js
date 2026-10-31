import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

await montarPlantilla({ titulo: "Contenido del Tema", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('id');

function obtenerEmbedVideo(url) {
  if (!url) return null;
  // YouTube watch o short
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  }
  // Google Drive preview
  const gdMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdMatch) {
    return `https://drive.google.com/file/d/${gdMatch[1]}/preview`;
  }
  return null;
}

if (contenido) {
  if (!temaId) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        No se especificó ningún tema.
        <a href="/paginas/asignaturas.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Mis Asignaturas
        </a>
      </div>
    `;
  } else {
    contenido.innerHTML = `
      <div style="text-align: center; padding: var(--espacio-2xl);">
        <div class="cargando" role="status" aria-label="Cargando contenido del tema"></div>
      </div>
    `;

    iniciarVistaTema();
  }
}

async function iniciarVistaTema() {
  try {
    const [tema, progreso] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('progreso-temas')
    ]);

    if (!tema) {
      throw new Error('Tema no encontrado.');
    }

    // Guardar en localStorage último tema consultado
    try {
      localStorage.setItem('ultimoTema', JSON.stringify({ id: tema.id, titulo: tema.titulo }));
    } catch {
      // Ignorar restricciones en navegación privada
    }

    // Resolver unidad y asignatura para las migas de pan
    let unidad = null;
    let asignatura = null;
    try {
      if (tema.unidadId) {
        unidad = await api.obtener('unidades', tema.unidadId);
        if (unidad && unidad.asignaturaId) {
          asignatura = await api.obtener('asignaturas', unidad.asignaturaId);
        }
      }
    } catch {
      // Si falla obtener ancestros, se muestran migas simplificadas
    }

    const yaRevisado = Array.isArray(progreso) && progreso.some((p) => p.temaId === tema.id);

    // Formatear estrellas de dificultad
    const numDificultad = Number(tema.dificultad) || 1;
    const estrellas = '★'.repeat(Math.min(numDificultad, 5)) + '☆'.repeat(Math.max(0, 5 - numDificultad));

    contenido.innerHTML = `
      <!-- Migas de pan de navegación -->
      <nav aria-label="Migas de pan" class="tema-migas">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span aria-hidden="true">&gt;</span>
        ${
          asignatura
            ? `<a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}">${ui.escapar(asignatura.nombre)}</a><span aria-hidden="true">&gt;</span>`
            : ''
        }
        ${unidad ? `<span>${ui.escapar(unidad.titulo)}</span><span aria-hidden="true">&gt;</span>` : ''}
        <span aria-current="page" style="font-weight: var(--peso-negrita); color: var(--color-texto);">
          ${ui.escapar(tema.titulo)}
        </span>
      </nav>

      <!-- Cabecera del tema y botón de revisión -->
      <header class="tema-cabecera-bloque">
        <div>
          <h1 style="margin: 0; font-size: var(--tamano-2xl); color: var(--color-primario);">
            ${ui.escapar(tema.titulo)}
          </h1>
          <div class="tema-cabecera-meta">
            <span class="tema-meta-pildora" title="Nivel de dificultad">
              ⭐ Nivel: ${estrellas} (${numDificultad}/5)
            </span>
            <span class="tema-meta-pildora">
              ⏱️ Lectura activa: ~5-7 min
            </span>
            ${asignatura ? `
              <span class="tema-meta-pildora" style="color: var(--color-primario);">
                📚 ${ui.escapar(asignatura.nombre)}
              </span>
            ` : ''}
          </div>
        </div>

        <div id="contenedorBotonRevision">
          ${
            yaRevisado
              ? `<button type="button" class="btn btn--secundario" disabled>Revisado ✓</button>`
              : `<button type="button" class="btn btn--primario" id="btnMarcarRevisado">Marcar como revisado</button>`
          }
        </div>
      </header>

      <!-- 🎯 Objetivos de Aprendizaje -->
      ${
        Array.isArray(tema.objetivos) && tema.objetivos.length > 0
          ? `
            <section class="tarjeta tema-seccion-bloque" aria-labelledby="seccionObjetivos">
              <div class="tema-seccion-cabecera">
                <h2 id="seccionObjetivos" class="tema-seccion-titulo">
                  🎯 ¿Qué vas a dominar hoy?
                </h2>
              </div>
              <ul class="tema-objetivos-lista">
                ${tema.objetivos.map((obj) => `
                  <li class="tema-objetivo-item">
                    <span class="tema-objetivo-icono" aria-hidden="true">✓</span>
                    <span>${ui.escapar(obj)}</span>
                  </li>
                `).join('')}
              </ul>
            </section>
          `
          : ''
      }

      <!-- 📖 Explicación del Tema Humanizada y Dinámica -->
      <section class="tarjeta tema-seccion-bloque" aria-labelledby="seccionResumen">
        <div class="tema-seccion-cabecera">
          <h2 id="seccionResumen" class="tema-seccion-titulo">
            📖 Explicación Dinámica del Tema
          </h2>
        </div>
        <div class="tema-resumen-cuerpo">
          ${ui.limpiar(util.formatoBasico(tema.resumen || 'Sin explicación disponible.'))}
        </div>
      </section>

      <!-- 💡 Ejemplos y Casos Prácticos de la Vida Real -->
      ${
        Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0
          ? `
            <section class="tarjeta tema-seccion-bloque" aria-labelledby="seccionEjemplos">
              <div class="tema-seccion-cabecera">
                <h2 id="seccionEjemplos" class="tema-seccion-titulo">
                  💡 Casos Prácticos de la Vida Real
                </h2>
              </div>
              <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
                Analiza cómo se aplican estos conceptos en situaciones reales de emprendedores ecuatorianos:
              </p>
              <div class="ejemplos-grid">
                ${tema.ejemplos.map((ej, idx) => {
                  const textoLimpio = String(ej || '').trim();
                  // Detectar si tiene un prefijo "Caso Práctico X:" o "Ejemplo X:"
                  const matchTitulo = textoLimpio.match(/^(Caso\s+Pr[aá]ctico\s+\d+|Ejemplo\s+[A-Za-z0-9]+)\s*:\s*(.*)/i);
                  const tituloCard = matchTitulo ? matchTitulo[1] : `Caso Práctico ${idx + 1}`;
                  const cuerpoCard = matchTitulo ? matchTitulo[2] : textoLimpio;

                  return `
                    <div class="ejemplo-item">
                      <div class="ejemplo-item__cabecera">
                        <span class="insignia insignia--primario">${ui.escapar(tituloCard)}</span>
                      </div>
                      <div class="ejemplo-item__contenido">
                        ${ui.limpiar(util.formatoBasico(cuerpoCard))}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </section>
          `
          : ''
      }

      <!-- ⚠️ Errores comunes a evitar -->
      ${
        Array.isArray(tema.erroresFrecuentes) && tema.erroresFrecuentes.length > 0
          ? `
            <section class="tarjeta tema-seccion-bloque tema-errores-card" aria-labelledby="seccionErrores">
              <div class="tema-seccion-cabecera">
                <h2 id="seccionErrores" class="tema-seccion-titulo" style="color: var(--color-peligro, #e74c3c);">
                  ⚠️ ¡Cuidado con estos errores frecuentes!
                </h2>
              </div>
              <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
                Aprender de las equivocaciones de otros te ahorrará pérdidas y frustraciones en tu negocio:
              </p>
              <div class="pila" style="gap: var(--espacio-s);">
                ${tema.erroresFrecuentes.map((err) => `
                  <div class="tema-error-item">
                    <span class="tema-error-icono" aria-hidden="true">❌</span>
                    <div>${ui.escapar(err)}</div>
                  </div>
                `).join('')}
              </div>
            </section>
          `
          : ''
      }

      <!-- 🦉 Preguntas socráticas para reflexionar -->
      ${
        Array.isArray(tema.preguntasGuia) && tema.preguntasGuia.length > 0
          ? `
            <section class="tarjeta tema-seccion-bloque tema-preguntas-card" aria-labelledby="seccionPreguntas">
              <div class="tema-seccion-cabecera">
                <h2 id="seccionPreguntas" class="tema-seccion-titulo">
                  🦉 Preguntas para razonar (Método Socrático)
                </h2>
                ${asignatura ? `
                  <a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}" class="btn btn--primario btn--pequeno">
                    Hablar con el Tutor Socrático 🦉
                  </a>
                ` : ''}
              </div>
              <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
                Tómate un minuto para reflexionar en estas preguntas clave antes de pasar a la práctica:
              </p>
              <div class="preguntas-socraticas-grid">
                ${tema.preguntasGuia.map((preg, idx) => `
                  <div class="pregunta-socratica-item">
                    <div class="pregunta-socratica-item__num" aria-hidden="true">${idx + 1}</div>
                    <div class="pregunta-socratica-item__texto">${ui.escapar(preg)}</div>
                  </div>
                `).join('')}
              </div>
            </section>
          `
          : ''
      }

      <!-- 📁 Recursos Multimedia y Documentos -->
      ${
        Array.isArray(tema.recursos) && tema.recursos.length > 0
          ? `
            <section class="tarjeta tema-seccion-bloque" aria-labelledby="seccionRecursos">
              <div class="tema-seccion-cabecera">
                <h2 id="seccionRecursos" class="tema-seccion-titulo">
                  📁 Material y Recursos de Apoyo
                </h2>
              </div>
              <div class="recursos-grid">
                ${tema.recursos.map((rec) => {
                  const embedUrl = obtenerEmbedVideo(rec.url);
                  const esMp4 = rec.url && rec.url.endsWith('.mp4');

                  if (rec.tipo === 'video') {
                    if (embedUrl) {
                      return `
                        <div class="recurso-tarjeta" style="grid-column: 1 / -1;">
                          <strong>📺 ${ui.escapar(rec.titulo || 'Video explicativo')}</strong>
                          <div class="video-contenedor">
                            <iframe src="${embedUrl}" title="${ui.escapar(rec.titulo || 'Video educativo')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                          </div>
                        </div>
                      `;
                    } else if (esMp4) {
                      return `
                        <div class="recurso-tarjeta" style="grid-column: 1 / -1;">
                          <strong>📺 ${ui.escapar(rec.titulo || 'Video')}</strong>
                          <div class="video-contenedor">
                            <video controls src="${ui.escapar(rec.url)}" title="${ui.escapar(rec.titulo || 'Video')}"></video>
                          </div>
                        </div>
                      `;
                    }
                  }

                  if (rec.tipo === 'infografia' || rec.tipo === 'imagen') {
                    return `
                      <div class="recurso-tarjeta" style="justify-content: space-between;">
                        <div>
                          <strong>📊 ${ui.escapar(rec.titulo || 'Infografía didáctica')}</strong>
                          <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin-top: var(--espacio-xs);">
                            Esquema visual descargable o interactivo
                          </p>
                        </div>
                        <a href="${ui.escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--pequeno" style="align-self: flex-start;">
                          Ver Infografía ↗
                        </a>
                      </div>
                    `;
                  }

                  if (rec.tipo === 'pdf') {
                    return `
                      <div class="recurso-tarjeta" style="justify-content: space-between;">
                        <div>
                          <strong>📄 ${ui.escapar(rec.titulo || 'Documento PDF')}</strong>
                          <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin-top: var(--espacio-xs);">
                            Guía imprimible o plantilla
                          </p>
                        </div>
                        <a href="${ui.escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--pequeno" style="align-self: flex-start;">
                          Abrir PDF ↗
                        </a>
                      </div>
                    `;
                  }

                  return `
                    <div class="recurso-tarjeta" style="justify-content: space-between;">
                      <div>
                        <strong>🔗 ${ui.escapar(rec.titulo || 'Recurso complementario')}</strong>
                      </div>
                      <a href="${ui.escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--pequeno" style="align-self: flex-start;">
                        Visitar enlace ↗
                      </a>
                    </div>
                  `;
                }).join('')}
              </div>
            </section>
          `
          : ''
      }

      <!-- 🎮 Bloque Practica este tema -->
      <section class="practica-bloque tema-seccion-bloque" aria-labelledby="seccionPractica">
        <div class="tema-seccion-cabecera">
          <h2 id="seccionPractica" class="tema-seccion-titulo">
            🎮 ¡Pon a prueba lo aprendido!
          </h2>
        </div>
        <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-m);">
          Completa los quizzes por niveles, gana puntos de experiencia, desbloquea diplomas y afianza tus conocimientos:
        </p>
        <div id="contenedorActividades">
          ${
            Array.isArray(ACTIVIDADES) && ACTIVIDADES.length > 0
              ? `
                <div class="recursos-grid">
                  ${ACTIVIDADES.map((act) => `
                    <div class="tarjeta" style="display: flex; flex-direction: column; justify-content: space-between; gap: var(--espacio-s); background-color: var(--color-superficie);">
                      <div>
                        <h3 style="margin: 0; font-size: var(--tamano-m); color: var(--color-primario);">${ui.escapar(act.texto)}</h3>
                        <p style="font-size: var(--tamano-xs); color: var(--color-texto-suave); margin-top: var(--espacio-xs);">${ui.escapar(act.descripcion || '')}</p>
                      </div>
                      <a href="${act.href}?temaId=${encodeURIComponent(tema.id)}" class="btn btn--acento btn--pequeno">
                        Iniciar actividad →
                      </a>
                    </div>
                  `).join('')}
                </div>
              `
              : `
                <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin: 0;">
                  Por el momento no hay actividades interactivas disponibles para este tema.
                </p>
              `
          }
        </div>
      </section>
    `;

    // Evento botón "Marcar como revisado"
    const btnRevision = document.getElementById('btnMarcarRevisado');
    if (btnRevision) {
      btnRevision.addEventListener('click', async () => {
        btnRevision.disabled = true;
        btnRevision.textContent = 'Guardando...';

        try {
          await api.crear('progreso-temas', { temaId: tema.id });
          await registrarIntento({ actividad: 'tema-revisado', temaId: tema.id, puntaje: 1, maximo: 1 });
          document.getElementById('contenedorBotonRevision').innerHTML = `
            <button type="button" class="btn btn--secundario" disabled>Revisado ✓</button>
          `;
          ui.aviso('¡Felicitaciones! Has completado la revisión de este tema.', 'exito');
        } catch (err) {
          ui.aviso(err.message || 'Error al registrar progreso', 'error');
          btnRevision.disabled = false;
          btnRevision.textContent = 'Marcar como revisado';
        }
      });
    }
  } catch (err) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        ${ui.escapar(err.message || 'Error al cargar los datos del tema.')}
        <a href="/paginas/asignaturas.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Mis Asignaturas
        </a>
      </div>
    `;
  }
}
