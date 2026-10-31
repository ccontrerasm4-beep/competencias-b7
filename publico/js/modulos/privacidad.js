import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: "Aviso de Privacidad", roles: ["publico"] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <article class="tarjeta privacidad-tarjeta">
      <h1>Aviso de Privacidad y Protección de Datos</h1>
      <p style="color: var(--color-texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espacio-l);">
        Cumplimiento con la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador.
      </p>

      <section class="privacidad-bloque">
        <h2>1. Finalidad del Tratamiento</h2>
        <p>
          Los datos personales recabados en la plataforma del Ecosistema Educativo tienen como finalidad exclusiva la autenticación de usuarios, la gestión de actividades pedagógicas, la trazabilidad del aprendizaje formativo, la gamificación académica y el soporte tutorial asistido por inteligencia artificial.
        </p>
      </section>

      <section class="privacidad-bloque">
        <h2>2. Datos Tratados</h2>
        <p>Para la prestación de los servicios educativos se recopilan y almacenan los siguientes datos:</p>
        <ul>
          <li><strong>Nombre y Apellido:</strong> para identificación en paneles y certificados de logro.</li>
          <li><strong>Correo electrónico:</strong> credencial única de acceso y notificaciones institucionales.</li>
          <li><strong>Actividad en la plataforma:</strong> bitácora de navegación, progreso en asignaturas e intentos de evaluación.</li>
        </ul>
      </section>

      <section class="privacidad-bloque">
        <h2>3. Derechos del Titular (LOPDP Ecuador)</h2>
        <p>
          De conformidad con la normativa ecuatoriana, usted tiene derecho a solicitar el <strong>acceso</strong>, <strong>rectificación</strong>, <strong>actualización</strong> y <strong>eliminación</strong> de sus datos personales registrados en el sistema en cualquier momento.
        </p>
      </section>

      <section class="privacidad-bloque">
        <h2>4. Contacto de Privacidad</h2>
        <p>
          Para ejercer sus derechos o resolver inquietudes sobre el tratamiento de su información, puede comunicarse al correo oficial de contacto: <a href="mailto:privacidad@ecosistemaeducativo.edu.ec">privacidad@ecosistemaeducativo.edu.ec</a>.
        </p>
      </section>

      <div class="fila" style="margin-top: var(--espacio-xl);">
        <a href="/paginas/registro.html" class="btn btn--secundario btn--pequeno">← Volver al Registro</a>
      </div>
    </article>
  `;
}

