import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import { notificar } from './notificar.js';

/**
 * Registra una alerta pedagógica sin duplicar alertas activas
 * y notifica al docente correspondiente (y admins si está configurado).
 */
async function crearAlertaSinDuplicado({
  estudianteId,
  docenteId,
  grupoId,
  regla,
  temaId,
  detalle,
  usuario,
  todasAlertas,
  usuarios
}) {
  // Sin duplicados: una alerta activa por estudiante + regla (+ tema si aplica)
  const yaExiste = todasAlertas.some(
    (a) =>
      a.estudianteId === estudianteId &&
      a.regla === regla &&
      a.estado === 'activa' &&
      (temaId ? a.temaId === temaId : true)
  );

  if (yaExiste) return null;

  const nuevaAlerta = {
    estudianteId,
    docenteId: docenteId || null,
    grupoId: grupoId || null,
    regla,
    temaId: temaId || null,
    detalle,
    estado: 'activa'
  };

  const alertaGuardada = await almacen.agregar('alertas', nuevaAlerta);
  todasAlertas.push(alertaGuardada);

  // Al crearla, notificar() al docente del grupo (y a los admin si ajustes.alertasAdmin) con enlace al panel
  try {
    const nombreEstudiante = usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() : 'Estudiante';
    const mensajeDocente = `Alerta pedagógica: ${nombreEstudiante} requiere atención (${regla}). ${detalle}`;
    const enlacePanel = grupoId ? `/paginas/panel-docente.html?grupoId=${grupoId}` : '/paginas/panel-docente.html';

    if (docenteId) {
      await notificar(docenteId, {
        tipo: 'alerta',
        mensaje: mensajeDocente,
        enlace: enlacePanel
      });
    }

    const ajustes = await almacen.leerConfig('ajustes');
    if (ajustes?.alertasAdmin) {
      const admins = (usuarios || []).filter((u) => u.rol === 'admin' && u.activo !== false);
      for (const adm of admins) {
        await notificar(adm.id, {
          tipo: 'alerta',
          mensaje: `[Admin] ${mensajeDocente}`,
          enlace: enlacePanel
        });
      }
    }
  } catch (err) {
    console.warn('Error al notificar alerta pedagógica:', err);
  }

  return alertaGuardada;
}

/**
 * Evalúa las reglas de alertas tras un intento registrado.
 * @param {Object} intento Registro del intento guardado
 * @param {Object} usuario Usuario que realizó el intento
 */
export async function evaluarAlertas(intento, usuario) {
  if (!intento || !usuario || usuario.rol !== 'estudiante') return;

  const reglas = await almacen.leerConfig('reglas-alertas');
  if (!reglas) return;

  const distributivo = await almacen.leer('distributivo');
  const todosIntentos = await almacen.leer('intentos');
  const todasAlertas = await almacen.leer('alertas');
  const usuarios = await almacen.leer('usuarios');

  // Determinar grupo y docente asociados al intento
  let grupoAsociado = null;
  if (intento.temaId) {
    const asig = await acceso.asignaturaDeTema(intento.temaId);
    if (asig) {
      grupoAsociado = distributivo.find(
        (g) => g.asignaturaId === asig.id && Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
      );
    }
  }
  if (!grupoAsociado) {
    grupoAsociado = distributivo.find(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
    );
  }

  const grupoId = grupoAsociado ? grupoAsociado.id : null;
  const docenteId = grupoAsociado ? grupoAsociado.docenteId : null;

  // 1. Regla promedioBajo: promedio de los últimos N intentos del estudiante menor que el umbral, sin "tema-revisado"
  const cfgPromedio = reglas.promedioBajo;
  if (cfgPromedio && cfgPromedio.activa !== false) {
    const N = Number(cfgPromedio.ultimos) || 3;
    const umbral = Number(cfgPromedio.umbral) || 7;

    const intentosValidos = todosIntentos
      .filter((i) => i.usuarioId === usuario.id && i.actividad !== 'tema-revisado' && Number(i.maximo) > 0)
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    if (intentosValidos.length >= N) {
      const ultimosN = intentosValidos.slice(0, N);
      const suma = ultimosN.reduce((acc, i) => acc + (Number(i.puntaje) / Number(i.maximo)) * 10, 0);
      const promedio = Math.round((suma / N) * 10) / 10;

      if (promedio < umbral) {
        await crearAlertaSinDuplicado({
          estudianteId: usuario.id,
          docenteId,
          grupoId,
          regla: 'promedioBajo',
          temaId: intento.temaId || null,
          detalle: `Promedio de ${promedio}/10 en los últimos ${N} intentos evaluados.`,
          usuario,
          todasAlertas,
          usuarios
        });
      }
    }
  }

  // 2. Regla fallosQuiz: N intentos de quiz seguidos no aprobados en el mismo tema y nivel
  const cfgQuiz = reglas.fallosQuiz;
  if (
    cfgQuiz &&
    cfgQuiz.activa !== false &&
    (intento.actividad === 'quiz' || intento.actividad?.includes('quiz')) &&
    intento.temaId &&
    intento.nivel
  ) {
    const N = Number(cfgQuiz.veces) || 3;

    const intentosQuiz = todosIntentos
      .filter(
        (i) =>
          i.usuarioId === usuario.id &&
          (i.actividad === 'quiz' || i.actividad?.includes('quiz')) &&
          i.temaId === intento.temaId &&
          Number(i.nivel) === Number(intento.nivel)
      )
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    if (intentosQuiz.length >= N) {
      const ultimosNQuiz = intentosQuiz.slice(0, N);
      const todosNoAprobados = ultimosNQuiz.every((i) => i.detalle?.aprobado !== true);

      if (todosNoAprobados) {
        await crearAlertaSinDuplicado({
          estudianteId: usuario.id,
          docenteId,
          grupoId,
          regla: 'fallosQuiz',
          temaId: intento.temaId,
          detalle: `${N} intentos consecutivos no aprobados en el nivel ${intento.nivel} del quiz.`,
          usuario,
          todasAlertas,
          usuarios
        });
      }
    }
  }
}

/**
 * Evalúa la inactividad de estudiantes en un grupo (sin eventos en la bitácora en X días).
 * @param {string} grupoId Identificador del grupo
 */
export async function evaluarInactividad(grupoId) {
  if (!grupoId) return;

  const reglas = await almacen.leerConfig('reglas-alertas');
  const cfgInactividad = reglas?.inactividad;
  if (!cfgInactividad || cfgInactividad.activa === false) return;

  const dias = Number(cfgInactividad.dias) || 7;
  const fechaLimiteMs = Date.now() - dias * 24 * 60 * 60 * 1000;

  const distributivo = await almacen.leer('distributivo');
  const grupo = distributivo.find((g) => g.id === grupoId);
  if (!grupo || !Array.isArray(grupo.estudiantes) || grupo.estudiantes.length === 0) return;

  const lineasBitacora = await almacen.leerLineas('bitacora');
  const intentos = await almacen.leer('intentos');
  const todasAlertas = await almacen.leer('alertas');
  const usuarios = await almacen.leer('usuarios');

  for (const estudianteId of grupo.estudiantes) {
    const usuarioEst = usuarios.find((u) => u.id === estudianteId);
    if (!usuarioEst || usuarioEst.activo === false) continue;

    // Buscar última actividad en bitácora o intentos
    const eventos = lineasBitacora.filter((b) => b.usuarioId === estudianteId && b.fecha);
    const intentosEst = intentos.filter((i) => i.usuarioId === estudianteId && i.fecha);

    let ultimaFechaMs = 0;
    for (const e of eventos) {
      const t = new Date(e.fecha).getTime();
      if (t > ultimaFechaMs) ultimaFechaMs = t;
    }
    for (const i of intentosEst) {
      const t = new Date(i.fecha).getTime();
      if (t > ultimaFechaMs) ultimaFechaMs = t;
    }

    if (ultimaFechaMs === 0 || ultimaFechaMs < fechaLimiteMs) {
      await crearAlertaSinDuplicado({
        estudianteId,
        docenteId: grupo.docenteId,
        grupoId: grupo.id,
        regla: 'inactividad',
        temaId: null,
        detalle: `Sin actividad registrada en la plataforma en los últimos ${dias} días.`,
        usuario: usuarioEst,
        todasAlertas,
        usuarios
      });
    }
  }
}
