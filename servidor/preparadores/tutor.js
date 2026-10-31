import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * Preparador para la tarea de IA "tutor" (Tutor socrático de asignatura).
 * Valida acceso a la asignatura, compila el contexto curricular exclusivo
 * y prepara las variables para el prompt pedagógico.
 */
export default async function prepararTutor(cuerpo, usuario) {
  if (!usuario) {
    const err = new Error('Sesión requerida para consultar al tutor');
    err.estado = 401;
    throw err;
  }

  const { asignaturaId, temaId, mensaje, pregunta, historial } = cuerpo || {};
  const textoMensaje = String(mensaje || pregunta || '').trim();

  if (!textoMensaje) {
    const err = new Error('El mensaje del estudiante es obligatorio');
    err.estado = 400;
    throw err;
  }

  // 1. Identificar asignatura
  let asignatura = null;
  const todasAsignaturas = await almacen.leer('asignaturas');

  if (asignaturaId) {
    asignatura = todasAsignaturas.find((a) => a.id === asignaturaId);
  } else if (temaId) {
    asignatura = await acceso.asignaturaDeTema(temaId);
  }

  if (!asignatura) {
    const err = new Error('Asignatura no encontrada');
    err.estado = 404;
    throw err;
  }

  // 2. Verificar permiso de acceso del estudiante
  if (usuario.rol === 'estudiante') {
    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const tieneAcceso = misAsignaturas.some((a) => a.id === asignatura.id);
    if (!tieneAcceso) {
      const err = new Error('No tienes acceso a los contenidos de esta asignatura');
      err.estado = 403;
      throw err;
    }
  }

  // 3. Cargar unidades y temas de la asignatura para construir el contexto curricular
  const [todasUnidades, todosTemas, glosario] = await Promise.all([
    almacen.leer('unidades'),
    almacen.leer('temas'),
    almacen.leer('glosario').catch(() => [])
  ]);

  const unidades = todasUnidades
    .filter((u) => u.asignaturaId === asignatura.id && u.visible !== false)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const idsUnidades = new Set(unidades.map((u) => u.id));
  const temas = todosTemas
    .filter((t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado')
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  let temaNombre = '';
  let contenidoCurricular = '';

  if (temaId) {
    const temaSeleccionado = temas.find((t) => t.id === temaId);
    if (temaSeleccionado) {
      temaNombre = temaSeleccionado.titulo;
      const partes = [
        `Resumen del tema: ${temaSeleccionado.resumen || ''}`,
        temaSeleccionado.objetivos?.length ? `Objetivos de aprendizaje:\n- ${temaSeleccionado.objetivos.join('\n- ')}` : '',
        temaSeleccionado.ejemplos?.length ? `Ejemplos de aplicación:\n${temaSeleccionado.ejemplos.join('\n')}` : '',
        temaSeleccionado.erroresFrecuentes?.length ? `Errores conceptuales frecuentes a evitar:\n- ${temaSeleccionado.erroresFrecuentes.join('\n- ')}` : '',
        temaSeleccionado.preguntasGuia?.length ? `Preguntas guía de razonamiento:\n- ${temaSeleccionado.preguntasGuia.join('\n- ')}` : ''
      ];

      // Términos del glosario asociados al tema
      const terminosTema = (glosario || []).filter((g) => g.temaId === temaId);
      if (terminosTema.length > 0) {
        partes.push(`Glosario clave del tema:\n${terminosTema.map((g) => `- ${g.termino}: ${g.definicion}`).join('\n')}`);
      }

      contenidoCurricular = partes.filter(Boolean).join('\n\n');
    }
  }

  // Si no se eligió un tema específico o para completar el marco general de la asignatura
  if (!contenidoCurricular) {
    temaNombre = `Ejes temáticos de ${asignatura.nombre}`;
    contenidoCurricular = unidades
      .map((u) => {
        const temasUnidad = temas.filter((t) => t.unidadId === u.id);
        const listaTemas = temasUnidad
          .map((t) => `  * Tema: ${t.titulo}. Conceptos: ${t.resumen || ''}`)
          .join('\n');
        return `Unidad ${u.orden || ''}: "${u.titulo}"\n${listaTemas || '  (Sin temas)'}`;
      })
      .join('\n\n');
  }

  // 4. Formatear historial de conversación previa
  let historialTexto = '';
  if (Array.isArray(historial)) {
    historialTexto = historial
      .slice(-8)
      .map((m) => {
        const rol = m.remitente === 'estudiante' ? 'Estudiante' : 'Tutor Socrático';
        return `${rol}: ${m.texto}`;
      })
      .join('\n');
  } else if (typeof historial === 'string') {
    historialTexto = historial.trim();
  }

  if (!historialTexto) {
    historialTexto = '(Inicio de la sesión socrática con el estudiante)';
  }

  // 5. Registrar consulta en la colección consultas-tutor
  try {
    const diaHoy = new Date().toISOString().slice(0, 10);
    const todasConsultas = await almacen.leer('consultas-tutor');
    const registroExistente = todasConsultas.find(
      (c) =>
        c.usuarioId === usuario.id &&
        c.dia === diaHoy &&
        (c.asignaturaId === asignatura.id || (temaId && c.temaId === temaId))
    );

    if (registroExistente) {
      await almacen.actualizar('consultas-tutor', registroExistente.id, {
        mensajes: (registroExistente.mensajes || 0) + 1
      });
    } else {
      await almacen.agregar('consultas-tutor', {
        usuarioId: usuario.id,
        asignaturaId: asignatura.id,
        temaId: temaId || null,
        dia: diaHoy,
        mensajes: 1
      });
    }
  } catch (errRegistro) {
    console.warn('[Tutor] Error al registrar consulta en bitácora:', errRegistro.message);
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'COLEGIO',
    tema: temaNombre,
    contenido: contenidoCurricular,
    historial: historialTexto,
    pregunta: textoMensaje
  };
}

