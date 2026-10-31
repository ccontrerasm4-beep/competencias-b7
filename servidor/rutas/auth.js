import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Control de intentos fallidos en memoria (máximo 5 en 15 minutos)
const intentosFallidos = new Map();
const LIMITE_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

function verificarBloqueo(correoNorm) {
  const ahora = Date.now();
  const marcas = (intentosFallidos.get(correoNorm) || []).filter((t) => ahora - t < VENTANA_MS);
  intentosFallidos.set(correoNorm, marcas);
  return marcas.length >= LIMITE_INTENTOS;
}

function registrarFallo(correoNorm) {
  const ahora = Date.now();
  const marcas = (intentosFallidos.get(correoNorm) || []).filter((t) => ahora - t < VENTANA_MS);
  marcas.push(ahora);
  intentosFallidos.set(correoNorm, marcas);
}

function limpiarFallos(correoNorm) {
  intentosFallidos.delete(correoNorm);
}

function validarClave(clave) {
  return typeof clave === 'string' && clave.length >= 8 && /[a-zA-Z]/.test(clave) && /\d/.test(clave);
}

function validarCorreo(correo) {
  return typeof correo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

function generarClaveTemporal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const todos = letras + nums;
  let clave = '';
  clave += letras[crypto.randomInt(letras.length)];
  clave += nums[crypto.randomInt(nums.length)];
  for (let i = 2; i < 10; i++) {
    clave += todos[crypto.randomInt(todos.length)];
  }
  return clave.split('').sort(() => 0.5 - Math.random()).join('');
}

// POST /api/auth/registro
router.post('/auth/registro', async (req, res, next) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body || {};

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
      return res.status(400).json({ error: 'El apellido es obligatorio' });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({ error: 'Formato de correo inválido' });
    }

    if (!validarClave(clave)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar los términos de consentimiento' });
    }

    const correoNorm = correo.trim().toLowerCase();
    const usuarios = await almacen.leer('usuarios');
    const yaExiste = usuarios.some((u) => u.correo && u.correo.toLowerCase() === correoNorm);

    if (yaExiste) {
      return res.status(400).json({ error: 'El correo ya se encuentra registrado' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoUsuario = await almacen.agregar('usuarios', {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNorm,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    const { claveHash: _, ...usuarioPublico } = nuevoUsuario;
    res.status(201).json(usuarioPublico);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    const { correo, clave } = req.body || {};

    if (!correo || !clave || typeof correo !== 'string' || typeof clave !== 'string') {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const correoNorm = correo.trim().toLowerCase();

    if (verificarBloqueo(correoNorm)) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.correo && u.correo.toLowerCase() === correoNorm);

    if (!usuario || !usuario.activo) {
      registrarFallo(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const coincide = await bcrypt.compare(clave, usuario.claveHash || '');
    if (!coincide) {
      registrarFallo(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Login correcto
    limpiarFallos(correoNorm);

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    // Registrar en bitácora
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        foto: usuario.foto || null
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/auth/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (token) {
      const sesiones = await almacen.buscar('sesiones', { token });
      for (const s of sesiones) {
        await almacen.eliminar('sesiones', s.id);
      }
    }

    if (req.usuario) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId: req.usuario.id,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/yo
router.get('/auth/yo', exigirRol(), async (req, res, next) => {
  try {
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { claveHash: _, ...perfil } = usuario;
    res.json(perfil);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/perfil
router.put('/auth/perfil', exigirRol(), async (req, res, next) => {
  try {
    const { nombre, apellido, foto } = req.body || {};
    const cambios = {};

    if (typeof nombre === 'string' && nombre.trim()) {
      cambios.nombre = nombre.trim();
    }
    if (typeof apellido === 'string' && apellido.trim()) {
      cambios.apellido = apellido.trim();
    }
    if (foto !== undefined) {
      cambios.foto = foto;
    }

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);
    const { claveHash: _, ...perfil } = actualizado;
    res.json(perfil);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/clave
router.post('/auth/clave', exigirRol(), async (req, res, next) => {
  try {
    const { actual, nueva } = req.body || {};

    if (!validarClave(nueva)) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === req.usuario.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(actual || '', usuario.claveHash || '');
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const claveHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', req.usuario.id, { claveHash });

    res.json({ ok: true, mensaje: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/usuarios/:id/restablecer
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find((u) => u.id === id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const claveTemporal = generarClaveTemporal();
    const claveHash = await bcrypt.hash(claveTemporal, 10);

    await almacen.actualizar('usuarios', id, { claveHash });

    res.json({ claveTemporal });
  } catch (err) {
    next(err);
  }
});

// POST /api/eventos
router.post('/eventos', async (req, res, next) => {
  try {
    const { tipo, recurso } = req.body || {};

    if (!tipo || !recurso) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (tipo, recurso)' });
    }

    const usuarioId = req.usuario ? req.usuario.id : null;
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId,
      tipo,
      recurso,
      fecha: new Date().toISOString()
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

