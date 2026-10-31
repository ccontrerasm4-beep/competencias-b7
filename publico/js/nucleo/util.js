export function normalizar(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, (m, offset, str) => {
      const anterior = str[offset - 1];
      if (anterior === 'N' || anterior === 'n') return m;
      return '';
    })
    .normalize('NFC')
    .toUpperCase();
}

export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(d);
}

export function fechaRelativa(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';

  const difMs = d.getTime() - Date.now();
  const difSeg = Math.round(difMs / 1000);
  const difMin = Math.round(difSeg / 60);
  const difHoras = Math.round(difMin / 60);
  const difDias = Math.round(difHoras / 24);

  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });

  if (Math.abs(difSeg) < 45) return 'hace un momento';
  if (Math.abs(difMin) < 60) return rtf.format(difMin, 'minute');
  if (Math.abs(difHoras) < 24) return rtf.format(difHoras, 'hour');
  if (Math.abs(difDias) < 30) return rtf.format(difDias, 'day');

  const difMeses = Math.round(difDias / 30);
  if (Math.abs(difMeses) < 12) return rtf.format(difMeses, 'month');

  const difAnios = Math.round(difDias / 365);
  return rtf.format(difAnios, 'year');
}

export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

export function formatoBasico(texto) {
  if (!texto) return '';

  // 1. Escapar caracteres HTML para evitar XSS
  let seguro = String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 2. Convertir **texto** en <strong>texto</strong>
  seguro = seguro.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 3. Separar por bloques mediante líneas en blanco
  const bloques = seguro.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  const htmlBloques = bloques.map((bloque) => {
    const lineas = bloque.split('\n').map((l) => l.trim()).filter(Boolean);
    const partes = [];
    let listaActual = [];
    let parrafoActual = [];

    function vaciarParrafo() {
      if (parrafoActual.length > 0) {
        partes.push(`<p>${parrafoActual.join('<br>')}</p>`);
        parrafoActual = [];
      }
    }

    function vaciarLista() {
      if (listaActual.length > 0) {
        partes.push(`<ul>${listaActual.map((item) => `<li>${item}</li>`).join('')}</ul>`);
        listaActual = [];
      }
    }

    for (const linea of lineas) {
      if (linea.startsWith('- ')) {
        vaciarParrafo();
        listaActual.push(linea.slice(2).trim());
      } else {
        vaciarLista();
        parrafoActual.push(linea);
      }
    }

    vaciarParrafo();
    vaciarLista();

    return partes.join('');
  });

  return htmlBloques.join('');
}

