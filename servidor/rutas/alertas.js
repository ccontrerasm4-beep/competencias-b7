import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const router = Router();

// GET /api/alertas?grupoId=
router.get('/alertas', exigirRol('docente', 'admin'), async (req, res, next) => {
  try {
    const { grupoId } = req.query;

    const [todasAlertas, distributivo, reglasAlertas] = await Promise.all([
      almacen.leer('alertas'),
      almacen.leer('distributivo'),
      almacen.leerConfig('reglas-alertas')
    ]);

    const mensajesApoyo = Array.isArray(reglasAlertas?.mensajesApoyo)
      ? reglasAlertas.mensajesApoyo
      : [];

    let alertas = [];

    if (grupoId) {
      const grupo = distributivo.find((g) => g.id === grupoId);
      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      if (req.usuario.rol !== 'admin' && grupo.docenteId !== req.usuario.id) {
        return res.status(403).json({ error: 'No tienes acceso a las alertas de este grupo' });
      }

      alertas = todasAlertas.filter((a) => a.grupoId === grupoId);
    } else {
      if (req.usuario.rol === 'admin') {
        alertas = todasAlertas;
      } else {
        alertas = todasAlertas.filter((a) => a.docenteId === req.usuario.id);
      }
    }

    res.json({
      alertas,
      mensajesApoyo
    });
  } catch (err) {
    next(err);
  }
});

export default router;

