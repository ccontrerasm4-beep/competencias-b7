import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

/**
 * Genera un código de certificado único con formato "EE-YYYY-XXXXXX"
 */
function generarCodigoUnico(existentes) {
  const anio = new Date().getFullYear();
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigosExistentes = new Set((existentes || []).map((c) => c.codigo));

  let codigo = '';
  do {
    let sufijo = '';
    for (let i = 0; i < 6; i++) {
      sufijo += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    codigo = `EE-${anio}-${sufijo}`;
  } while (codigosExistentes.has(codigo));

  return codigo;
}

/**
 * Evalúa las condiciones de certificación de cumplimiento para un usuario
 */
async function evaluarCondicionesCumplimiento(usuario) {
  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const cfg = reglas.certificado || {
    nivelQuizRequerido: 5,
    temasConNivelRequerido: 1,
    puntosMinimos: 400,
    temasRevisadosPct: 80
  };

  // 1. Temas con nivel de quiz requerido
  const todosLogros = await almacen.leer('logros');
  const logro = todosLogros.find((l) => l.usuarioId === usuario.id) || { puntos: 0, nivelQuiz: {} };

  const temasConNivel = Object.values(logro.nivelQuiz || {}).filter(
    (n) => Number(n) >= Number(cfg.nivelQuizRequerido)
  ).length;
  const cumpleNivel = temasConNivel >= Number(cfg.temasConNivelRequerido);

  // 2. Puntos mínimos acumulados
  const puntosActuales = Number(logro.puntos || 0);
  const cumplePuntos = puntosActuales >= Number(cfg.puntosMinimos);

  // 3. Porcentaje de temas revisados (sobre los temas publicados de sus asignaturas)
  const misAsignaturas = await acceso.asignaturasDe(usuario);
  const idsAsignaturas = new Set(misAsignaturas.map((a) => a.id));

  const todasUnidades = await almacen.leer('unidades');
  const unidadesVisibles = todasUnidades.filter(
    (u) => idsAsignaturas.has(u.asignaturaId) && u.visible !== false
  );
  const idsUnidades = new Set(unidadesVisibles.map((u) => u.id));

  const todosTemas = await almacen.leer('temas');
  const temasPublicados = todosTemas.filter(
    (t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado'
  );
  const totalTemas = temasPublicados.length;

  const progreso = await almacen.leer('progreso-temas');
  const temasRevisadosIds = new Set(
    progreso.filter((p) => p.usuarioId === usuario.id).map((p) => p.temaId)
  );

  const cantRevisados = temasPublicados.filter((t) => temasRevisadosIds.has(t.id)).length;
  const pctRevisados = totalTemas > 0 ? Math.round((cantRevisados / totalTemas) * 100) : 0;
  const cumplePct = pctRevisados >= Number(cfg.temasRevisadosPct);

  const condiciones = [
    {
      nombre: `Temas con Quiz nivel ${cfg.nivelQuizRequerido}`,
      actual: temasConNivel,
      requerido: cfg.temasConNivelRequerido,
      cumple: cumpleNivel
    },
    {
      nombre: 'Puntos mínimos acumulados',
      actual: puntosActuales,
      requerido: cfg.puntosMinimos,
      cumple: cumplePuntos
    },
    {
      nombre: 'Porcentaje de temas revisados',
      actual: pctRevisados,
      requerido: cfg.temasRevisadosPct,
      cumple: cumplePct
    }
  ];

  const cumple = cumpleNivel && cumplePuntos && cumplePct;
  return { condiciones, cumple };
}

// GET /api/certificados/estado
router.get('/certificados/estado', exigirRol(), async (req, res, next) => {
  try {
    const estado = await evaluarCondicionesCumplimiento(req.usuario);
    res.json(estado);
  } catch (err) {
    next(err);
  }
});

// POST /api/certificados
router.post('/certificados', exigirRol(), async (req, res, next) => {
  try {
    const { tipo, temaId, nivel } = req.body || {};

    if (tipo !== 'cumplimiento' && tipo !== 'nivel-quiz') {
      const err = new Error("El tipo debe ser 'cumplimiento' o 'nivel-quiz'");
      err.estado = 400;
      throw err;
    }

    let detalle = '';
    const certsExistentes = await almacen.leer('certificados');

    if (tipo === 'nivel-quiz') {
      const nivelNum = Number(nivel);
      if (isNaN(nivelNum) || nivelNum <= 0 || !temaId) {
        const err = new Error('Para certificados de nivel-quiz se requiere temaId y nivel válido');
        err.estado = 400;
        throw err;
      }

      // Verificar que el estudiante haya alcanzado el nivel de quiz
      const todosLogros = await almacen.leer('logros');
      const logro = todosLogros.find((l) => l.usuarioId === req.usuario.id);
      const nivelAlcanzado = Number(logro?.nivelQuiz?.[temaId] || 0);

      if (nivelAlcanzado < nivelNum) {
        const err = new Error(
          `Aún no has alcanzado el nivel ${nivelNum} en el quiz de este tema (actual: ${nivelAlcanzado})`
        );
        err.estado = 400;
        throw err;
      }

      // Si ya existe un certificado igual, devolverlo
      const existente = certsExistentes.find(
        (c) =>
          c.usuarioId === req.usuario.id &&
          c.tipo === 'nivel-quiz' &&
          c.temaId === temaId &&
          Number(c.nivel) === nivelNum
      );
      if (existente) {
        return res.json(existente);
      }

      // Obtener datos del tema para el detalle
      const temas = await almacen.leer('temas');
      const tema = temas.find((t) => t.id === temaId);
      const nombreTema = tema ? tema.titulo : 'Tema de estudio';
      detalle = `Aprobación del Nivel ${nivelNum} en el Quiz del tema: ${nombreTema}`;
    } else {
      // tipo === 'cumplimiento'
      const { cumple } = await evaluarCondicionesCumplimiento(req.usuario);
      if (!cumple) {
        const err = new Error(
          'Aún no cumples con todos los requisitos necesarios para emitir el certificado de cumplimiento'
        );
        err.estado = 400;
        throw err;
      }

      const existente = certsExistentes.find(
        (c) => c.usuarioId === req.usuario.id && c.tipo === 'cumplimiento'
      );
      if (existente) {
        return res.json(existente);
      }

      detalle = 'Cumplimiento satisfactorio del programa académico y actividades formativas';
    }

    const codigo = generarCodigoUnico(certsExistentes);
    const nombreCompleto = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim();

    const nuevoCertificado = {
      codigo,
      usuarioId: req.usuario.id,
      tipo,
      temaId: temaId || null,
      nivel: nivel !== undefined ? Number(nivel) : null,
      detalle,
      nombreCompleto
    };

    const guardado = await almacen.agregar('certificados', nuevoCertificado);
    res.status(201).json(guardado);
  } catch (err) {
    next(err);
  }
});

// GET /api/certificados/verificar/:codigo (Ruta pública sin sesión)
router.get('/certificados/verificar/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.json({ valido: false });
    }

    const certs = await almacen.leer('certificados');
    const codigoBuscado = codigo.trim().toUpperCase();
    const cert = certs.find((c) => (c.codigo || '').toUpperCase() === codigoBuscado);

    if (!cert) {
      return res.json({ valido: false });
    }

    res.json({
      valido: true,
      nombreCompleto: cert.nombreCompleto,
      detalle: cert.detalle,
      fecha: cert.fecha
    });
  } catch (err) {
    next(err);
  }
});

export default router;

