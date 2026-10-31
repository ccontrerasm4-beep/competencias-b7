import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const NIVELES_BLOOM = {
  1: '1 Recordar',
  2: '2 Comprender',
  3: '3 Aplicar',
  4: '4 Analizar',
  5: '5 Evaluar'
};

/**
 * Preparador para la tarea de IA generar-preguntas.
 * Recibe { temaId, nivel, cantidad }, valida permisos y construye los datos para el prompt.
 * @param {Object} cuerpo { temaId, nivel, cantidad }
 * @param {Object} usuario Usuario autenticado en sesión
 * @returns {Promise<Object>} Datos para la plantilla del prompt
 */
export default async function (cuerpo = {}, usuario) {
  if (!usuario) {
    const err = new Error('Sesión requerida');
    err.estado = 401;
    throw err;
  }

  const { temaId } = cuerpo;
  const nivelNum = Math.min(5, Math.max(1, parseInt(cuerpo.nivel, 10) || 1));
  const cantidadNum = Math.min(15, Math.max(5, parseInt(cuerpo.cantidad, 10) || 5));

  if (!temaId) {
    const err = new Error('temaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  // 1. Obtener tema y asignatura asociada
  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema) {
    const err = new Error('Tema no encontrado');
    err.estado = 404;
    throw err;
  }

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error('Asignatura del tema no encontrada');
    err.estado = 404;
    throw err;
  }

  // 2. Verificar que el usuario puede editar el tema
  const puede = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
  if (!puede) {
    const err = new Error('No tienes permiso para editar este tema');
    err.estado = 403;
    throw err;
  }

  // 3. Preparar contenido del tema
  const partesContenido = [];
  if (tema.resumen) partesContenido.push(tema.resumen);
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    partesContenido.push('Objetivos de aprendizaje:\n' + tema.objetivos.map((o) => `- ${o}`).join('\n'));
  }
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    partesContenido.push('Ejemplos conceptuales:\n' + tema.ejemplos.map((e) => `- ${e}`).join('\n'));
  }
  if (Array.isArray(tema.erroresFrecuentes) && tema.erroresFrecuentes.length > 0) {
    partesContenido.push('Errores frecuentes:\n' + tema.erroresFrecuentes.map((e) => `- ${e}`).join('\n'));
  }
  const contenidoTexto = partesContenido.join('\n\n') || tema.titulo;

  // 4. Preparar glosario del tema ("término: definición")
  const glosarioTodos = await almacen.leer('glosario');
  const glosarioTema = glosarioTodos.filter(
    (g) => g.temaId === temaId && (g.estado === 'aprobado' || !g.estado)
  );
  const glosarioTexto =
    glosarioTema.map((g) => `${g.termino}: ${g.definicion}`).join('\n') || 'Sin términos registrados.';

  // 5. Preguntas ya existentes en ese nivel
  const preguntasTodas = await almacen.leer('preguntas');
  const preguntasExistentes = preguntasTodas.filter(
    (p) => p.temaId === temaId && Number(p.nivel) === nivelNum
  );
  const existentesTexto =
    preguntasExistentes.map((p) => `- ${p.enunciado}`).join('\n') || 'Ninguna registrada aún.';

  return {
    asignatura: asignatura.nombre || 'Asignatura',
    nivel: asignatura.nivel || 'Nivel educativo',
    tema: tema.titulo || 'Tema',
    contenido: contenidoTexto,
    glosario: glosarioTexto,
    nivelBloom: NIVELES_BLOOM[nivelNum] || `${nivelNum} Recordar`,
    cantidad: cantidadNum,
    existentes: existentesTexto
  };
}

