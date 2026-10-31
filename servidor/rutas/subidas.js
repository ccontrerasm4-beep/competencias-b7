import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_SUBIDAS = path.resolve(__dirname, '../../publico/recursos/subidas');

// Asegurar que exista la carpeta de subidas
if (!fs.existsSync(DIR_SUBIDAS)) {
  fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, DIR_SUBIDAS);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const nombreAleatorio = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, nombreAleatorio);
  }
});

const router = Router();

// POST /api/subidas (campo "archivo")
router.post('/subidas', exigirRol(), async (req, res, next) => {
  try {
    const ajustes = await almacen.leerConfig('ajustes');
    const esDocenteOAdmin =
      req.usuario && (req.usuario.rol === 'docente' || req.usuario.rol === 'admin');

    const maxMB = esDocenteOAdmin
      ? (typeof ajustes.maxSubidaMB === 'number' ? ajustes.maxSubidaMB : 10)
      : 2;

    const extensionesPermitidas = esDocenteOAdmin
      ? ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp3']
      : ['.jpg', '.jpeg', '.png', '.webp'];

    const upload = multer({
      storage,
      limits: {
        fileSize: maxMB * 1024 * 1024
      },
      fileFilter(r, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const esExtensionValida = extensionesPermitidas.includes(ext);

        let esMimeValido = false;
        if (!file.mimetype || file.mimetype === 'application/octet-stream' || file.mimetype === 'binary/octet-stream') {
          esMimeValido = true;
        } else if (file.mimetype.startsWith('image/')) {
          esMimeValido = true;
        } else if (esDocenteOAdmin) {
          if (file.mimetype === 'application/pdf') {
            esMimeValido = true;
          } else if (
            file.mimetype.startsWith('audio/') ||
            file.mimetype === 'audio/mpeg' ||
            file.mimetype === 'audio/mp3'
          ) {
            esMimeValido = true;
          }
        }

        if (esExtensionValida && esMimeValido) {
          cb(null, true);
        } else {
          const mensaje = esDocenteOAdmin
            ? `Formato no permitido. Se permiten JPG, PNG, WEBP, PDF y MP3 (máx. ${maxMB} MB)`
            : 'Solo se permiten imágenes en formato JPG, PNG o WEBP (máx. 2 MB)';
          const err = new Error(mensaje);
          err.estado = 400;
          cb(err, false);
        }
      }
    }).single('archivo');

    upload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res
            .status(400)
            .json({ error: `El archivo excede el tamaño máximo permitido de ${maxMB} MB` });
        }
        return res
          .status(err.estado || 400)
          .json({ error: err.message || 'Error al procesar el archivo' });
      }

      if (!req.file) {
        return res
          .status(400)
          .json({ error: 'No se envió ningún archivo en el campo "archivo"' });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.json({ url });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
