import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const router = Router();

// Solo admin puede eliminar asignaturas y únicamente si no tienen grupos asociados
router.delete('/asignaturas/:id', exigirRol('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const lista = await almacen.leer('asignaturas');
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const distributivo = await almacen.leer('distributivo');
    const grupos = distributivo.filter((g) => g.asignaturaId === id);
    if (grupos.length > 0) {
      return res.status(400).json({
        error: `No se puede eliminar la asignatura porque tiene ${grupos.length} grupo(s) asignados en el distributivo.`
      });
    }

    await almacen.eliminar('asignaturas', id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
