import * as api from './api.js';
import * as util from './util.js';

/**
 * Carga dinámicamente la librería jsPDF desde cdnjs si aún no se encuentra en el entorno.
 */
async function asegurarJsPDF() {
  if (typeof window !== 'undefined' && (window.jspdf?.jsPDF || window.jsPDF)) {
    return window.jspdf?.jsPDF || window.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      const Constructor = window.jspdf?.jsPDF || window.jsPDF;
      if (Constructor) {
        resolve(Constructor);
      } else {
        reject(new Error('No se pudo inicializar la librería jsPDF'));
      }
    };
    script.onerror = () => reject(new Error('Error al cargar jsPDF desde el CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Genera y descarga un diploma oficial en PDF A4 horizontal con marco decorativo,
 * datos del estudiante, detalle pedagógico, fecha larga y enlace de verificación.
 * @param {Object} opciones
 * @param {"cumplimiento"|"nivel-quiz"} opciones.tipo Tipo de certificado
 * @param {string} [opciones.temaId] ID del tema (para nivel-quiz)
 * @param {number} [opciones.nivel] Nivel alcanzado (para nivel-quiz)
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo = 'cumplimiento', temaId, nivel } = {}) {
  // 1. Registrar o recuperar el certificado desde la API del servidor
  const cert = await api.llamar('POST', '/api/certificados', { tipo, temaId, nivel });
  const { codigo, nombreCompleto, detalle, fecha } = cert;

  // 2. Cargar jsPDF
  const JsPDFConstructor = await asegurarJsPDF();

  // 3. Crear documento A4 apaisado (297 x 210 mm)
  const doc = new JsPDFConstructor({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // 4. Leer colores corporativos desde tokens.css
  let colorPrimario = '#003366';
  let colorAcento = '#ff7f27';
  let colorTexto = '#222222';
  let colorTextoSuave = '#666666';

  if (typeof window !== 'undefined' && typeof getComputedStyle === 'function') {
    const estilos = getComputedStyle(document.documentElement);
    colorPrimario = estilos.getPropertyValue('--color-primario').trim() || colorPrimario;
    colorAcento = estilos.getPropertyValue('--color-acento').trim() || colorAcento;
    colorTexto = estilos.getPropertyValue('--color-texto').trim() || colorTexto;
    colorTextoSuave = estilos.getPropertyValue('--color-texto-suave').trim() || colorTextoSuave;
  }

  // 5. Marco exterior e interior
  doc.setLineWidth(2.2);
  doc.setDrawColor(colorPrimario);
  doc.rect(10, 10, 277, 190);

  doc.setLineWidth(0.8);
  doc.setDrawColor(colorAcento);
  doc.rect(13, 13, 271, 184);

  // Detalles en las 4 esquinas del marco
  const esquinas = [
    [10, 10],
    [287, 10],
    [10, 200],
    [287, 200]
  ];
  doc.setFillColor(colorPrimario);
  for (const [x, y] of esquinas) {
    doc.rect(x - 2, y - 2, 4, 4, 'F');
  }

  // 6. Contenido centralizado (Centro X = 148.5)
  // Nombre de la plataforma
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(colorPrimario);
  doc.text('ECOSISTEMA EDUCATIVO DIGITAL', 148.5, 34, { align: 'center' });

  // Título del diploma
  doc.setFontSize(26);
  doc.text('DIPLOMA DE RECONOCIMIENTO', 148.5, 48, { align: 'center' });

  // Subtítulo
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(12);
  doc.setTextColor(colorTextoSuave);
  doc.text('Otorgado a:', 148.5, 68, { align: 'center' });

  // Nombre del estudiante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(colorPrimario);
  const nombreTxt = (nombreCompleto || 'ESTUDIANTE').toUpperCase();
  doc.text(nombreTxt, 148.5, 84, { align: 'center' });

  // Línea decorativa bajo el nombre
  doc.setDrawColor(colorAcento);
  doc.setLineWidth(0.6);
  doc.line(65, 90, 232, 90);

  // Detalle del logro
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(colorTexto);
  const lineasDetalle = doc.splitTextToSize(detalle || '', 200);
  doc.text(lineasDetalle, 148.5, 108, { align: 'center' });

  // Fecha de emisión
  const fechaTexto = 'Emitido el ' + util.fechaLarga(fecha || new Date().toISOString());
  doc.setFontSize(11);
  doc.setTextColor(colorTextoSuave);
  doc.text(fechaTexto, 148.5, 134, { align: 'center' });

  // 7. Pie con código y enlace de verificación
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colorPrimario);
  doc.text(`Código de certificación: ${codigo}`, 148.5, 162, { align: 'center' });

  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  const urlVerificar = `${origin}/paginas/verificar.html?codigo=${encodeURIComponent(codigo)}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colorTextoSuave);
  doc.text(`Verifica la autenticidad de este documento en: ${urlVerificar}`, 148.5, 170, {
    align: 'center'
  });

  // 8. Descarga del archivo
  doc.save(`diploma-${codigo}.pdf`);

  return { codigo };
}

