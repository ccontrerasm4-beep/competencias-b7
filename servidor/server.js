import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import { aplicar } from './ganchos.js';
import { cargarUsuario } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PUBLICO = path.resolve(__dirname, '../publico');
const DIR_RUTAS = path.resolve(__dirname, 'rutas');

const app = express();
const PUERTO = process.env.PUERTO || process.env.PORT || 3000;

// Servir archivos estáticos de publico/
await fs.mkdir(DIR_PUBLICO, { recursive: true });
app.use(express.static(DIR_PUBLICO));

// Límite de 1 MB para JSON
app.use(express.json({ limit: '1mb' }));

// Middleware para cargar usuario mediante token Bearer
app.use(cargarUsuario);

// Montar automáticamente cada servidor/rutas/*.js en orden alfabético
await fs.mkdir(DIR_RUTAS, { recursive: true });
const archivosRutas = (await fs.readdir(DIR_RUTAS))
  .filter((f) => f.endsWith('.js'))
  .sort();

for (const archivo of archivosRutas) {
  const rutaCompleta = path.join(DIR_RUTAS, archivo);
  const modulo = await import(pathToFileURL(rutaCompleta).href);
  const router = modulo.default || modulo;
  app.use('/api', router);
}

// API genérica: /api/:col y /api/:col/:id
app.get('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    if (!puede(req.usuario, 'leer', col)) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    let lista = await almacen.buscar(col, req.query);
    lista = lista.filter((reg) => puede(req.usuario, 'leer', col, reg));
    lista = await aplicar(col, 'filtrarLista', lista, req.usuario);

    res.json(lista);
  } catch (err) {
    next(err);
  }
});

app.get('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const reg = lista.find((item) => item.id === id);

    if (!reg) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (!puede(req.usuario, 'leer', col, reg)) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    res.json(reg);
  } catch (err) {
    next(err);
  }
});

app.post('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    if (!puede(req.usuario, 'escribir', col, req.body)) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    let datos = req.body || {};
    datos = await aplicar(col, 'antesDeGuardar', datos, req.usuario, null);
    const nuevo = await almacen.agregar(col, datos);
    await aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

    res.status(201).json(nuevo);
  } catch (err) {
    next(err);
  }
});

app.put('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (!puede(req.usuario, 'escribir', col, anterior)) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    let cambios = req.body || {};
    cambios = await aplicar(col, 'antesDeGuardar', cambios, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambios);
    await aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const lista = await almacen.leer(col);
    const anterior = lista.find((item) => item.id === id);

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    if (!puede(req.usuario, 'escribir', col, anterior)) {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    await almacen.eliminar(col, id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Manejador 404 para rutas de la API no capturadas
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador centralizado de errores
app.use((err, req, res, next) => {
  const estado = typeof err.estado === 'number' ? err.estado : 500;
  res.status(estado).json({ error: err.message || 'Error en el servidor' });
});

const esPrincipal = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
);

if (esPrincipal) {
  app.listen(PUERTO, () => {
    console.log(`Servidor iniciado en http://localhost:${PUERTO}`);
  });
}

export default app;
