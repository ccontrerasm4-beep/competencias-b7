import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';

const router = Router();

// POST /api/intentos
router.post('/intentos', exigirRol(), async (req, res, next) => {
  try {
    const resultado = await procesarIntento(req.usuario, req.body || {});
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// GET /api/logros/:usuarioId ("yo" = usuario actual; permitido al propio estudiante, a un docente de sus grupos o al admin)
router.get('/logros/:usuarioId', exigirRol(), async (req, res, next) => {
  try {
    let { usuarioId } = req.params;
    if (usuarioId === 'yo') {
      usuarioId = req.usuario.id;
    }

    let permitido = false;
    if (req.usuario.id === usuarioId) {
      permitido = true;
    } else if (req.usuario.rol === 'admin') {
      permitido = true;
    } else if (req.usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(req.usuario.id);
      permitido = estudiantes.some((e) => e.id === usuarioId);
    }

    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    const todosLogros = await almacen.leer('logros');
    let logro = todosLogros.find((l) => l.usuarioId === usuarioId);

    if (!logro) {
      logro = {
        usuarioId,
        puntos: 0,
        insignias: [],
        nivelQuiz: {}
      };
    }

    res.json(logro);
  } catch (err) {
    next(err);
  }
});

export default router;

