import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';

const router = Router();

// GET /api/notificaciones
router.get('/notificaciones', exigirRol(), async (req, res, next) => {
  try {
    const todas = await almacen.leer('notificaciones');
    const mias = todas.filter((n) => n.usuarioId === req.usuario.id);

    const sinLeer = mias.filter((n) => !n.leida).length;
    const recientes = [...mias]
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
      .slice(0, 30);

    res.json({
      notificaciones: recientes,
      sinLeer,
      totalSinLeer: sinLeer
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/notificaciones { usuarioId, mensaje, enlace }
router.post('/notificaciones', exigirRol('docente', 'admin'), async (req, res, next) => {
  try {
    const { usuarioId, mensaje, enlace } = req.body || {};

    if (!usuarioId || !mensaje) {
      return res.status(400).json({ error: 'usuarioId y mensaje son obligatorios' });
    }

    // Docente solo puede notificar a sus estudiantes; admin a cualquiera
    if (req.usuario.rol === 'docente') {
      const misEstudiantes = await acceso.estudiantesDe(req.usuario.id);
      const esMiEstudiante = misEstudiantes.some((e) => e.id === usuarioId);
      if (!esMiEstudiante) {
        return res.status(403).json({ error: 'Solo puedes enviar notificaciones a tus propios estudiantes' });
      }
    }

    const nuevaNotif = await notificar(usuarioId, {
      tipo: 'mensaje-docente',
      mensaje,
      enlace: enlace || ''
    });

    res.status(201).json(nuevaNotif);
  } catch (err) {
    next(err);
  }
});

// POST /api/notificaciones/:id/leida
router.post('/notificaciones/:id/leida', exigirRol(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const notificaciones = await almacen.leer('notificaciones');
    const notif = notificaciones.find((n) => n.id === id);

    if (!notif) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    if (notif.usuarioId !== req.usuario.id && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta notificación' });
    }

    const actualizada = await almacen.actualizar('notificaciones', id, { leida: true });
    res.json({ ok: true, notificacion: actualizada });
  } catch (err) {
    next(err);
  }
});

// POST /api/notificaciones/leidas
router.post('/notificaciones/leidas', exigirRol(), async (req, res, next) => {
  try {
    const notificaciones = await almacen.leer('notificaciones');
    let contador = 0;

    const actualizadas = notificaciones.map((n) => {
      if (n.usuarioId === req.usuario.id && !n.leida) {
        contador++;
        return { ...n, leida: true };
      }
      return n;
    });

    if (contador > 0) {
      await almacen.escribir('notificaciones', actualizadas);
    }

    res.json({ ok: true, actualizadas: contador });
  } catch (err) {
    next(err);
  }
});

export default router;

