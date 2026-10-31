import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';

const router = Router();

const NOMBRES_NIVELES = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

/**
 * Normaliza un texto para comparación tolerante a mayúsculas y acentos (conservando la eñe).
 */
function normalizar(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, (m, offset, str) => {
      const anterior = str[offset - 1];
      if (anterior === 'N' || anterior === 'n') return m;
      return '';
    })
    .normalize('NFC')
    .toLowerCase();
}

/**
 * Baraja aleatoriamente los elementos de un arreglo (Fisher-Yates).
 */
function barajar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Verifica si el usuario estudiante tiene acceso al tema a través de sus asignaturas.
 */
async function verificarAccesoTema(usuario, temaId) {
  if (!usuario || usuario.rol !== 'estudiante' || !temaId) return false;
  const asig = await acceso.asignaturaDeTema(temaId);
  if (!asig) return false;
  const misAsignaturas = await acceso.asignaturasDe(usuario);
  return misAsignaturas.some((a) => a.id === asig.id);
}

// 1. GET /api/quiz/estado?temaId=
router.get('/quiz/estado', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { temaId } = req.query;
    if (!temaId) {
      return res.status(400).json({ error: 'temaId es requerido' });
    }

    const tieneAcceso = await verificarAccesoTema(req.usuario, temaId);
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No tienes acceso a este tema' });
    }

    const [todosLogros, todosIntentos] = await Promise.all([
      almacen.leer('logros'),
      almacen.leer('intentos')
    ]);

    const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
    const nivelAprobadoMax = Number(logro?.nivelQuiz?.[temaId] || 0);

    const intentosTema = todosIntentos.filter(
      (i) => i.usuarioId === req.usuario.id && i.actividad === 'quiz' && i.temaId === temaId
    );

    const niveles = [];
    for (let n = 1; n <= 5; n++) {
      let estado = 'bloqueado';
      if (n <= nivelAprobadoMax) {
        estado = 'aprobado';
      } else if (n === 1 || n - 1 <= nivelAprobadoMax) {
        estado = 'disponible';
      }

      const intentosNivel = intentosTema.filter((i) => Number(i.nivel) === n);
      let mejorPorcentaje = 0;
      if (intentosNivel.length > 0) {
        mejorPorcentaje = Math.max(
          ...intentosNivel.map((i) => {
            const p = Number(i.puntaje) || 0;
            const m = Number(i.maximo) || 1;
            return Math.round((p / m) * 100);
          })
        );
      }

      niveles.push({
        nivel: n,
        nombre: NOMBRES_NIVELES[n],
        estado,
        mejorPorcentaje
      });
    }

    res.json({ niveles });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/quiz/iniciar { temaId, nivel }
router.post('/quiz/iniciar', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { temaId, nivel: nivelRaw } = req.body || {};
    const nivel = Number(nivelRaw);

    if (!temaId || !nivel || nivel < 1 || nivel > 5) {
      return res.status(400).json({ error: 'temaId y nivel válido (1-5) son requeridos' });
    }

    const tieneAcceso = await verificarAccesoTema(req.usuario, temaId);
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No tienes acceso a este tema' });
    }

    // Verificar si el nivel está disponible
    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
    const nivelAprobadoMax = Number(logro?.nivelQuiz?.[temaId] || 0);

    const disponible = nivel === 1 || nivel - 1 <= nivelAprobadoMax || nivel <= nivelAprobadoMax;
    if (!disponible) {
      return res.status(400).json({ error: 'El nivel solicitado no está disponible' });
    }

    const [reglas, todasPreguntas, todasSesiones] = await Promise.all([
      almacen.leerConfig('reglas-gamificacion'),
      almacen.leer('preguntas'),
      almacen.leer('quiz-sesiones')
    ]);

    const preguntasPorNivel = Number(reglas?.quiz?.preguntasPorNivel) || 10;
    const aprobadas = todasPreguntas.filter(
      (p) => p.temaId === temaId && Number(p.nivel) === nivel && p.estado === 'aprobado'
    );

    if (aprobadas.length === 0) {
      return res.status(400).json({ error: 'No hay preguntas aprobadas disponibles para este nivel' });
    }

    // Identificar preguntas vistas según las quiz-sesiones del estudiante
    const misSesiones = todasSesiones.filter((s) => s.usuarioId === req.usuario.id);
    const ultimaVezMap = new Map();

    for (const ses of misSesiones) {
      const fechaMs = new Date(ses.inicio || ses.fecha || 0).getTime();
      if (Array.isArray(ses.preguntasIds)) {
        for (const pid of ses.preguntasIds) {
          const actual = ultimaVezMap.get(pid) || 0;
          if (fechaMs > actual) {
            ultimaVezMap.set(pid, fechaMs);
          }
        }
      }
    }

    const noVistas = aprobadas.filter((p) => !ultimaVezMap.has(p.id));
    const vistas = aprobadas.filter((p) => ultimaVezMap.has(p.id));

    let seleccionadas = barajar(noVistas).slice(0, preguntasPorNivel);
    let faltantes = preguntasPorNivel - seleccionadas.length;

    if (faltantes > 0 && vistas.length > 0) {
      // Completar con las vistas hace más tiempo (menor timestamp)
      vistas.sort((a, b) => (ultimaVezMap.get(a.id) || 0) - (ultimaVezMap.get(b.id) || 0));
      const complementarias = vistas.slice(0, faltantes);
      seleccionadas = seleccionadas.concat(complementarias);

      // Notificar al docente del grupo (máximo una vez al día por tema y nivel)
      try {
        const grupos = await acceso.gruposDe(req.usuario);
        const asig = await acceso.asignaturaDeTema(temaId);
        const miGrupo = grupos.find((g) => g.asignaturaId === asig?.id);
        const docenteId = miGrupo?.docenteId;

        if (docenteId) {
          const notificaciones = await almacen.leer('notificaciones');
          const hoy = new Date().toISOString().slice(0, 10);
          const yaNotificado = notificaciones.some(
            (n) =>
              n.usuarioId === docenteId &&
              n.fecha &&
              n.fecha.startsWith(hoy) &&
              n.enlace?.includes(temaId) &&
              n.mensaje?.includes(`Nivel ${nivel}`)
          );

          if (!yaNotificado) {
            const temas = await almacen.leer('temas');
            const tema = temas.find((t) => t.id === temaId);
            await notificar(docenteId, {
              tipo: 'sistema',
              mensaje: `El banco de preguntas para el tema "${tema?.titulo || temaId}" (Nivel ${nivel}) tiene pocas preguntas disponibles y los estudiantes están repitiendo preguntas.`,
              enlace: `/paginas/banco-preguntas.html?temaId=${temaId}`
            });
          }
        }
      } catch (errNotif) {
        console.warn('[Quiz] Error al notificar al docente:', errNotif.message);
      }
    }

    // Barajar las seleccionadas para presentarlas en orden aleatorio
    seleccionadas = barajar(seleccionadas);

    const nuevaSesion = {
      usuarioId: req.usuario.id,
      temaId,
      nivel,
      preguntasIds: seleccionadas.map((p) => p.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    };

    const sesionCreada = await almacen.agregar('quiz-sesiones', nuevaSesion);

    res.status(201).json({
      sesionId: sesionCreada.id,
      preguntas: seleccionadas.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: p.opciones || []
      }))
    });
  } catch (err) {
    next(err);
  }
});

// 3. POST /api/quiz/responder { sesionId, preguntaId, respuesta }
router.post('/quiz/responder', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { sesionId, preguntaId, respuesta } = req.body || {};

    if (!sesionId || !preguntaId || respuesta === undefined) {
      return res.status(400).json({ error: 'sesionId, preguntaId y respuesta son requeridos' });
    }

    const todasSesiones = await almacen.leer('quiz-sesiones');
    const sesion = todasSesiones.find((s) => s.id === sesionId);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta sesión' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'La sesión de quiz ya ha finalizado' });
    }

    if (!Array.isArray(sesion.preguntasIds) || !sesion.preguntasIds.includes(preguntaId)) {
      return res.status(400).json({ error: 'La pregunta no forma parte de esta sesión de quiz' });
    }

    sesion.respuestas = sesion.respuestas || {};
    if (sesion.respuestas[preguntaId] !== undefined) {
      return res.status(400).json({ error: 'Esta pregunta ya ha sido respondida' });
    }

    const todasPreguntas = await almacen.leer('preguntas');
    const pregunta = todasPreguntas.find((p) => p.id === preguntaId);

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada' });
    }

    let correcto = false;
    let correctaTexto = '';

    if (pregunta.tipo === 'opcion') {
      const idxEsperado = Number(pregunta.correcta);
      const idxRecibido = Number(respuesta);
      correcto = idxRecibido === idxEsperado;
      correctaTexto = String(pregunta.opciones?.[idxEsperado] ?? pregunta.correcta);
    } else if (pregunta.tipo === 'vf') {
      const esperadoBool = pregunta.correcta === true || String(pregunta.correcta) === 'true';
      const recibidoBool = respuesta === true || String(respuesta) === 'true';
      correcto = esperadoBool === recibidoBool;
      correctaTexto = esperadoBool ? 'Verdadero' : 'Falso';
    } else if (pregunta.tipo === 'completar') {
      const respNorm = normalizar(String(respuesta || ''));
      const espNorm = normalizar(String(pregunta.correcta || ''));
      correcto = respNorm === espNorm;
      correctaTexto = String(pregunta.correcta);
    }

    sesion.respuestas[preguntaId] = {
      respuesta,
      correcto,
      fecha: new Date().toISOString()
    };

    await almacen.actualizar('quiz-sesiones', sesion.id, {
      respuestas: sesion.respuestas
    });

    res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion || '',
      correcta: correctaTexto
    });
  } catch (err) {
    next(err);
  }
});

// 4. POST /api/quiz/finalizar { sesionId }
router.post('/quiz/finalizar', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { sesionId } = req.body || {};
    if (!sesionId) {
      return res.status(400).json({ error: 'sesionId es requerido' });
    }

    const todasSesiones = await almacen.leer('quiz-sesiones');
    const sesion = todasSesiones.find((s) => s.id === sesionId);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta sesión' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'La sesión de quiz ya ha finalizado' });
    }

    const total = Array.isArray(sesion.preguntasIds) ? sesion.preguntasIds.length : 0;
    let aciertos = 0;
    const falladasIds = [];

    for (const pid of sesion.preguntasIds || []) {
      const r = sesion.respuestas?.[pid];
      if (r && r.correcto) {
        aciertos++;
      } else {
        falladasIds.push(pid);
      }
    }

    const errores = total - aciertos;
    const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const porcentajeMin = Number(reglas?.quiz?.porcentajeAprobacion) || 70;
    const aprobado = porcentaje >= porcentajeMin;

    const inicioMs = sesion.inicio ? new Date(sesion.inicio).getTime() : Date.now();
    const duracionSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));

    // Si aprueba, primero actualiza logros.nivelQuiz[temaId] al máximo
    if (aprobado) {
      const todosLogros = await almacen.leer('logros');
      const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
      const nivelSesion = Number(sesion.nivel);

      if (logro) {
        const nivelQuiz = { ...(logro.nivelQuiz || {}) };
        nivelQuiz[sesion.temaId] = Math.max(Number(nivelQuiz[sesion.temaId] || 0), nivelSesion);
        await almacen.actualizar('logros', logro.id, { nivelQuiz });
      } else {
        const nuevoLogro = {
          usuarioId: req.usuario.id,
          puntos: 0,
          insignias: [],
          nivelQuiz: { [sesion.temaId]: nivelSesion }
        };
        await almacen.agregar('logros', nuevoLogro);
      }
    }

    // En todos los casos llama a procesarIntento
    const resultadoIntento = await procesarIntento(req.usuario, {
      actividad: 'quiz',
      temaId: sesion.temaId,
      nivel: Number(sesion.nivel),
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: { aprobado }
    });

    // Marcar sesión como finalizada
    await almacen.actualizar('quiz-sesiones', sesion.id, {
      finalizada: true,
      fin: new Date().toISOString()
    });

    // Obtener retroalimentaciones de las preguntas falladas
    const todasPreguntas = await almacen.leer('preguntas');
    const repasar = falladasIds
      .map((pid) => {
        const p = todasPreguntas.find((item) => item.id === pid);
        return p?.retroalimentacion || '';
      })
      .filter(Boolean);

    res.json({
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: resultadoIntento.puntosGanados,
      insigniasNuevas: resultadoIntento.insigniasNuevas
    });
  } catch (err) {
    next(err);
  }
});

export default router;

