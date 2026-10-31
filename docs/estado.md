# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S01 · Fecha: 2026-10-29 · Velocidad real: __ puntos

## Funciona
- Servidor base y almacenamiento seguro (P00.1): API genérica (/api/:col, /api/:col/:id), permisos, ganchos y respaldos automáticos diarios.
- Núcleo del navegador (P00.2): api.js (cliente REST/fetch, token, 401), ui.js (aviso, modal, confirmar, cargando, escapar, limpiar) y util.js (normalizar, barajar, fechaLarga, fechaRelativa, parametro, formatoBasico).
- Design system en CSS (P00.3): tokens.css, base.css, componentes.css y guia-estilos.html con contraste AA y responsive desde 360 px.
- Menú, plantilla y prueba (P00.4): menu.js, plantilla.js (montarPlantilla), layout responsivo en base.css, index.html (inicio) y paginas/prueba-datos.html con api.crear, api.listar y ui.aviso.
- Autenticación, sesiones y bitácora (P01.1): auth.js (cargarUsuario, exigirRol, limpieza sesiones), rutas/auth.js (registro, login con rate limit 5/15m, logout, yo, perfil, clave, restablecer, eventos), ganchos/usuarios.js, permisos.json y crear-admin.js.
- Registro, ingreso y sesión cliente (P01.2): sesion.js (sessionStorage, exigirRol), bitacora.js (registrarEvento), registro.html (validación en vivo, consentimiento, auto-login), ingreso.html, privacidad.html (LOPDP) y plantilla.js con control de sesión en encabezado y menú dinámico.
- Perfil, usuarios y subidas (P01.3): rutas/subidas.js (multer, JPG/PNG/WEBP máx 2MB), perfil.html (edición, foto con api.subir, cambio de clave), admin-usuarios.html (tabla, filtros, cambio rol/activo y restablecer con modal) y enlaces en menu.js.

## Decisiones y cambios respecto a docs/contratos.md
-

## Problemas conocidos
-

## Pendiente para el siguiente sprint
-
