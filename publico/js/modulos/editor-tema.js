import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: "Ficha del Tema y Glosario", roles: ["docente", "admin"] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('id');

function contarPalabras(texto) {
  if (!texto || typeof texto !== 'string') return 0;
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  return palabras.length;
}

if (contenido) {
  if (!temaId) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        No se especificó ningún identificador de tema.
        <a href="/paginas/editor-contenidos.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Contenidos
        </a>
      </div>
    `;
  } else {
    contenido.innerHTML = `
      <div style="text-align: center; padding: var(--espacio-2xl);">
        <div class="cargando" role="status" aria-label="Cargando tema"></div>
      </div>
    `;

    iniciarEditorTema();
  }
}

async function iniciarEditorTema() {
  let tema = null;
  let terminosGlosario = [];
  let hayCambiosSinGuardar = false;

  try {
    tema = await api.obtener('temas', temaId);
    if (!tema) throw new Error('Tema no encontrado');
    const todosGlosario = await api.listar('glosario');
    terminosGlosario = (todosGlosario || []).filter((g) => g.temaId === temaId);
  } catch (err) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-l);">
        ${ui.escapar(err.message || 'Error al cargar los datos del tema.')}
        <a href="/paginas/editor-contenidos.html" class="btn btn--secundario btn--pequeno" style="margin-left: var(--espacio-m);">
          Volver a Contenidos
        </a>
      </div>
    `;
    return;
  }

  // Estructuras de datos locales para la ficha
  let objetivos = Array.isArray(tema.objetivos) ? [...tema.objetivos] : [];
  let ejemplos = Array.isArray(tema.ejemplos) ? [...tema.ejemplos] : [];
  let erroresFrecuentes = Array.isArray(tema.erroresFrecuentes) ? [...tema.erroresFrecuentes] : [];
  let preguntasGuia = Array.isArray(tema.preguntasGuia) ? [...tema.preguntasGuia] : [];
  let recursos = Array.isArray(tema.recursos)
    ? tema.recursos.map((r) => ({ tipo: r.tipo || 'enlace', titulo: r.titulo || '', url: r.url || '' }))
    : [];

  renderizarEditor();

  function marcarCambio() {
    hayCambiosSinGuardar = true;
  }

  function renderizarEditor() {
    contenido.innerHTML = `
      <div class="editor-tema-cabecera">
        <div>
          <a href="/paginas/editor-contenidos.html" id="enlaceVolver" class="btn btn--secundario btn--pequeno" style="margin-bottom: var(--espacio-xs);">
            ← Volver a Contenidos
          </a>
          <h1 style="margin: 0; font-size: var(--tamano-2xl);">${ui.escapar(tema.titulo || 'Sin título')}</h1>
          <span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">ID: ${ui.escapar(tema.id)}</span>
        </div>
        <div class="editor-tema-acciones">
          <button type="button" class="btn btn--secundario" id="btn-generar-ia" disabled title="Se activa en P07.2">
            🤖 Generar con IA
          </button>
          <button type="button" class="btn btn--primario" id="btnGuardarFicha">
            💾 Guardar Cambios
          </button>
        </div>
      </div>

      <!-- SECCIÓN 1: FICHA PEDAGÓGICA -->
      <section class="tarjeta tema-seccion" aria-labelledby="tituloFicha">
        <h2 id="tituloFicha" style="color: var(--color-primario); margin-bottom: var(--espacio-m); border-bottom: 2px solid var(--color-borde); padding-bottom: var(--espacio-xs);">
          Ficha Pedagógica del Tema
        </h2>

        <form id="formFicha" class="pila" novalidate>
          <div class="campo">
            <label for="inputTitulo">Título del Tema</label>
            <input type="text" id="inputTitulo" value="${ui.escapar(tema.titulo || '')}" required>
          </div>

          <!-- Objetivos de Aprendizaje -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Objetivos de Aprendizaje</label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarObjetivo">
                + Agregar objetivo
              </button>
            </div>
            <div class="lista-dinamica" id="listaObjetivos"></div>
          </div>

          <!-- Resumen de Contenido con Contador y Formato Básico -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label for="inputResumen">Resumen Explicativo del Tema</label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btnAlternarVistaPrevia">
                👁️ Vista previa con formato
              </button>
            </div>
            <textarea id="inputResumen" rows="8" placeholder="Escribe el resumen. Admite negrita (**texto**), listas (- elemento) y párrafos separados por líneas en blanco.">${ui.escapar(tema.resumen || '')}</textarea>
            <div class="contador-palabras" id="indicadorPalabrasResumen">
              <span>0 palabras (Recomendado: 300 a 800 palabras)</span>
            </div>
            <div id="contenedorVistaPrevia" class="vista-previa-resumen" style="display: none;"></div>
          </div>

          <!-- Ejemplos -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Ejemplos y Casos Resueltos</label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarEjemplo">
                + Agregar ejemplo
              </button>
            </div>
            <div class="lista-dinamica" id="listaEjemplos"></div>
          </div>

          <!-- Errores Frecuentes -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Errores Frecuentes y Confusiones</label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarError">
                + Agregar error frecuente
              </button>
            </div>
            <div class="lista-dinamica" id="listaErrores"></div>
          </div>

          <!-- Preguntas Guía -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Preguntas Guía y Reflexión</label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarPregunta">
                + Agregar pregunta guía
              </button>
            </div>
            <div class="lista-dinamica" id="listaPreguntas"></div>
          </div>

          <!-- Recursos de Apoyo (Video, PDF, Imagen, Enlace) -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Recursos Multimedia y Documentos</label>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarRecurso">
                + Agregar recurso
              </button>
            </div>
            <div class="lista-dinamica" id="listaRecursos"></div>
            <input type="file" id="inputSubidaOculto" style="display: none;">
          </div>

          <!-- Metadatos pedagógicos -->
          <div class="fila" style="gap: var(--espacio-m); flex-wrap: wrap;">
            <div class="campo" style="flex: 2; min-width: 240px;">
              <label for="inputPalabrasClave">Palabras Clave (separadas por comas)</label>
              <input type="text" id="inputPalabrasClave" value="${ui.escapar((tema.palabrasClave || []).join(', '))}" placeholder="ingreso, costo, margen">
            </div>

            <div class="campo" style="flex: 1; min-width: 140px;">
              <label for="selectDificultad">Dificultad (1 a 5)</label>
              <select id="selectDificultad">
                <option value="1" ${tema.dificultad === 1 ? 'selected' : ''}>1 - Básico</option>
                <option value="2" ${tema.dificultad === 2 ? 'selected' : ''}>2 - Intermedio bajo</option>
                <option value="3" ${tema.dificultad === 3 ? 'selected' : ''}>3 - Intermedio</option>
                <option value="4" ${tema.dificultad === 4 ? 'selected' : ''}>4 - Avanzado</option>
                <option value="5" ${tema.dificultad === 5 ? 'selected' : ''}>5 - Experto</option>
              </select>
            </div>

            <div class="campo" style="flex: 1; min-width: 140px;">
              <label for="selectEstado">Estado del Tema</label>
              <select id="selectEstado">
                <option value="borrador" ${tema.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
                <option value="publicado" ${tema.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
              </select>
            </div>
          </div>

          <div class="campo">
            <label for="inputFuentes">Fuentes Curriculares y Bibliografía</label>
            <input type="text" id="inputFuentes" value="${ui.escapar(tema.fuentes || '')}" placeholder="Ej. Currículo Priorizado 2025; Base Pedagógica...">
          </div>
        </form>
      </section>

      <!-- SECCIÓN 2: GLOSARIO DE TÉRMINOS -->
      <section class="tarjeta tema-seccion" aria-labelledby="tituloGlosario">
        <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-m); border-bottom: 2px solid var(--color-borde); padding-bottom: var(--espacio-xs);">
          <h2 id="tituloGlosario" style="color: var(--color-primario); margin: 0;">
            Glosario de Términos
          </h2>
          <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevoTermino">
            + Agregar Término
          </button>
        </div>

        <div class="glosario-metricas" id="metricasGlosario"></div>

        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th>Término</th>
                <th>Definición (máx. 25 palabras)</th>
                <th>Pista (máx. 10 palabras)</th>
                <th>Retroalimentación</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpoTablaGlosario"></tbody>
          </table>
        </div>
      </section>
    `;

    // Inicializar subcomponentes
    montarListasFicha();
    montarContadorResumen();
    montarGlosario();

    // Detección de cambios sin guardar
    contenido.querySelectorAll('input, textarea, select').forEach((elem) => {
      elem.addEventListener('input', marcarCambio);
      elem.addEventListener('change', marcarCambio);
    });

    // Guardar cambios
    document.getElementById('btnGuardarFicha').addEventListener('click', guardarFicha);

    // Salir sin guardar
    document.getElementById('enlaceVolver').addEventListener('click', async (e) => {
      if (hayCambiosSinGuardar) {
        e.preventDefault();
        const salir = await ui.confirmar('Tienes cambios sin guardar en la ficha. ¿Estás seguro de que deseas salir?');
        if (salir) {
          hayCambiosSinGuardar = false;
          window.location.href = '/paginas/editor-contenidos.html';
        }
      }
    });

    window.addEventListener('beforeunload', (e) => {
      if (hayCambiosSinGuardar) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // =================== LISTAS DE LA FICHA ===================

  function montarListasFicha() {
    // Objetivos
    renderListaSimple('listaObjetivos', objetivos, (nuevaLista) => {
      objetivos = nuevaLista;
      marcarCambio();
    });
    document.getElementById('btnAgregarObjetivo').addEventListener('click', () => {
      objetivos.push('');
      marcarCambio();
      renderListaSimple('listaObjetivos', objetivos, (l) => { objetivos = l; });
    });

    // Ejemplos
    renderListaSimple('listaEjemplos', ejemplos, (nuevaLista) => {
      ejemplos = nuevaLista;
      marcarCambio();
    }, 'textarea', 'Describe el ejemplo o caso numérico...');
    document.getElementById('btnAgregarEjemplo').addEventListener('click', () => {
      ejemplos.push('');
      marcarCambio();
      renderListaSimple('listaEjemplos', ejemplos, (l) => { ejemplos = l; }, 'textarea', 'Describe el ejemplo o caso numérico...');
    });

    // Errores
    renderListaSimple('listaErrores', erroresFrecuentes, (nuevaLista) => {
      erroresFrecuentes = nuevaLista;
      marcarCambio();
    }, 'input', 'Ej. Creer que vender más unidades siempre genera mayor margen');
    document.getElementById('btnAgregarError').addEventListener('click', () => {
      erroresFrecuentes.push('');
      marcarCambio();
      renderListaSimple('listaErrores', erroresFrecuentes, (l) => { erroresFrecuentes = l; }, 'input', 'Ej. Creer que vender más unidades siempre genera mayor margen');
    });

    // Preguntas
    renderListaSimple('listaPreguntas', preguntasGuia, (nuevaLista) => {
      preguntasGuia = nuevaLista;
      marcarCambio();
    }, 'input', 'Ej. ¿Qué diferencia una entrada por venta de un insumo de producción?');
    document.getElementById('btnAgregarPregunta').addEventListener('click', () => {
      preguntasGuia.push('');
      marcarCambio();
      renderListaSimple('listaPreguntas', preguntasGuia, (l) => { preguntasGuia = l; }, 'input', 'Ej. ¿Qué diferencia una entrada por venta de un insumo de producción?');
    });

    // Recursos
    renderListaRecursos();
    document.getElementById('btnAgregarRecurso').addEventListener('click', () => {
      recursos.push({ tipo: 'enlace', titulo: '', url: '' });
      marcarCambio();
      renderListaRecursos();
    });
  }

  function renderListaSimple(contenedorId, lista, alCambiar, tipoElemento = 'input', placeholder = 'Escribe aquí...') {
    const cont = document.getElementById(contenedorId);
    if (!cont) return;

    if (lista.length === 0) {
      cont.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">Sin elementos registrados.</span>`;
      return;
    }

    cont.innerHTML = '';
    lista.forEach((item, index) => {
      const fila = document.createElement('div');
      fila.className = 'item-dinamico';

      const campo = tipoElemento === 'textarea'
        ? `<textarea class="item-dinamico__campo" rows="2" placeholder="${ui.escapar(placeholder)}">${ui.escapar(item)}</textarea>`
        : `<input type="text" class="item-dinamico__campo" value="${ui.escapar(item)}" placeholder="${ui.escapar(placeholder)}">`;

      fila.innerHTML = `
        ${campo}
        <button type="button" class="btn btn--peligro btn--pequeno btn-quitar" title="Eliminar elemento">✕</button>
      `;

      const input = fila.querySelector('.item-dinamico__campo');
      input.addEventListener('input', () => {
        lista[index] = input.value;
        alCambiar(lista);
      });

      fila.querySelector('.btn-quitar').addEventListener('click', () => {
        lista.splice(index, 1);
        alCambiar(lista);
        renderListaSimple(contenedorId, lista, alCambiar, tipoElemento, placeholder);
      });

      cont.appendChild(fila);
    });
  }

  function renderListaRecursos() {
    const cont = document.getElementById('listaRecursos');
    const inputSubida = document.getElementById('inputSubidaOculto');
    if (!cont) return;

    if (recursos.length === 0) {
      cont.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--color-texto-suave);">No hay recursos educativos vinculados.</span>`;
      return;
    }

    cont.innerHTML = '';
    recursos.forEach((rec, index) => {
      const fila = document.createElement('div');
      fila.className = 'item-dinamico';

      const admiteSubida = rec.tipo === 'pdf' || rec.tipo === 'imagen';

      fila.innerHTML = `
        <div class="item-dinamico__recurso">
          <select class="rec-tipo">
            <option value="video" ${rec.tipo === 'video' ? 'selected' : ''}>Video</option>
            <option value="pdf" ${rec.tipo === 'pdf' ? 'selected' : ''}>PDF</option>
            <option value="imagen" ${rec.tipo === 'imagen' ? 'selected' : ''}>Imagen</option>
            <option value="enlace" ${rec.tipo === 'enlace' ? 'selected' : ''}>Enlace</option>
          </select>

          <input type="text" class="rec-titulo" value="${ui.escapar(rec.titulo)}" placeholder="Título del recurso">

          <div class="fila" style="gap: var(--espacio-xs); width: 100%;">
            <input type="url" class="rec-url" value="${ui.escapar(rec.url)}" placeholder="https://... o /recursos/..." style="flex-grow: 1;">
            ${
              admiteSubida
                ? `<button type="button" class="btn btn--secundario btn--pequeno btn-subir-archivo" title="Subir archivo al servidor">Subir</button>`
                : ''
            }
          </div>

          <button type="button" class="btn btn--peligro btn--pequeno btn-quitar-rec" title="Eliminar recurso">✕</button>
        </div>
      `;

      const selectTipo = fila.querySelector('.rec-tipo');
      const inputTitulo = fila.querySelector('.rec-titulo');
      const inputUrl = fila.querySelector('.rec-url');
      const btnSubir = fila.querySelector('.btn-subir-archivo');

      selectTipo.addEventListener('change', () => {
        rec.tipo = selectTipo.value;
        marcarCambio();
        renderListaRecursos();
      });

      inputTitulo.addEventListener('input', () => {
        rec.titulo = inputTitulo.value;
        marcarCambio();
      });

      inputUrl.addEventListener('input', () => {
        rec.url = inputUrl.value;
        marcarCambio();
      });

      if (btnSubir) {
        btnSubir.addEventListener('click', () => {
          inputSubida.accept = rec.tipo === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp';
          inputSubida.onchange = async () => {
            const archivo = inputSubida.files && inputSubida.files[0];
            if (!archivo) return;
            try {
              ui.aviso('Subiendo archivo...', 'info');
              const res = await api.subir(archivo);
              rec.url = res.url;
              inputUrl.value = res.url;
              marcarCambio();
              ui.aviso('Archivo subido correctamente', 'exito');
            } catch (err) {
              ui.aviso(err.message || 'Error al subir archivo', 'error');
            } finally {
              inputSubida.value = '';
            }
          };
          inputSubida.click();
        });
      }

      fila.querySelector('.btn-quitar-rec').addEventListener('click', () => {
        recursos.splice(index, 1);
        marcarCambio();
        renderListaRecursos();
      });

      cont.appendChild(fila);
    });
  }

  // =================== RESUMEN Y CONTADOR ===================

  function montarContadorResumen() {
    const textarea = document.getElementById('inputResumen');
    const indicador = document.getElementById('indicadorPalabrasResumen');
    const btnVistaPrevia = document.getElementById('btnAlternarVistaPrevia');
    const contenedorVistaPrevia = document.getElementById('contenedorVistaPrevia');

    let mostrandoVistaPrevia = false;

    function actualizarContador() {
      const cantidad = contarPalabras(textarea.value);
      let estadoClase = '';
      if (cantidad >= 300 && cantidad <= 800) {
        estadoClase = 'contador-palabras--exito';
      } else if (cantidad > 0) {
        estadoClase = 'contador-palabras--alerta';
      }

      indicador.className = `contador-palabras ${estadoClase}`;
      indicador.innerHTML = `
        <span><strong>${cantidad}</strong> palabras</span>
        <span>Recomendado: 300 a 800 palabras</span>
      `;

      if (mostrandoVistaPrevia) {
        contenedorVistaPrevia.innerHTML = ui.limpiar(util.formatoBasico(textarea.value));
      }
    }

    textarea.addEventListener('input', actualizarContador);
    actualizarContador();

    btnVistaPrevia.addEventListener('click', () => {
      mostrandoVistaPrevia = !mostrandoVistaPrevia;
      if (mostrandoVistaPrevia) {
        contenedorVistaPrevia.innerHTML = ui.limpiar(util.formatoBasico(textarea.value));
        contenedorVistaPrevia.style.display = 'block';
        btnVistaPrevia.textContent = 'Ocultar vista previa';
      } else {
        contenedorVistaPrevia.style.display = 'none';
        btnVistaPrevia.textContent = '👁️ Vista previa con formato';
      }
    });
  }

  // =================== GUARDAR FICHA ===================

  async function guardarFicha() {
    const inputTitulo = document.getElementById('inputTitulo');
    const inputResumen = document.getElementById('inputResumen');
    const inputPalabrasClave = document.getElementById('inputPalabrasClave');
    const selectDificultad = document.getElementById('selectDificultad');
    const selectEstado = document.getElementById('selectEstado');
    const inputFuentes = document.getElementById('inputFuentes');

    const titulo = inputTitulo.value.trim();
    if (!titulo) {
      ui.aviso('El título del tema es obligatorio', 'advertencia');
      inputTitulo.focus();
      return;
    }

    const palabrasClave = inputPalabrasClave.value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const cambiosTema = {
      unidadId: tema.unidadId,
      titulo,
      resumen: inputResumen.value,
      objetivos: objetivos.map((o) => o.trim()).filter(Boolean),
      ejemplos: ejemplos.map((e) => e.trim()).filter(Boolean),
      erroresFrecuentes: erroresFrecuentes.map((e) => e.trim()).filter(Boolean),
      preguntasGuia: preguntasGuia.map((p) => p.trim()).filter(Boolean),
      recursos: recursos.filter((r) => r.titulo.trim() || r.url.trim()),
      palabrasClave,
      dificultad: parseInt(selectDificultad.value, 10) || 1,
      fuentes: inputFuentes.value.trim(),
      estado: selectEstado.value
    };

    try {
      ui.aviso('Guardando ficha del tema...', 'info');
      const actualizado = await api.actualizar('temas', temaId, cambiosTema);
      tema = actualizado;
      hayCambiosSinGuardar = false;
      ui.aviso('Ficha del tema guardada con éxito', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar el tema', 'error');
    }
  }

  // =================== GESTIÓN DEL GLOSARIO ===================

  function montarGlosario() {
    renderizarMetricasGlosario();
    renderizarTablaGlosario();

    document.getElementById('btnNuevoTermino').addEventListener('click', () => {
      abrirModalTermino();
    });
  }

  function contarTerminosSeisLetras() {
    return terminosGlosario.filter((g) => {
      const norm = util.normalizar(g.termino || '');
      return norm.length === 6 && !/\s/.test(norm);
    }).length;
  }

  function renderizarMetricasGlosario() {
    const contenedor = document.getElementById('metricasGlosario');
    if (!contenedor) return;

    const total = terminosGlosario.length;
    const de6Letras = contarTerminosSeisLetras();
    const esApto = total >= 12 && de6Letras >= 3;

    contenedor.innerHTML = `
      <div class="glosario-metrica-item">
        <span class="chip">Total términos: <strong>${total}</strong></span>
      </div>
      <div class="glosario-metrica-item">
        <span class="chip">De 6 letras: <strong>${de6Letras}</strong></span>
      </div>
      <div class="glosario-metrica-item" style="margin-left: auto;">
        ${
          esApto
            ? `<span class="insignia insignia--exito" title="Cumple con el mínimo de 12 términos y 3 de seis letras">✓ Apto para juegos</span>`
            : `<span class="insignia insignia--advertencia" title="Se requieren al menos 12 términos y 3 de seis letras para habilitar juegos">⚠️ Pendiente para juegos (${total}/12 términos, ${de6Letras}/3 de 6 letras)</span>`
        }
      </div>
    `;
  }

  function renderizarTablaGlosario() {
    const tbody = document.getElementById('cuerpoTablaGlosario');
    if (!tbody) return;

    if (terminosGlosario.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: var(--espacio-l); color: var(--color-texto-suave);">
            No hay términos en el glosario para este tema. Haz clic en <strong>+ Agregar Término</strong>.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = terminosGlosario.map((g) => {
      const norm = util.normalizar(g.termino || '');
      const esSeis = norm.length === 6 && !/\s/.test(norm);

      return `
        <tr>
          <td>
            <strong>${ui.escapar(g.termino)}</strong>
            ${esSeis ? `<span class="insignia insignia--primario" style="margin-left: var(--espacio-xs); font-size: 10px;">6 letras</span>` : ''}
          </td>
          <td>${ui.escapar(g.definicion || '-')}</td>
          <td>${ui.escapar(g.pista || '-')}</td>
          <td>${ui.escapar(g.retroalimentacion || '-')}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-termino" data-id="${g.id}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-termino" data-id="${g.id}" data-termino="${ui.escapar(g.termino)}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-editar-termino').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = terminosGlosario.find((t) => t.id === id);
        if (item) abrirModalTermino(item);
      });
    });

    tbody.querySelectorAll('.btn-eliminar-termino').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const termino = btn.getAttribute('data-termino');

        const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar el término "${termino}" del glosario?`);
        if (!confirmado) return;

        try {
          await api.eliminar('glosario', id);
          terminosGlosario = terminosGlosario.filter((t) => t.id !== id);
          ui.aviso('Término eliminado del glosario', 'exito');
          renderizarMetricasGlosario();
          renderizarTablaGlosario();
        } catch (err) {
          ui.aviso(err.message || 'Error al eliminar término', 'error');
        }
      });
    });
  }

  async function abrirModalTermino(item = null) {
    const esEdicion = Boolean(item);

    const div = document.createElement('div');
    div.className = 'pila';

    div.innerHTML = `
      <div class="campo">
        <label for="inputTermino">Término (de preferencia una sola palabra)</label>
        <input type="text" id="inputTermino" value="${ui.escapar(item?.termino || '')}" placeholder="Ej. INGRESO" required>
        <span class="campo__error" id="errorTermino"></span>
      </div>

      <div class="campo">
        <label for="inputDefinicion">Definición (máximo 25 palabras)</label>
        <textarea id="inputDefinicion" rows="3" placeholder="Definición precisa del término...">${ui.escapar(item?.definicion || '')}</textarea>
        <span class="contador-palabras" id="contadorDefinicion">0 / 25 palabras</span>
        <span class="campo__error" id="errorDefinicion"></span>
      </div>

      <div class="campo">
        <label for="inputPista">Pista (máximo 10 palabras)</label>
        <input type="text" id="inputPista" value="${ui.escapar(item?.pista || '')}" placeholder="Pista orientadora para juegos y preguntas">
        <span class="contador-palabras" id="contadorPista">0 / 10 palabras</span>
        <span class="campo__error" id="errorPista"></span>
      </div>

      <div class="campo">
        <label for="inputRetro">Retroalimentación Formativa</label>
        <textarea id="inputRetro" rows="2" placeholder="Explicación tras responder (ej. Correcto: el ingreso proviene de...)">${ui.escapar(item?.retroalimentacion || '')}</textarea>
      </div>
    `;

    const inputDef = div.querySelector('#inputDefinicion');
    const contadorDef = div.querySelector('#contadorDefinicion');
    const inputPista = div.querySelector('#inputPista');
    const contadorPista = div.querySelector('#contadorPista');

    function actualizarContadoresModal() {
      const palDef = contarPalabras(inputDef.value);
      contadorDef.textContent = `${palDef} / 25 palabras`;
      contadorDef.style.color = palDef > 25 ? 'var(--color-error)' : 'var(--color-texto-suave)';

      const palPista = contarPalabras(inputPista.value);
      contadorPista.textContent = `${palPista} / 10 palabras`;
      contadorPista.style.color = palPista > 10 ? 'var(--color-error)' : 'var(--color-texto-suave)';
    }

    inputDef.addEventListener('input', actualizarContadoresModal);
    inputPista.addEventListener('input', actualizarContadoresModal);
    actualizarContadoresModal();

    await ui.modal({
      titulo: esEdicion ? 'Editar Término de Glosario' : 'Nuevo Término de Glosario',
      contenido: div,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        {
          texto: esEdicion ? 'Actualizar' : 'Guardar',
          clase: 'btn--primario',
          accion: async (cerrar) => {
            const inputTermino = div.querySelector('#inputTermino');
            const inputRetro = div.querySelector('#inputRetro');

            const errorTermino = div.querySelector('#errorTermino');
            const errorDef = div.querySelector('#errorDefinicion');
            const errorPista = div.querySelector('#errorPista');

            const termino = inputTermino.value.trim().toUpperCase();
            const definicion = inputDef.value.trim();
            const pista = inputPista.value.trim();
            const retroalimentacion = inputRetro.value.trim();

            let valido = true;

            if (!termino) {
              errorTermino.textContent = 'El término es obligatorio.';
              valido = false;
            } else {
              errorTermino.textContent = '';
            }

            const palabrasDef = contarPalabras(definicion);
            if (!definicion) {
              errorDef.textContent = 'La definición es obligatoria.';
              valido = false;
            } else if (palabrasDef > 25) {
              errorDef.textContent = `La definición excede el límite de 25 palabras (${palabrasDef} palabras).`;
              valido = false;
            } else {
              errorDef.textContent = '';
            }

            const palabrasPista = contarPalabras(pista);
            if (!pista) {
              errorPista.textContent = 'La pista es obligatoria.';
              valido = false;
            } else if (palabrasPista > 10) {
              errorPista.textContent = `La pista excede el límite de 10 palabras (${palabrasPista} palabras).`;
              valido = false;
            } else {
              errorPista.textContent = '';
            }

            if (!valido) return false;

            const datosTermino = {
              temaId,
              termino,
              definicion,
              pista,
              retroalimentacion,
              origen: 'docente',
              estado: 'aprobado'
            };

            try {
              if (esEdicion) {
                const actualizado = await api.actualizar('glosario', item.id, datosTermino);
                const idx = terminosGlosario.findIndex((t) => t.id === item.id);
                if (idx !== -1) terminosGlosario[idx] = actualizado;
                ui.aviso('Término actualizado con éxito', 'exito');
              } else {
                const nuevo = await api.crear('glosario', datosTermino);
                terminosGlosario.push(nuevo);
                ui.aviso('Término agregado al glosario', 'exito');
              }

              cerrar(true);
              renderizarMetricasGlosario();
              renderizarTablaGlosario();
            } catch (err) {
              ui.aviso(err.message || 'Error al guardar término', 'error');
              return false;
            }
          }
        }
      ]
    });
  }
}

