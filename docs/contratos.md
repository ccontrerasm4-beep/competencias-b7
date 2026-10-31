# docs/contratos.md · Contratos del proyecto (v1)
Firmas públicas acordadas. Se implementan tal cual; los cambios se anotan en docs/estado.md.

## §A. Núcleo del navegador (publico/js/nucleo/)
api.js
  listar(col, filtros = {})       GET    /api/:col?campo=valor   → Array
  obtener(col, id)                GET    /api/:col/:id           → Object
  crear(col, datos)               POST   /api/:col               → Object con id
  actualizar(col, id, cambios)    PUT    /api/:col/:id           → Object (fusiona campos)
  eliminar(col, id)               DELETE /api/:col/:id
  llamar(metodo, ruta, cuerpo)    cualquier ruta /api/...        → JSON
  subir(archivo)                  POST   /api/subidas (campo "archivo") → { url }
  ia(tarea, datos)                POST   /api/ia/:tarea          → JSON
  · Envía "Authorization: Bearer <token>" (sessionStorage "token").
  · 401 → borra la sesión y abre /paginas/ingreso.html. Otro error → throw Error(mensaje).
ui.js        aviso(texto, tipo = "info" | "exito" | "error") · confirmar(texto) → Promise<bool>
             modal({ titulo, contenido, acciones }) → Promise<valor | null>
             cargando(bool) · escapar(texto) · limpiar(html)
util.js      normalizar(texto) · barajar(lista) · fechaLarga(iso) · fechaRelativa(iso)
             parametro(nombre) · formatoBasico(texto) → HTML seguro
menu.js      MENU = [{ texto, href, roles }]
             roles: publico | sesion | estudiante | docente | admin
plantilla.js montarPlantilla({ titulo, roles }) → encabezado, menú filtrado y pie; exige rol
sesion.js    registrar(datos) · iniciar(correo, clave) · cerrar() · token() · exigirRol(roles)
             usuarioActual() → { id, nombre, apellido, rol } | null
bitacora.js  registrarEvento(tipo, recurso)
catalogo-actividades.js  ACTIVIDADES = [{ id, texto, descripcion, href }]  (href sin parámetros)
selector-tema.js  obtenerTemaActividad() → Promise<tema>  (usa ?temaId= o muestra un selector)
retroalimentacion.js  mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema })
             mostrarResumen({ titulo, aciertos, errores, recomendaciones, enlaceTema })
               → Promise<"repetir" | "salir">
gamificacion.js  registrarIntento({ actividad, temaId, nivel, puntaje, maximo, errores,
               duracionSeg, detalle }) → { puntosGanados, puntosTotales, insigniasNuevas }
             mostrarLogros(resultado)
             logrosDe(usuarioId = "yo") → { puntos, insignias, nivelQuiz }
pdf.js       generarDiploma({ tipo: "cumplimiento" | "nivel-quiz", temaId, nivel }) → { codigo }
notificaciones.js  montarCampana() · noLeidas() → número
avatar.js    montarAvatar() · decir(texto)
             cambiarEstado("reposo" | "hablando" | "pensando" | "celebrando")

## §B. Servidor (servidor/) · todas las funciones de datos son async
almacen.js   leer(col) · escribir(col, lista) · agregar(col, reg) → reg (asigna id y fecha)
             actualizar(col, id, cambios) → reg · eliminar(col, id)
             buscar(col, filtro) → Array · anexarLinea(archivo, obj)
             leerLineas(archivo) → Array · leerConfig(nombre) → Object
             · col admite subcarpeta ("mensajes/con_000001"). Id: 3 letras + "_" + 6 dígitos.
permisos.js  puede(usuario, accion "leer" | "escribir", col, registro) → boolean
ganchos.js   carga servidor/ganchos/<col>.js → { filtrarLista(lista, usuario),
             antesDeGuardar(datos, usuario, anterior),
             despuesDeGuardar(reg, usuario, anterior) }
             aplicar(col, nombre, ...args) · un gancho rechaza con Error y propiedad estado
acceso.js    gruposDe(usuario) · asignaturasDe(usuario) · asignaturaDeTema(temaId)
             puedeEditarAsignatura(usuario, asignaturaId) · estudiantesDe(docenteId)
             docentesDe(estudianteId)
auth.js      cargarUsuario (pone req.usuario) · exigirRol(...roles)
gamificacion.js  procesarIntento(usuario, intento) → { puntosGanados, puntosTotales,
             insigniasNuevas }   (lo usan /api/intentos, el quiz y los foros)
notificar.js notificar(usuarioId, { tipo, mensaje, enlace })
alertas.js   evaluarAlertas(intento, usuario) · evaluarInactividad(grupoId)
ia.js        ejecutarTarea(tarea, datos, usuario, { formato: "json" | "texto" }) → resultado
rutas/<grupo>.js         export default Router; se monta en /api antes de la API genérica
preparadores/<tarea>.js  export default async (cuerpo, usuario) → datos para la plantilla
prompts/<tarea>.txt      plantilla con {{claves}}; "### USUARIO" separa sistema y usuario

## §C. Rutas especiales (con sesión, salvo indicación)
Genérica  GET|POST /api/:col · GET|PUT|DELETE /api/:col/:id   (permisos.json + ganchos)
Auth      POST /api/auth/registro · POST /api/auth/login (sin sesión) · POST /api/auth/logout
          GET /api/auth/yo · PUT /api/auth/perfil · POST /api/auth/clave
Admin     POST /api/admin/usuarios/:id/restablecer
Archivos  POST /api/subidas · POST /api/eventos
Gamif.    POST /api/intentos · GET /api/logros/:usuarioId ("yo" permitido)
Certif.   GET /api/certificados/estado · POST /api/certificados
          GET /api/certificados/verificar/:codigo (sin sesión)
Resumen   GET /api/resumen/estudiante/:id ("yo") · GET /api/resumen/grupo/:grupoId
          GET /api/resumen/tutor/:grupoId
Notif.    GET /api/notificaciones · POST /api/notificaciones
          POST /api/notificaciones/:id/leida · POST /api/notificaciones/leidas
Alertas   GET /api/alertas?grupoId= → { alertas, mensajesApoyo }
IA        POST /api/ia/:tarea   tareas: generar-glosario, generar-preguntas, generar-escenario,
          tutor, rol-simulacion, evaluar-rol · GET /api/ia/prueba (admin)
Quiz      GET /api/quiz/estado?temaId= · POST /api/quiz/iniciar · POST /api/quiz/responder
          POST /api/quiz/finalizar
Agenda    GET /api/agenda/recordatorios
Mensajes  GET /api/mensajes/contactos · GET|POST /api/mensajes/conversaciones
          GET /api/mensajes/no-leidos · GET /api/mensajes/:convId?desde=&antes=
          POST /api/mensajes/:convId · POST /api/mensajes/:convId/leido
          POST /api/mensajes/difusion · POST /api/mensajes/bloquear
          DELETE /api/mensajes/bloquear/:usuarioId
          GET /api/mensajes/reporte/:reporteId (admin) · POST /api/mensajes/ocultar (admin)

## §D. Colecciones (datos/<col>.json) · todas con id y fecha (ISO)
usuarios          nombre, apellido, correo, claveHash, rol, activo, foto,
                  consentimiento{aceptado, fecha}
sesiones          token, usuarioId, expira
bitacora.jsonl    usuarioId, tipo, recurso, fecha
asignaturas       nombre, descripcion, nivel
distributivo      asignaturaId, paralelo, periodo, docenteId, estudiantes[]
unidades          asignaturaId, titulo, orden, visible
temas             unidadId, titulo, orden, objetivos[], resumen, ejemplos[],
                  erroresFrecuentes[], preguntasGuia[], recursos[{tipo, titulo, url}],
                  palabrasClave[], dificultad, fuentes, estado(borrador|publicado)
glosario          temaId, termino, definicion, pista, retroalimentacion,
                  origen(docente|ia), estado(aprobado)
progreso-temas    usuarioId, temaId
noticias          titulo, resumen, cuerpo, imagen, categoria, temaId, destacada,
                  estado(borrador|publicado), autorId, fechaPublicacion
lecturas-noticias usuarioId, noticiaId
canciones         titulo, temaId, audio, letra, lrc, autoria, licencia
insignias         nombre, descripcion, icono, condicion{tipo, ...}
intentos          usuarioId, actividad, temaId, nivel, puntaje, maximo, errores,
                  duracionSeg, detalle, puntos
logros            usuarioId, puntos, insignias[{id, fecha}], nivelQuiz{temaId: n}
certificados      codigo, usuarioId, tipo, detalle, nombreCompleto
notificaciones    usuarioId, tipo, mensaje, enlace, leida
alertas           estudianteId, docenteId, grupoId, regla, temaId, detalle,
                  estado(activa|atendida)
consumo-ia.jsonl  usuarioId, tarea, entrada, salida, ok, fecha
preguntas         temaId, nivel(1-5), tipo(opcion|vf|completar), enunciado, opciones[],
                  correcta(índice | true/false | texto), retroalimentacion, origen, estado
quiz-sesiones     usuarioId, temaId, nivel, preguntasIds[], respuestas{}, inicio, finalizada
foros-hilos       asignaturaId, temaId, titulo, texto, autorId, fijado, cerrado, oculto,
                  ultimoMovimiento
foros-respuestas  hiloId, texto, autorId, destacada, oculta
reportes          tipo(foro|mensaje), referenciaId, motivo, reportadoPor,
                  estado(pendiente|resuelto)
agenda            titulo, tipo(tarea|reunion|fecha-limite|recordatorio), inicio, fin,
                  todoElDia, propietarioId, grupoId, actividad, temaId,
                  recordatorios[minutos], avisados{usuarioId: [minutos]}
conversaciones    participantes[], ultimo{texto, fecha, autorId}, leidoHasta{usuarioId: fecha}
mensajes/<convId> autorId, texto, oculto
bloqueos          usuarioId, bloqueadoId
consultas-tutor   usuarioId, temaId, dia, mensajes
simulaciones      temaId, titulo, modo(escenarios|rol), estado, escenaInicial,
                  escenas[{id, texto, imagen,
                           opciones[{texto, destino, puntos, consecuencia}]}],
                  personaje{nombre, descripcion, contexto, objetivo},
                  rubrica[{criterio, descripcion, puntos}], maxTurnos

## §E. Configuración (datos/config/)
permisos.json            { "<col>": { "leer": [...], "escribir": [...] } }
                         valores: publico, sesion, estudiante, docente, admin, propio, servidor
ajustes.json             nombrePlataforma, maxSubidaMB, limiteIADiario, limiteTutorDiario,
                         chatEntreEstudiantes, alertasAdmin
reglas-gamificacion.json puntos, bonoSinErrores, unicas, requiereAprobado, maxDiario,
                         limiteIntentosHora, quiz{...}, certificado{...}   (Anexo A)
reglas-alertas.json      promedioBajo, fallosQuiz, inactividad, vencidas, mensajesApoyo[]
