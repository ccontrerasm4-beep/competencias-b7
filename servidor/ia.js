import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as almacen from './almacen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_PROMPTS = path.resolve(__dirname, 'prompts');
const DIR_PREPARADORES = path.resolve(__dirname, 'preparadores');

/**
 * Reemplaza las variables {{clave}} en una plantilla de prompt.
 */
function compilarPrompt(plantilla, variables = {}) {
  let resultado = plantilla;
  for (const [clave, valor] of Object.entries(variables)) {
    const regex = new RegExp(`{{${clave}}}`, 'g');
    resultado = resultado.replace(regex, String(valor ?? ''));
  }
  return resultado;
}

/**
 * Genera preguntas simuladas de alta calidad basadas en el tema y glosario
 * cuando no se encuentra configurada una clave de IA externa.
 */
function generarPreguntasFallback(datosPrompt) {
  const cantidad = Number(datosPrompt.cantidad) || 5;
  const nivel = datosPrompt.nivelBloom || '1 Recordar';
  const temaTitulo = datosPrompt.tema || 'el tema';
  const lineasGlosario = (datosPrompt.glosario || '')
    .split('\n')
    .filter((l) => l.includes(':'))
    .map((l) => {
      const [term, ...def] = l.split(':');
      return { termino: term.trim(), definicion: def.join(':').trim() };
    });

  const tipos = ['opcion', 'vf', 'completar'];
  const preguntas = [];

  for (let i = 0; i < cantidad; i++) {
    const tipo = tipos[i % tipos.length];
    const terminoActual = lineasGlosario[i % (lineasGlosario.length || 1)] || {
      termino: `Concepto ${i + 1}`,
      definicion: `Definición clave de ${temaTitulo}.`
    };

    if (tipo === 'opcion') {
      const distractores = [
        'Es un proceso secundario no relacionado',
        'Corresponde a una definición obsoleta',
        'Se aplica únicamente en casos aislados'
      ];
      preguntas.push({
        tipo: 'opcion',
        enunciado: `¿Cuál de las siguientes afirmaciones describe mejor a "${terminoActual.termino}" en el contexto de ${temaTitulo}?`,
        opciones: [
          terminoActual.definicion || `Es el elemento fundamental en ${temaTitulo}`,
          ...distractores
        ],
        correcta: 0,
        retroalimentacion: `Es correcta porque "${terminoActual.termino}" se define como: ${terminoActual.definicion}`
      });
    } else if (tipo === 'vf') {
      const esVerdadero = i % 2 === 0;
      preguntas.push({
        tipo: 'vf',
        enunciado: esVerdadero
          ? `En el estudio de ${temaTitulo}, "${terminoActual.termino}" cumple con: ${terminoActual.definicion}.`
          : `En el estudio de ${temaTitulo}, "${terminoActual.termino}" no guarda ninguna relación con los objetivos de aprendizaje.`,
        opciones: ['Verdadero', 'Falso'],
        correcta: esVerdadero,
        retroalimentacion: `La respuesta correcta es ${esVerdadero ? 'Verdadero' : 'Falso'} debido a los fundamentos conceptuales de ${temaTitulo}.`
      });
    } else {
      preguntas.push({
        tipo: 'completar',
        enunciado: `En ${temaTitulo}, la noción referida a "${terminoActual.definicion.slice(0, 45)}..." corresponde a ____.`,
        opciones: [],
        correcta: terminoActual.termino,
        retroalimentacion: `El término correcto para completar la afirmación es "${terminoActual.termino}".`
      });
    }
  }

  return preguntas;
}

let cooldownGeminiHasta = 0;

function normalizarTexto(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Motor pedagógico de tutoría socrática contextualmente ajustado a la asignatura y tema.
 */
function generarRespuestaSocratica(datosPrompt) {
  const asignatura = datosPrompt.asignatura || 'la asignatura';
  const tema = datosPrompt.tema || 'este tema';
  const pregunta = datosPrompt.pregunta || '';
  const normPregunta = normalizarTexto(pregunta);

  // 1. Saludos
  if (/^(hola|buen(as|os)|que tal|saludos)/i.test(normPregunta)) {
    return `¡Hola! Me da mucho gusto saludarte. Soy tu tutor socrático en ${asignatura}. Mi objetivo no es darte la respuesta directa, sino acompañarte para que razones y descubras los conceptos por ti mismo. ¿Qué tema o duda te gustaría que analicemos juntos hoy?`;
  }

  // 2. Preguntas ajenas o fuera de la asignatura
  const palabrasAjenas = ['futbol', 'partido', 'videojuego', 'minecraft', 'receta', 'pizza', 'pelicula', 'chiste', 'musica'];
  if (palabrasAjenas.some((p) => normPregunta.includes(p))) {
    return `Esa es una inquietud curiosa, pero como tu tutor socrático en ${asignatura}, mi labor pedagógica es acompañarte en los contenidos del curso. ¿Qué te parece si volvemos a enfocar nuestra atención en ${tema}?`;
  }

  // 3. Consulta sobre conceptos clave / de qué trata
  if (normPregunta.includes('concepto') || normPregunta.includes('clave') || normPregunta.includes('resumen') || normPregunta.includes('trata') || normPregunta.includes('aprender')) {
    return `En ${tema}, los pilares centrales consisten en diferenciar claramente las entradas de dinero por ventas frente a los recursos que consumimos para producir (costos), y entender cómo esto define el margen sobre producción. Para empezar a razonarlo: si tuvieras un pequeño emprendimiento de venta de bolos o helados, ¿por qué crees que no todo el dinero cobrado en el día representa una ganancia neta?`;
  }

  // 4. Consulta sobre costos, costo unitario o ejemplos matemáticos
  if (normPregunta.includes('costo unitario') || normPregunta.includes('lote') || normPregunta.includes('calcular') || normPregunta.includes('formula')) {
    return `¡Excelente inquietud técnica! Pensemos en el cálculo de forma intuitiva: si para producir un lote de 40 unidades invertiste un total de $24 en ingredientes y envases, ¿qué operación matemática te permite determinar cuánto costó producir cada unidad individual?`;
  }

  // 5. Pistas o cómo resolver
  if (normPregunta.includes('pista') || normPregunta.includes('ayuda') || normPregunta.includes('no entiendo') || normPregunta.includes('como hago')) {
    return `¡Con gusto te doy una pista para orientarte! Recuerda que el ingreso total resulta de multiplicar la cantidad vendida por el precio unitario. Para dar el siguiente paso de razonamiento: ¿qué crees que ocurre con tu margen si aumentas las ventas pero los costos de producción aumentan en mayor proporción?`;
  }

  // 6. Diferencia entre gastos e inversión
  if (normPregunta.includes('gasto') || normPregunta.includes('inversion') || normPregunta.includes('diferencia')) {
    return `¡Muy buen tema de discusión! Piensa en el destino del dinero: si compras una congeladora para conservar alimentos durante varios años frente a comprar fundas que se gastan en el día, ¿cuál de los dos desembolsos crees que es una inversión y cuál un costo/gasto operativo?`;
  }

  // 7. Pregunta abierta pedagógica general
  return `Has planteado un punto muy interesante sobre ${tema}. Para ayudarte a construir la respuesta con tus propias palabras: considerando lo que has revisado en clase, ¿qué idea inicial tienes sobre este concepto y cómo crees que se relaciona con los objetivos de ${asignatura}?`;
}

/**
 * Realiza una consulta directa a la API de Google Gemini con control de timeout.
 */
export async function llamarGemini(textoPrompt, { clave, modelo = 'gemini-1.5-flash', formato = 'json' } = {}) {
  if (!clave) {
    throw new Error('No se ha configurado la clave de API para Gemini');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(clave)}`;

  let cuerpoPeticion;
  if (textoPrompt.includes('### USUARIO')) {
    const partes = textoPrompt.split('### USUARIO');
    cuerpoPeticion = {
      systemInstruction: { parts: [{ text: partes[0].trim() }] },
      contents: [{ parts: [{ text: partes.slice(1).join('### USUARIO').trim() }] }]
    };
  } else {
    cuerpoPeticion = {
      contents: [{ parts: [{ text: textoPrompt }] }]
    };
  }

  if (formato === 'json') {
    cuerpoPeticion.generationConfig = { responseMimeType: 'application/json' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpoPeticion),
    signal: AbortSignal.timeout(4000)
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.error?.message || `Error ${res.status}: ${res.statusText}`;
    throw new Error(`Google Gemini Error: ${errorMsg}`);
  }

  let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (formato === 'json') {
    rawText = rawText.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    }
    return JSON.parse(rawText);
  }

  return rawText;
}

/**
 * Ejecuta una tarea de Inteligencia Artificial aplicando el preparador, la plantilla
 * de prompt, control de consumo diario y registro en bitácora.
 * @param {string} tarea Nombre de la tarea (ej. 'generar-preguntas')
 * @param {Object} datos Parámetros de entrada de la tarea
 * @param {Object} usuario Usuario solicitante
 * @param {Object} opciones { formato: 'json' | 'texto' }
 * @returns {Promise<any>}
 */
export async function ejecutarTarea(tarea, datos = {}, usuario, { formato = 'json' } = {}) {
  if (!usuario) {
    const err = new Error('Sesión requerida para ejecutar tareas de IA');
    err.estado = 401;
    throw err;
  }

  // 1. Control de límite diario de consumo de IA
  const ajustes = await almacen.leerConfig('ajustes');
  const limiteDiario =
    tarea === 'tutor'
      ? Number(ajustes.limiteTutorDiario) || 40
      : Number(ajustes.limiteIADiario) || 30;

  const hoyStr = new Date().toISOString().slice(0, 10);
  const lineasConsumo = await almacen.leerLineas('consumo-ia.jsonl');
  const consumosHoy = lineasConsumo.filter(
    (c) => c.usuarioId === usuario.id && c.tarea === tarea && c.fecha && c.fecha.startsWith(hoyStr)
  );

  if (consumosHoy.length >= limiteDiario && usuario.rol !== 'admin') {
    const err = new Error(`Has alcanzado el límite diario de ${limiteDiario} consultas permitidas`);
    err.estado = 429;
    throw err;
  }

  // 2. Cargar y ejecutar preparador si existe
  let datosPrompt = datos;
  const rutaPreparador = path.join(DIR_PREPARADORES, `${tarea}.js`);
  try {
    await fs.access(rutaPreparador);
    const modulo = await import(pathToFileURL(rutaPreparador).href);
    const preparador = modulo.default || modulo;
    if (typeof preparador === 'function') {
      datosPrompt = await preparador(datos, usuario);
    }
  } catch (err) {
    if (err.estado) throw err;
  }

  // 3. Cargar y compilar plantilla de prompt
  const rutaPrompt = path.join(DIR_PROMPTS, `${tarea}.txt`);
  let textoPrompt = '';
  try {
    const plantilla = await fs.readFile(rutaPrompt, 'utf-8');
    textoPrompt = compilarPrompt(plantilla, datosPrompt);
  } catch (err) {
    textoPrompt = JSON.stringify(datosPrompt);
  }

  // 4. Ejecutar con proveedor configurado (desde ajustes.json o process.env)
  let resultado = null;
  const claveIA = ajustes.iaClave || process.env.IA_CLAVE;
  const proveedor = (ajustes.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').toLowerCase();
  const modelo = ajustes.iaModelo || process.env.IA_MODELO || 'gemini-1.5-flash';

  if (claveIA && proveedor === 'gemini') {
    if (Date.now() < cooldownGeminiHasta) {
      console.log(`[IA] En período de espera por cuota de Gemini (${modelo}), activando tutor pedagógico inmediato.`);
    } else {
      try {
        resultado = await llamarGemini(textoPrompt, { clave: claveIA, modelo, formato });
      } catch (errApi) {
        console.warn(`[IA] Error al llamar a Gemini (${modelo}):`, errApi.message);
        if (errApi.message.includes('429') || errApi.message.includes('quota') || errApi.message.includes('Quota')) {
          cooldownGeminiHasta = Date.now() + 180000;
        }
        resultado = null;
      }
    }
  }

  if (!resultado) {
    if (tarea === 'generar-preguntas') {
      resultado = generarPreguntasFallback(datosPrompt);
    } else if (tarea === 'tutor') {
      resultado = generarRespuestaSocratica(datosPrompt);
    } else {
      resultado = formato === 'json' ? [] : 'Respuesta generada.';
    }
  }

  // 5. Registrar consumo en bitácora
  await almacen.anexarLinea('consumo-ia.jsonl', {
    usuarioId: usuario.id,
    tarea,
    entrada: datos,
    salida: resultado,
    ok: true,
    fecha: new Date().toISOString()
  });

  return resultado;
}

