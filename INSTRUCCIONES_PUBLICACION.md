# 🚀 Guía de Despliegue en Render.com

Repositorio oficial: [https://github.com/ccontrerasm4-beep/competencias-b7](https://github.com/ccontrerasm4-beep/competencias-b7)

---

## Paso 1: Subir tus archivos al repositorio de GitHub

Para que Render pueda compilar y desplegar tu proyecto, tu repositorio debe tener los archivos actualizados del proyecto. Puedes hacerlo de dos formas:

### Opción A (Vía Web de GitHub - Súper fácil):
1. Entra a tu repositorio: [https://github.com/ccontrerasm4-beep/competencias-b7](https://github.com/ccontrerasm4-beep/competencias-b7)
2. Haz clic en el botón **Add file** > **Upload files**.
3. Descomprime `ecosistema-educativo.zip` en tu computadora y arrastra todas las carpetas (`servidor`, `publico`, `datos`, `docs`) y archivos (`package.json`, `render.yaml`, etc.).
4. Haz clic en **Commit changes**.

### Opción B (Con GitHub Desktop):
1. Abre GitHub Desktop y clona tu repositorio `competencias-b7`.
2. Copia todo el contenido de esta carpeta dentro de la carpeta del repositorio.
3. Haz Commit y pulsa **Push origin**.

---

## Paso 2: Conectar y Desplegar en Render.com

1. Inicia sesión en [https://dashboard.render.com](https://dashboard.render.com) (puedes entrar directamente con tu cuenta de GitHub).
2. Haz clic en el botón superior **New +** y selecciona **Web Service**.
3. Selecciona tu repositorio de GitHub: **`ccontrerasm4-beep/competencias-b7`** y haz clic en **Connect**.
4. Configura los siguientes campos (Render suele detectarlos solo gracias al archivo `render.yaml`):
   - **Name:** `ecosistema-educativo` (o el nombre que prefieras).
   - **Region:** Elige la más cercana (ej. *Oregon* o *Ohio*).
   - **Branch:** `main` (o `master`).
   - **Root Directory:** *(dejar vacío)*.
   - **Runtime:** `Node`.
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (Plan gratuito).
5. En la sección **Environment Variables** (Variables de entorno), haz clic en **Add Environment Variable**:
   - `NODE_VERSION` = `20`
   - `IA_PROVEEDOR` = `gemini`
   - `IA_MODELO` = `gemini-2.5-flash`
   - `IA_CLAVE` = *(Tu API Key de Gemini, si deseas que el tutor IA responda online)*
6. Haz clic en el botón **Deploy Web Service** (o **Create Web Service**).

---

## Paso 3: ¡Listo! Tu plataforma estará en vivo

Render tardará aproximadamente 1 a 2 minutos en ejecutar `npm install` y encender el servidor.
Te proporcionará una URL pública y segura con HTTPS del tipo:
`https://ecosistema-educativo.onrender.com`

Todas las funciones (Login, Mis Asignaturas, Contenidos, Quizzes, Banco de preguntas y Tutor Socrático) funcionarán al 100%.
