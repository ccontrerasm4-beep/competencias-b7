import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import { ejecutarTarea, llamarGemini } from '../ia.js';

const router = Router();

// GET /api/ia/prueba (admin)
router.get('/ia/prueba', exigirRol('admin'), async (req, res, next) => {
  try {
    const ajustes = await almacen.leerConfig('ajustes');
    const clave = ajustes.iaClave || process.env.IA_CLAVE;
    res.json({
      ok: true,
      proveedor: ajustes.iaProveedor || process.env.IA_PROVEEDOR || 'gemini',
      modelo: ajustes.iaModelo || process.env.IA_MODELO || 'gemini-1.5-flash',
      claveConfigurada: Boolean(clave)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ia/config (admin)
router.get('/ia/config', exigirRol('admin'), async (req, res, next) => {
  try {
    const ajustes = await almacen.leerConfig('ajustes');
    res.json({
      iaProveedor: ajustes.iaProveedor || 'gemini',
      iaModelo: ajustes.iaModelo || 'gemini-1.5-flash',
      iaClave: ajustes.iaClave || '',
      limiteIADiario: Number(ajustes.limiteIADiario) || 30
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ia/config (admin)
router.put('/ia/config', exigirRol('admin'), async (req, res, next) => {
  try {
    const { iaProveedor, iaModelo, iaClave, limiteIADiario } = req.body || {};
    const ajustes = await almacen.leerConfig('ajustes');

    if (iaProveedor !== undefined) ajustes.iaProveedor = String(iaProveedor).trim();
    if (iaModelo !== undefined) ajustes.iaModelo = String(iaModelo).trim();
    if (iaClave !== undefined) ajustes.iaClave = String(iaClave).trim();
    if (limiteIADiario !== undefined) {
      ajustes.limiteIADiario = Math.max(1, parseInt(limiteIADiario, 10) || 30);
    }

    await almacen.guardarConfig('ajustes', ajustes);

    res.json({
      ok: true,
      mensaje: 'Configuración de IA guardada correctamente',
      ajustes: {
        iaProveedor: ajustes.iaProveedor,
        iaModelo: ajustes.iaModelo,
        iaClave: ajustes.iaClave,
        limiteIADiario: ajustes.limiteIADiario
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ia/probar-conexion (admin)
router.post('/ia/probar-conexion', exigirRol('admin'), async (req, res) => {
  try {
    const ajustes = await almacen.leerConfig('ajustes');
    const { iaClave, iaModelo } = req.body || {};

    const clave = (iaClave !== undefined ? iaClave : ajustes.iaClave) || process.env.IA_CLAVE;
    const modelo = (iaModelo !== undefined ? iaModelo : ajustes.iaModelo) || 'gemini-1.5-flash';

    if (!clave) {
      return res.status(400).json({
        ok: false,
        error: 'No se ha proporcionado ninguna clave de API para probar'
      });
    }

    const promptPrueba = 'Responde exclusivamente con este JSON: {"estado": "conexion_exitosa", "mensaje": "IA lista"}';
    const respuesta = await llamarGemini(promptPrueba, { clave, modelo, formato: 'json' });

    res.json({
      ok: true,
      mensaje: `Conexión exitosa con Google Gemini (${modelo})`,
      respuesta
    });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err.message || 'Error al conectar con la API de IA'
    });
  }
});

// POST /api/ia/:tarea
router.post('/ia/:tarea', exigirRol(), async (req, res, next) => {
  try {
    const { tarea } = req.params;
    const datos = req.body || {};
    const formato = tarea === 'tutor' ? 'texto' : 'json';
    const resultado = await ejecutarTarea(tarea, datos, req.usuario, { formato });
    if (tarea === 'tutor' && typeof resultado === 'string') {
      res.json({ respuesta: resultado });
    } else {
      res.json(resultado);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
