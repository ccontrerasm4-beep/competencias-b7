import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import { evaluarInactividad } from '../alertas.js';

const router = Router();

/**
 * Calcula el promedio (media de puntaje / maximo × 10 con un decimal),
 * ignorando intentos de 'tema-revisado' o con maximo <= 0.
 * @param {Array} listaIntentos
 * @returns {number}
 */
function calcularPromedio(listaIntentos = []) {
  const validos = listaIntentos.filter(
    (i) => i.actividad !== 'tema-revisado' && Number(i.maximo) > 0
  );
  if (validos.length === 0) return 0;
  const suma = validos.reduce(
    (acc, i) => acc + (Number(i.puntaje) / Number(i.maximo)) * 10,
    0
  );
  return Math.round((suma / validos.length) * 10) / 10;
}

/**
 * Obtiene la semana en formato ISO 'YYYY-Www' para agrupar intentos.
 * @param {string} fechaIso
 * @returns {string|null}
 */
function obtenerSemanaISO(fechaIso) {
  if (!fechaIso) return null;
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return null;

  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7; // Lunes = 0, Domingo = 6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  const padWeek = String(weekNumber).padStart(2, '0');
  return `${year}-W${padWeek}`;
}

// GET /api/resumen/estudiante y /api/resumen/estudiante/:id
router.get('/resumen/estudiante/:id?', exigirRol(), async (req, res, next) => {
  try {
    let estudianteId = req.params.id;
    if (!estudianteId || estudianteId === 'yo') {
      estudianteId = req.usuario.id;
    }

    // Leer colecciones y bitácora exactamente una sola vez
    const [
      usuarios,
      distributivo,
      unidades,
      temas,
      progresoTemas,
      logros,
      intentos,
      lineasBitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('logros'),
      almacen.leer('intentos'),
      almacen.leerLineas('bitacora')
    ]);

    // Verificar que el estudiante exista
    const estudiante = usuarios.find((u) => u.id === estudianteId);
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Control de acceso: el propio estudiante, un docente de sus grupos o el admin
    let tieneAcceso = false;
    if (req.usuario.rol === 'admin' || req.usuario.id === estudianteId) {
      tieneAcceso = true;
    } else if (req.usuario.rol === 'docente') {
      const gruposDocente = distributivo.filter((g) => g.docenteId === req.usuario.id);
      tieneAcceso = gruposDocente.some(
        (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
      );
    }

    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No tienes acceso al resumen de este estudiante' });
    }

    // 1. Puntos y nivelQuizMax desde logros
    const logro = logros.find((l) => l.usuarioId === estudianteId) || {};
    const puntos = Number(logro.puntos || 0);

    const nivelesQuiz = Object.values(logro.nivelQuiz || {})
      .map(Number)
      .filter((n) => !isNaN(n));
    const nivelQuizMax = nivelesQuiz.length > 0 ? Math.max(...nivelesQuiz) : 0;

    // 2. Temas de las asignaturas del estudiante
    const misGrupos = distributivo.filter(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
    );
    const idsAsignaturas = new Set(misGrupos.map((g) => g.asignaturaId).filter(Boolean));

    const unidadesVisibles =
      idsAsignaturas.size > 0
        ? unidades.filter((u) => idsAsignaturas.has(u.asignaturaId) && u.visible !== false)
        : unidades.filter((u) => u.visible !== false);

    const idsUnidadesVisibles = new Set(unidadesVisibles.map((u) => u.id));
    const temasPublicados = temas.filter(
      (t) => idsUnidadesVisibles.has(t.unidadId) && t.estado === 'publicado'
    );
    const temasMap = new Map(temas.map((t) => [t.id, t]));

    // 3. Progreso de temas revisados y pendientes
    const temasRevisadosSet = new Set(
      progresoTemas.filter((p) => p.usuarioId === estudianteId).map((p) => p.temaId)
    );
    const cantRevisados = temasPublicados.filter((t) => temasRevisadosSet.has(t.id)).length;
    const pctTemas =
      temasPublicados.length > 0 ? Math.round((cantRevisados / temasPublicados.length) * 100) : 0;

    const pendientes = temasPublicados
      .filter((t) => !temasRevisadosSet.has(t.id))
      .map((t) => ({ temaId: t.id, titulo: t.titulo }));

    // 4. Intentos del estudiante y cálculo de promedio
    const misIntentos = intentos.filter((i) => i.usuarioId === estudianteId);
    const promedio = calcularPromedio(misIntentos);

    // 5. porActividad: [{ actividad, promedio, intentos }]
    const actividadesMap = new Map();
    for (const i of misIntentos) {
      if (i.actividad === 'tema-revisado') continue;
      if (!actividadesMap.has(i.actividad)) {
        actividadesMap.set(i.actividad, []);
      }
      actividadesMap.get(i.actividad).push(i);
    }
    const porActividad = Array.from(actividadesMap.entries()).map(([actividad, lista]) => ({
      actividad,
      promedio: calcularPromedio(lista),
      intentos: lista.length
    }));

    // 6. porTema: [{ temaId, titulo, promedio, intentos }]
    const temasIntentosMap = new Map();
    for (const i of misIntentos) {
      if (i.actividad === 'tema-revisado' || !i.temaId) continue;
      if (!temasIntentosMap.has(i.temaId)) {
        temasIntentosMap.set(i.temaId, []);
      }
      temasIntentosMap.get(i.temaId).push(i);
    }
    const porTema = Array.from(temasIntentosMap.entries()).map(([temaId, lista]) => {
      const t = temasMap.get(temaId);
      return {
        temaId,
        titulo: t ? t.titulo : 'Tema desconocido',
        promedio: calcularPromedio(lista),
        intentos: lista.length
      };
    });

    // 7. evolucion: [{ semana, promedio }] (últimas 8 semanas con datos)
    const semanasMap = new Map();
    for (const i of misIntentos) {
      if (i.actividad === 'tema-revisado' || Number(i.maximo) <= 0 || !i.fecha) continue;
      const sem = obtenerSemanaISO(i.fecha);
      if (!sem) continue;
      if (!semanasMap.has(sem)) {
        semanasMap.set(sem, []);
      }
      semanasMap.get(sem).push(i);
    }
    const semanasOrdenadas = Array.from(semanasMap.keys()).sort();
    const ultimas8Semanas = semanasOrdenadas.slice(-8);
    const evolucion = ultimas8Semanas.map((semana) => ({
      semana,
      promedio: calcularPromedio(semanasMap.get(semana))
    }));

    // 8. ultimaConexion
    let ultimaConexion = null;
    const eventosUsuario = lineasBitacora.filter(
      (b) => b.usuarioId === estudianteId && b.fecha
    );
    if (eventosUsuario.length > 0) {
      ultimaConexion = eventosUsuario[eventosUsuario.length - 1].fecha;
    } else if (misIntentos.length > 0) {
      const fechasIntentos = misIntentos.map((i) => i.fecha).filter(Boolean).sort();
      if (fechasIntentos.length > 0) {
        ultimaConexion = fechasIntentos[fechasIntentos.length - 1];
      }
    }

    // 9. tiempoMin
    const segundosTotales = misIntentos.reduce(
      (acc, i) => acc + (Number(i.duracionSeg) || 0),
      0
    );
    const tiempoMin = Math.round(segundosTotales / 60);

    // 10. ultimosIntentos (20 más recientes)
    const ultimosIntentos = [...misIntentos]
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
      .slice(0, 20);

    res.json({
      puntos,
      nivelQuizMax,
      pctTemas,
      promedio,
      porActividad,
      porTema,
      evolucion,
      pendientes,
      ultimaConexion,
      tiempoMin,
      ultimosIntentos
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/resumen/grupo/:grupoId
router.get('/resumen/grupo/:grupoId', exigirRol(), async (req, res, next) => {
  try {
    const { grupoId } = req.params;

    // Evaluar inactividad antes de calcular
    await evaluarInactividad(grupoId);

    // Leer colecciones y bitácora exactamente una sola vez
    const [
      usuarios,
      distributivo,
      unidades,
      temas,
      progresoTemas,
      intentos,
      alertas,
      lineasBitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('intentos'),
      almacen.leer('alertas'),
      almacen.leerLineas('bitacora')
    ]);

    // Verificar que el grupo exista
    const grupo = distributivo.find((g) => g.id === grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // Control de acceso: docente del grupo o admin
    if (req.usuario.rol !== 'admin' && grupo.docenteId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes acceso a este grupo' });
    }

    // Temas publicados de la asignatura del grupo
    const unidadesGrupo = unidades.filter(
      (u) => u.asignaturaId === grupo.asignaturaId && u.visible !== false
    );
    const idsUnidadesGrupo = new Set(unidadesGrupo.map((u) => u.id));
    const temasGrupo = temas.filter(
      (t) => idsUnidadesGrupo.has(t.unidadId) && t.estado === 'publicado'
    );
    temasGrupo.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const idsTemasGrupo = new Set(temasGrupo.map((t) => t.id));

    const usuariosMap = new Map(usuarios.map((u) => [u.id, u]));
    const idsEstudiantes = Array.isArray(grupo.estudiantes) ? grupo.estudiantes : [];
    const idsEstudiantesSet = new Set(idsEstudiantes);

    // Intentos de estudiantes de este grupo
    const intentosGrupo = intentos.filter((i) => idsEstudiantesSet.has(i.usuarioId));

    // Estudiantes con sus estadísticas en el grupo
    const estudiantes = idsEstudiantes.map((id) => {
      const usr = usuariosMap.get(id);
      const nombre = usr?.nombre || 'Estudiante';
      const apellido = usr?.apellido || id;

      // Intentos del estudiante (asociados a la asignatura o temas del grupo)
      const intentosEst = intentosGrupo.filter(
        (i) => i.usuarioId === id && (!i.temaId || idsTemasGrupo.has(i.temaId))
      );
      const promedio = calcularPromedio(intentosEst);
      const actividades = intentosEst.filter((i) => i.actividad !== 'tema-revisado').length;

      // Porcentaje de temas revisados de este grupo
      const revisadosEst = new Set(
        progresoTemas.filter((p) => p.usuarioId === id).map((p) => p.temaId)
      );
      const cantRevisados = temasGrupo.filter((t) => revisadosEst.has(t.id)).length;
      const pctTemas =
        temasGrupo.length > 0 ? Math.round((cantRevisados / temasGrupo.length) * 100) : 0;

      // Última conexión
      let ultimaConexion = null;
      const eventosEst = lineasBitacora.filter((b) => b.usuarioId === id && b.fecha);
      if (eventosEst.length > 0) {
        ultimaConexion = eventosEst[eventosEst.length - 1].fecha;
      } else if (intentosEst.length > 0) {
        const fechas = intentosEst.map((i) => i.fecha).filter(Boolean).sort();
        if (fechas.length > 0) {
          ultimaConexion = fechas[fechas.length - 1];
        }
      }

      // Alertas activas en este grupo
      const alertasActivas = alertas.filter(
        (a) => a.estudianteId === id && (a.grupoId === grupo.id || !a.grupoId) && a.estado === 'activa'
      ).length;

      return {
        id,
        nombre,
        apellido,
        promedio,
        actividades,
        pctTemas,
        ultimaConexion,
        alertasActivas
      };
    });

    // porTema: [{ temaId, titulo, promedio, intentos }]
    let porTema = [];
    if (temasGrupo.length > 0) {
      porTema = temasGrupo.map((t) => {
        const intentosTema = intentosGrupo.filter(
          (i) => i.temaId === t.id && i.actividad !== 'tema-revisado'
        );
        return {
          temaId: t.id,
          titulo: t.titulo,
          promedio: calcularPromedio(intentosTema),
          intentos: intentosTema.length
        };
      });
    } else {
      // Fallback si no hay temas publicados en el grupo
      const temasMap = new Map(temas.map((t) => [t.id, t]));
      const temasIntentosMap = new Map();
      for (const i of intentosGrupo) {
        if (i.actividad === 'tema-revisado' || !i.temaId) continue;
        if (!temasIntentosMap.has(i.temaId)) {
          temasIntentosMap.set(i.temaId, []);
        }
        temasIntentosMap.get(i.temaId).push(i);
      }
      porTema = Array.from(temasIntentosMap.entries()).map(([temaId, lista]) => {
        const t = temasMap.get(temaId);
        return {
          temaId,
          titulo: t ? t.titulo : 'Tema desconocido',
          promedio: calcularPromedio(lista),
          intentos: lista.length
        };
      });
    }

    res.json({
      grupo,
      estudiantes,
      porTema
    });
  } catch (err) {
    next(err);
  }
});

export default router;

