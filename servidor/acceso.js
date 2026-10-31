import * as almacen from './almacen.js';

/**
 * Retorna los grupos de distributivo según el rol del usuario:
 * - admin: todos los grupos
 * - docente: grupos donde docenteId === usuario.id
 * - estudiante: grupos donde estudiantes incluye a usuario.id
 */
export async function gruposDe(usuario) {
  if (!usuario) return [];

  const todos = await almacen.leer('distributivo');

  if (usuario.rol === 'admin') {
    return todos;
  }

  if (usuario.rol === 'docente') {
    return todos.filter((g) => g.docenteId === usuario.id);
  }

  if (usuario.rol === 'estudiante') {
    return todos.filter(
      (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id)
    );
  }

  return [];
}

/**
 * Retorna las asignaturas accesibles para el usuario según sus grupos
 * (el admin accede a todas las asignaturas).
 */
export async function asignaturasDe(usuario) {
  if (!usuario) return [];

  const todas = await almacen.leer('asignaturas');

  if (usuario.rol === 'admin') {
    return todas;
  }

  const grupos = await gruposDe(usuario);
  const idsAsignaturas = new Set(grupos.map((g) => g.asignaturaId).filter(Boolean));

  return todas.filter((a) => idsAsignaturas.has(a.id));
}

/**
 * Resuelve un temaId hacia su asignatura correspondiente (tema -> unidad -> asignatura).
 */
export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;

  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find((u) => u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  const asignaturas = await almacen.leer('asignaturas');
  return asignaturas.find((a) => a.id === unidad.asignaturaId) || null;
}

/**
 * Determina si el usuario tiene permiso para editar la asignatura indicada:
 * - admin: puede editar cualquier asignatura
 * - docente: puede editar si es docente de al menos un grupo de esa asignatura
 */
export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;

  if (usuario.rol === 'admin') {
    return true;
  }

  if (usuario.rol === 'docente') {
    const grupos = await gruposDe(usuario);
    return grupos.some((g) => g.asignaturaId === asignaturaId);
  }

  return false;
}

/**
 * Retorna los usuarios estudiantes vinculados a los grupos del docente indicado.
 */
export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];

  const todos = await almacen.leer('distributivo');
  const gruposDocente = todos.filter((g) => g.docenteId === docenteId);

  const idsEstudiantes = new Set();
  for (const g of gruposDocente) {
    if (Array.isArray(g.estudiantes)) {
      for (const eId of g.estudiantes) {
        idsEstudiantes.add(eId);
      }
    }
  }

  if (idsEstudiantes.size === 0) return [];

  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter((u) => idsEstudiantes.has(u.id));
}

/**
 * Retorna los usuarios docentes vinculados a los grupos del estudiante indicado.
 */
export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];

  const todos = await almacen.leer('distributivo');
  const gruposEstudiante = todos.filter(
    (g) => Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
  );

  const idsDocentes = new Set(gruposEstudiante.map((g) => g.docenteId).filter(Boolean));
  if (idsDocentes.size === 0) return [];

  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter((u) => idsDocentes.has(u.id));
}

