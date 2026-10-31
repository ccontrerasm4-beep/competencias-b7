import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_SEMILLA = path.resolve(__dirname, '../datos/semilla');
const DIR_DATOS = path.resolve(__dirname, '../datos');
const CLAVE_DEMO = 'Demo12345';

async function pedirConfirmacion(mensaje) {
  if (!process.stdin.isTTY || process.argv.includes('-y')) {
    return true;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(mensaje, (resp) => {
      rl.close();
      const limpia = resp.trim().toLowerCase();
      resolve(limpia === 's' || limpia === 'si' || limpia === 'y' || limpia === 'yes');
    });
  });
}

async function ejecutarSemilla() {
  const forzar = process.argv.includes('--forzar') || process.argv.includes('-f');

  if (forzar) {
    const confirmado = await pedirConfirmacion(
      'ADVERTENCIA: --forzar reemplazará las colecciones existentes con la semilla. ¿Desea continuar? (s/N): '
    );
    if (!confirmado) {
      console.log('Operación cancelada.');
      process.exit(0);
    }
  }

  const archivos = (await fs.readdir(DIR_SEMILLA)).filter((f) => f.endsWith('.json')).sort();

  for (const archivo of archivos) {
    const col = archivo.slice(0, -5);
    const rutaDestino = path.join(DIR_DATOS, archivo);

    let existe = false;
    try {
      await fs.access(rutaDestino);
      existe = true;
    } catch {
      existe = false;
    }

    if (existe && !forzar) {
      console.log(`Colección ${col} ya existe en datos/ (omitiendo). Use --forzar para reemplazar.`);
      continue;
    }

    const contenidoRaw = await fs.readFile(path.join(DIR_SEMILLA, archivo), 'utf-8');
    const registros = JSON.parse(contenidoRaw);

    if (col === 'usuarios') {
      const claveHash = await bcrypt.hash(CLAVE_DEMO, 10);
      for (const u of registros) {
        u.claveHash = claveHash;
      }
    }

    await almacen.escribir(col, registros);
    console.log(`Colección ${col} instalada en datos/ (${registros.length} registros).`);
  }

  console.log('\nSemilla completada exitosamente.');
}

ejecutarSemilla().catch((err) => {
  console.error('Error al ejecutar semilla:', err);
  process.exit(1);
});

