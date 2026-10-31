import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

async function principal() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('=== Crear Usuario Administrador ===');
    const nombre = (await rl.question('Nombre: ')).trim();
    const apellido = (await rl.question('Apellido: ')).trim();
    const correo = (await rl.question('Correo: ')).trim().toLowerCase();
    const clave = (await rl.question('Contraseña: ')).trim();

    if (!nombre || !apellido) {
      console.error('Error: El nombre y apellido son obligatorios.');
      process.exit(1);
    }

    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      console.error('Error: El formato del correo electrónico no es válido.');
      process.exit(1);
    }

    if (!clave || clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
      console.error('Error: La contraseña debe tener al menos 8 caracteres y contener letras y números.');
      process.exit(1);
    }

    const usuarios = await almacen.leer('usuarios');
    const existe = usuarios.some((u) => u.correo && u.correo.toLowerCase() === correo);

    if (existe) {
      console.error(`Error: El correo "${correo}" ya está registrado.`);
      process.exit(1);
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoAdmin = await almacen.agregar('usuarios', {
      nombre,
      apellido,
      correo,
      claveHash,
      rol: 'admin',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    console.log('¡Usuario administrador creado con éxito!');
    console.log(`ID: ${nuevoAdmin.id}`);
    console.log(`Nombre: ${nuevoAdmin.nombre} ${nuevoAdmin.apellido}`);
    console.log(`Correo: ${nuevoAdmin.correo}`);
    console.log(`Rol: ${nuevoAdmin.rol}`);
  } catch (err) {
    console.error('Error al crear el administrador:', err);
    process.exit(1);
  } finally {
    rl.close();
  }
}

principal();

