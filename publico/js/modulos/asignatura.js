import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Contenidos de la Asignatura', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');
const asignaturaId = util.parametro('id');

let historialTutor = [];
let ventanaTutorActiva = null;

if (contenido) {
  if (!asignaturaId) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        No se especificó la asignatura.
        <a href="/paginas/asignaturas.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Mis Asignaturas
        </a>
      </div>
    `;
  } else {
    contenido.innerHTML = `
      <div style="text-align: center; padding: var(--espacio-2xl);">
        <div class="cargando" role="status" aria-label="Cargando asignatura"></div>
      </div>
    `;

    iniciarVistaAsignatura();
  }
}

async function iniciarVistaAsignatura() {
  try {
    const [asignatura, todasUnidades, todosTemas, progreso] = await Promise.all([
      api.obtener('asignaturas', asignaturaId),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    if (!asignatura) {
      throw new Error('Asignatura no encontrada.');
    }

    // Filtrar unidades visibles de esta asignatura
    const unidades = (todasUnidades || [])
      .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    const idsUnidades = new Set(unidades.map((u) => u.id));

    // Filtrar temas publicados de estas unidades
    const temasPublicados = (todosTemas || [])
      .filter((t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado')
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    const temasRevisadosIds = new Set((progreso || []).map((p) => p.temaId));

    const totalTemas = temasPublicados.length;
    const totalRevisados = temasPublicados.filter((t) => temasRevisadosIds.has(t.id)).length;
    const porcentaje = totalTemas > 0 ? Math.round((totalRevisados / totalTemas) * 100) : 0;

    contenido.innerHTML = `
      <div class="asignatura-detalle-cabecera">
        <a href="/paginas/asignaturas.html" class="btn btn--secundario btn--pequeno" style="margin-bottom: var(--espacio-m);">
          ← Volver a Mis Asignaturas
        </a>

        <div class="asignatura-detalle-info">
          ${asignatura.imagen ? `
            <div class="asignatura-detalle-portada">
              <img src="${ui.escapar(asignatura.imagen)}" alt="${ui.escapar(asignatura.nombre)}" class="asignatura-detalle-portada__img">
            </div>
          ` : ''}

          <div class="fila" style="justify-content: space-between; align-items: flex-start; gap: var(--espacio-m); margin-bottom: var(--espacio-s);">
            <h1 style="margin: 0; font-size: var(--tamano-2xl);">${ui.escapar(asignatura.nombre)}</h1>
            <span class="insignia insignia--primario">${ui.escapar(asignatura.nivel || 'COLEGIO')}</span>
          </div>

          <p style="color: var(--color-texto-suave); font-size: var(--tamano-m); margin-bottom: var(--espacio-l);">
            ${ui.escapar(asignatura.descripcion || 'Plan de estudios y contenidos educativos.')}
          </p>

          <div style="background-color: var(--color-fondo); padding: var(--espacio-m); border-radius: var(--radio-m); border: 1px solid var(--color-borde);">
            <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-xs);">
              <span style="font-size: var(--tamano-s); font-weight: var(--peso-seminegrita);">Progreso general del curso</span>
              <strong style="color: var(--color-primario); font-size: var(--tamano-m);">${porcentaje}%</strong>
            </div>
            <div class="progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100">
              <div class="progreso__barra" style="width: ${porcentaje}%;"></div>
            </div>
            <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave); display: block; margin-top: var(--espacio-xs);">
              ${totalRevisados} de ${totalTemas} temas completados
            </span>
          </div>
        </div>

        <!-- Banner del Tutor Socrático -->
        <section class="asignatura-tutor-banner" aria-label="Tutor Socrático Inteligente">
          <div class="asignatura-tutor-banner__info">
            <div class="asignatura-tutor-banner__avatar" aria-hidden="true">🦉</div>
            <div>
              <h2 style="margin: 0; font-size: var(--tamano-l); color: var(--color-primario);">
                Tutor Socrático de ${ui.escapar(asignatura.nombre)}
              </h2>
              <p style="margin: var(--espacio-xs) 0 0 0; color: var(--color-texto-suave); font-size: var(--tamano-s);">
                ¿Tienes dudas con los contenidos? Tu tutor socrático te acompaña mediante preguntas orientadoras y pistas para que descubras y formules las respuestas por ti mismo.
              </p>
            </div>
          </div>
          <button type="button" class="btn btn--primario" id="btn-abrir-tutor-banner">
            💬 Iniciar Tutor Socrático
          </button>
        </section>
      </div>

      <div class="unidades-contenedor" id="contenedorUnidades"></div>

      <!-- Botón flotante accesible del Tutor Socrático -->
      <button type="button" class="tutor-flotante-btn" id="btn-flotante-tutor" aria-label="Abrir chat del Tutor Socrático">
        <span>🦉 Tutor Socrático</span>
      </button>
    `;

    // Vincular apertura del Tutor Socrático
    document.getElementById('btn-abrir-tutor-banner')?.addEventListener('click', () => {
      abrirChatTutor(asignatura, temasPublicados);
    });

    document.getElementById('btn-flotante-tutor')?.addEventListener('click', () => {
      abrirChatTutor(asignatura, temasPublicados);
    });

    const contenedorUnidades = document.getElementById('contenedorUnidades');

    if (unidades.length === 0) {
      contenedorUnidades.innerHTML = `
        <div class="tarjeta vacio">
          <p style="font-size: var(--tamano-l); font-weight: var(--peso-seminegrita); color: var(--color-primario);">
            No hay unidades disponibles en esta asignatura
          </p>
          <p style="color: var(--color-texto-suave); font-size: var(--tamano-s);">
            El docente publicará las unidades del curso próximamente.
          </p>
        </div>
      `;
      return;
    }

    unidades.forEach((u, index) => {
      const temasDeUnidad = temasPublicados.filter((t) => t.unidadId === u.id);
      const bloque = document.createElement('section');
      bloque.className = 'unidad-bloque';

      bloque.innerHTML = `
        <div class="unidad-bloque__cabecera">
          <div class="fila" style="align-items: center; gap: var(--espacio-s);">
            <span class="chip" style="font-weight: var(--peso-negrita); font-size: var(--tamano-xs);">
              Unidad ${u.orden || (index + 1)}
            </span>
            <h2 class="unidad-bloque__titulo">${ui.escapar(u.titulo)}</h2>
          </div>
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">
            ${temasDeUnidad.length} ${temasDeUnidad.length === 1 ? 'tema' : 'temas'}
          </span>
        </div>

        <div class="temas-lista">
          ${
            temasDeUnidad.length > 0
              ? temasDeUnidad
                  .map((t, idxTema) => {
                    const revisado = temasRevisadosIds.has(t.id);
                    return `
                    <article class="tema-fila">
                      <div class="tema-fila__info">
                        <span class="chip" style="font-size: var(--tamano-xs); min-width: 45px; text-align: center;">
                          ${u.orden || (index + 1)}.${t.orden || (idxTema + 1)}
                        </span>
                        <h3 class="tema-fila__titulo">${ui.escapar(t.titulo)}</h3>
                      </div>

                      <div class="tema-fila__acciones fila" style="gap: var(--espacio-m); align-items: center;">
                        <span class="insignia ${revisado ? 'insignia--exito' : 'insignia--advertencia'}">
                          ${revisado ? 'Revisado ✓' : 'Pendiente'}
                        </span>
                        <a href="/paginas/tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--secundario btn--pequeno">
                          Ver tema →
                        </a>
                      </div>
                    </article>
                  `;
                  })
                  .join('')
              : `
                <div style="padding: var(--espacio-m); color: var(--color-texto-suave); font-size: var(--tamano-s); text-align: center;">
                  No hay temas publicados en esta unidad.
                </div>
              `
          }
        </div>
      `;

      contenedorUnidades.appendChild(bloque);
    });
  } catch (err) {
    contenido.innerHTML = `
      <div class="alerta alerta--error">
        ${ui.escapar(err.message || 'Error al cargar la asignatura')}
        <a href="/paginas/asignaturas.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Mis Asignaturas
        </a>
      </div>
    `;
  }
}

/**
 * Abre la interfaz de chat interactiva del Tutor Socrático
 */
function abrirChatTutor(asignatura, temasPublicados, temaSeleccionadoId = null) {
  if (ventanaTutorActiva) {
    ventanaTutorActiva.remove();
    ventanaTutorActiva = null;
  }

  // Mensaje de bienvenida inicial si la conversación está vacía
  if (historialTutor.length === 0) {
    historialTutor.push({
      remitente: 'tutor',
      texto: `¡Hola! Soy tu tutor socrático en ${asignatura.nombre}. Mi propósito no es darte respuestas directas, sino guiarte con preguntas clave para que construyas tus propios conocimientos. ¿Qué duda o concepto te gustaría explorar hoy?`,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  const overlay = document.createElement('div');
  overlay.className = 'tutor-chat-overlay';

  overlay.innerHTML = `
    <div class="tutor-chat-ventana" role="dialog" aria-modal="true" aria-labelledby="tutor-chat-titulo">
      <header class="tutor-chat-cabecera">
        <div class="tutor-chat-cabecera-info">
          <div class="tutor-chat-icono-avatar" aria-hidden="true">🦉</div>
          <div>
            <h3 class="tutor-chat-titulo" id="tutor-chat-titulo">Tutor: ${ui.escapar(asignatura.nombre)}</h3>
            <span class="tutor-chat-subtitulo">● En línea · Método Socrático (${ui.escapar(asignatura.nivel || 'COLEGIO')})</span>
          </div>
        </div>
        <button type="button" class="tutor-chat-btn-cerrar" id="btn-cerrar-tutor" aria-label="Cerrar chat del tutor">
          ✕
        </button>
      </header>

      <div class="tutor-chat-filtro-tema">
        <label for="select-tutor-tema">Tema de enfoque:</label>
        <select id="select-tutor-tema">
          <option value="">Toda la asignatura (Marco general)</option>
          ${temasPublicados
            .map(
              (t) => `
            <option value="${ui.escapar(t.id)}" ${t.id === temaSeleccionadoId ? 'selected' : ''}>
              ${ui.escapar(t.titulo)}
            </option>
          `
            )
            .join('')}
        </select>
      </div>

      <div class="tutor-chat-mensajes" id="tutor-chat-mensajes" aria-live="polite"></div>

      <div class="tutor-chat-sugerencias">
        <button type="button" class="tutor-sugerencia-chip" data-sugerencia="¿Cuáles son los conceptos clave de este tema?">
          💡 Conceptos clave
        </button>
        <button type="button" class="tutor-sugerencia-chip" data-sugerencia="Tengo dudas sobre este tema, ¿me ayudas a razonarlo?">
          🔍 Ayuda para razonar
        </button>
        <button type="button" class="tutor-sugerencia-chip" data-sugerencia="¿Me das una pista sobre cómo aplicar esto?">
          🎯 Pista de aplicación
        </button>
      </div>

      <form class="tutor-chat-formulario" id="form-tutor-chat">
        <textarea
          id="tutor-input-mensaje"
          class="tutor-chat-textarea"
          placeholder="Escribe tu razonamiento o pregunta... (Enter para enviar)"
          rows="1"
          required
        ></textarea>
        <button type="submit" id="btn-enviar-tutor" class="tutor-chat-btn-enviar" aria-label="Enviar mensaje">
          ➤
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  ventanaTutorActiva = overlay;

  const contMensajes = overlay.querySelector('#tutor-chat-mensajes');
  const textarea = overlay.querySelector('#tutor-input-mensaje');
  const btnEnviar = overlay.querySelector('#btn-enviar-tutor');
  const selectTema = overlay.querySelector('#select-tutor-tema');
  const btnCerrar = overlay.querySelector('#btn-cerrar-tutor');

  function renderizarMensajes() {
    contMensajes.innerHTML = historialTutor
      .map((m) => {
        const esEstudiante = m.remitente === 'estudiante';
        return `
          <div class="tutor-mensaje ${esEstudiante ? 'tutor-mensaje--estudiante' : 'tutor-mensaje--tutor'}">
            <div class="tutor-mensaje-avatar" aria-hidden="true">${esEstudiante ? '👤' : '🦉'}</div>
            <div class="tutor-mensaje-cuerpo">
              <div class="tutor-mensaje-burbuja">${ui.escapar(m.texto)}</div>
              <span class="tutor-mensaje-tiempo">${ui.escapar(m.hora || '')}</span>
            </div>
          </div>
        `;
      })
      .join('');

    contMensajes.scrollTop = contMensajes.scrollHeight;
  }

  renderizarMensajes();
  textarea.focus();

  // Cerrar chat
  function cerrarChat() {
    overlay.remove();
    ventanaTutorActiva = null;
  }

  btnCerrar.addEventListener('click', cerrarChat);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarChat();
  });

  // Enviar sugerencia rápida
  overlay.querySelectorAll('.tutor-sugerencia-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      textarea.value = chip.dataset.sugerencia;
      enviarMensaje();
    });
  });

  // Manejo de Enter para enviar
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });

  overlay.querySelector('#form-tutor-chat').addEventListener('submit', (e) => {
    e.preventDefault();
    enviarMensaje();
  });

  async function enviarMensaje() {
    const texto = textarea.value.trim();
    if (!texto) return;

    textarea.value = '';
    textarea.disabled = true;
    btnEnviar.disabled = true;

    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    historialTutor.push({ remitente: 'estudiante', texto, hora });
    renderizarMensajes();

    // Mostrar indicador de pensamiento socrático
    const indicadorPensando = document.createElement('div');
    indicadorPensando.className = 'tutor-mensaje tutor-mensaje--tutor';
    indicadorPensando.id = 'indicador-tutor-pensando';
    indicadorPensando.innerHTML = `
      <div class="tutor-mensaje-avatar" aria-hidden="true">🦉</div>
      <div class="tutor-pensando-caja">
        <span>El tutor está formulando una pregunta</span>
        <span class="tutor-punto-animado"></span>
        <span class="tutor-punto-animado"></span>
        <span class="tutor-punto-animado"></span>
      </div>
    `;
    contMensajes.appendChild(indicadorPensando);
    contMensajes.scrollTop = contMensajes.scrollHeight;

    try {
      const res = await api.ia('tutor', {
        asignaturaId: asignatura.id,
        temaId: selectTema.value || null,
        mensaje: texto,
        historial: historialTutor
      });

      const respuestaTexto =
        typeof res === 'string'
          ? res
          : res?.respuesta || 'Reflexionemos juntos sobre lo que acabas de plantear.';

      indicadorPensando.remove();

      historialTutor.push({
        remitente: 'tutor',
        texto: respuestaTexto,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      renderizarMensajes();
    } catch (err) {
      indicadorPensando.remove();
      ui.aviso(err.message || 'Error al conectar con el tutor', 'error');
      historialTutor.push({
        remitente: 'tutor',
        texto:
          'Parece que hubo una breve interrupción en la conexión. ¿Podrías volver a formular tu idea para continuar razonando juntos?',
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      renderizarMensajes();
    } finally {
      const pensando = contMensajes.querySelector('#indicador-tutor-pensando');
      if (pensando) pensando.remove();
      textarea.disabled = false;
      btnEnviar.disabled = false;
      textarea.focus();
    }
  }
}
