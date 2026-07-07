# PRD — Hardening de seguridad y calidad de Factory Hub

- **Autor:** Adriano (con revisión asistida por Claude Code)
- **Fecha:** 2026-07-06
- **Estado:** F1 aplicada en producción el 2026-07-06 (migraciones `security_hardening_f1` + `_followup`, verificada con tests por rol). F2–F4 pendientes.
- **Repositorio:** factory-hub (React 19 + Vite + Supabase, SPA en Vercel)

## 1. Contexto y problema

Factory Hub es la herramienta interna de gestión (proyectos, tareas, tickets, leads, colaboración) con autenticación vía Supabase. Una revisión completa del repo (2026-07-06) encontró que **la capa de autorización tiene huecos críticos**: cualquier usuario autenticado puede escalarse a admin, y los permisos por rol que la UI aparenta imponer no existen ni en las rutas ni en las políticas RLS de la base de datos.

Como la app es 100% cliente (browser → Supabase con anon key), **RLS es la única capa real de autorización**. Todo lo que la UI "esconde" es accesible por consola del navegador.

Además hay deuda de calidad que ya produce bugs visibles: los tipos de la base de datos están desactualizados (42 errores de `tsc` que el build no detecta), formularios con estado stale y manejo de fechas roto en edición de leads.

## 2. Objetivos

1. **Cerrar la escalación de privilegios**: ningún usuario puede cambiar su propio `role` ni `allowed_modules`, ni nacer con rol elevado vía signup.
2. **Alinear autorización con el modelo de roles existente** (`admin`, `developer`, `support`, `closer`, `marketing`) en las tres capas: RLS (fuente de verdad), rutas y UI.
3. **Que el pipeline detecte regresiones**: typecheck y lint bloqueantes en build.
4. Corregir los bugs funcionales confirmados (auth race, formularios, fechas).

### No-objetivos (fuera de alcance)

- Migrar a backend propio o server-side rendering.
- Rediseñar el modelo de roles/permisos (se mantiene el enum actual + `allowed_modules`).
- Auditoría de dependencias / supply chain.
- Features nuevas de producto.

## 3. Usuarios afectados

- **Todos los usuarios internos**: hoy cualquiera con cuenta puede leer/modificar datos de cualquier módulo y auto-promoverse a admin.
- **Admins**: hoy su rol no otorga nada exclusivo en la práctica; después del fix, gestión de usuarios y asignación de roles queda solo en ellos.

## 4. Requerimientos

### P0 — Seguridad crítica (bloquea todo lo demás)

| ID | Requerimiento | Detalle | Criterio de aceptación |
|----|---------------|---------|------------------------|
| S1 | Impedir auto-escalación de rol | Política RLS de `profiles` no debe permitir que un usuario modifique su propio `role` ni `allowed_modules`. Separar en política de columnas o trigger de validación; solo admins cambian roles. | `update profiles set role='admin'` con sesión de usuario normal → rechazado por RLS. Test manual desde consola del navegador documentado. |
| S2 | Signup no confiable | `handle_new_user` no debe leer `role` ni `allowed_modules` desde `raw_user_meta_data` (controlado por el cliente). Rol inicial fijo `developer` (o el mínimo); asignación posterior solo por admin. Evaluar además deshabilitar signups públicos en el proyecto Supabase si la creación de usuarios es solo por admins. | `signUp` con `options.data.role='admin'` → perfil creado con rol mínimo. |
| S3 | Notificaciones no spameables | Reemplazar `with check (true)` en insert de `notifications` por función `security definer` o check de emisor válido. | Usuario no puede insertar notificaciones arbitrarias a otros. |
| S4 | RLS por membresía de proyecto | Políticas de `projects`, `objectives`, `tasks` y `project_members` deben respetar la membresía (feature del commit `3b6eeac`): developers solo gestionan proyectos donde son miembros; admins todo. | Developer no-miembro no puede modificar/borrar proyecto ajeno ni sus tareas. |

### P1 — Autorización en app (defensa en profundidad)

| ID | Requerimiento | Detalle | Criterio de aceptación |
|----|---------------|---------|------------------------|
| A1 | Rutas gateadas por rol/módulo | Usar `allowedRoles` (ya existe en `ProtectedRoute`) o gate por `allowed_modules` en cada ruta: `/usuarios` solo admin; resto según módulos permitidos. | URL directa a `/usuarios` con usuario no-admin → redirect a `/`. |
| A2 | Cerrar bypass de rol null | `ProtectedRoute` debe **negar** mientras `role` es `null`/cargando, no dejar pasar. Requiere arreglar el race de `fetchProfile` sin `await` en `useAuth` (loading debe cubrir usuario **y** perfil). | Refresh en ruta protegida nunca renderiza contenido antes de conocer el rol. |
| A3 | Sidebar coherente | `AppSidebar` muestra solo módulos permitidos para el rol (si no lo hace ya, alinear con A1). | Menú y acceso real coinciden. |

### P2 — Pipeline y tipos

| ID | Requerimiento | Detalle | Criterio de aceptación |
|----|---------------|---------|------------------------|
| T1 | Tipos regenerados | Regenerar `src/types/database.ts` desde la DB real (`supabase gen types typescript`), incluyendo FKs, `email`, `allowed_modules`, `escalated_task_id`. Eliminar casts manuales a `SelectQueryError`. | `tsc --noEmit` en 0 errores. |
| T2 | Build bloqueante | Script `build` pasa a `tsc --noEmit && vite build` (o CI equivalente). Lint sin errores (warnings tolerados temporalmente). | Build falla ante error de tipos; `eslint .` en 0 errores. |
| T3 | `schema.sql` como fuente de verdad | Consolidar `schema.sql` + migraciones para que reflejen la DB real, o declarar migraciones como única fuente y marcar `schema.sql` como snapshot generado. | Nuevo entorno reproducible desde los SQL del repo. |

### P3 — Bugs funcionales y housekeeping

| ID | Requerimiento | Detalle |
|----|---------------|---------|
| B1 | Fecha en edición de lead | `LeadModal`: convertir ISO → `YYYY-MM-DD` al poblar `<input type="date">`. |
| B2 | Reset de formularios | `ProjectModal` y `TicketModal`: `reset()` al abrir para no mostrar estado stale. |
| B3 | Errores de dashboard visibles | `useDashboard`: chequear `.error` de cada query del `Promise.all`; propagar o mostrar estado parcial. |
| B4 | Carrera en creación de usuario | `useUsers`: reemplazar `setTimeout(500)` por poll de existencia del perfil con timeout. |
| B5 | `.env` fuera del repo | Agregar `.env` a `.gitignore`, commitear `.env.example` con placeholders. (Anon key es pública por diseño; no requiere rotación, pero documentar.) |
| B6 | Security headers | `vercel.json`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, CSP básica compatible con Supabase/Excalidraw. |

## 5. Plan de entrega

| Fase | Contenido | Dependencias |
|------|-----------|--------------|
| **F1** | S1–S4 (migración SQL nueva, no editar schema viejo) + prueba manual de cada política | Acceso al proyecto Supabase para aplicar migración |
| **F2** | A1–A3 (rutas, auth race, sidebar) | F1 (para probar contra RLS real) |
| **F3** | T1–T3 (tipos, build, consolidación SQL) | F1 aplicada (tipos se generan de la DB ya corregida) |
| **F4** | B1–B6 | Independiente; puede ir en paralelo a F2/F3 |

Cada fase = una migración/PR revisable por separado. F1 se aplica en Supabase **antes** de mergear F2 para no romper la app en producción.

## 6. Riesgos y mitigaciones

- **Endurecer RLS puede romper flujos existentes** (queries que hoy funcionan por permisividad). Mitigación: probar cada módulo con un usuario por rol antes de aplicar en producción; tener el SQL de rollback de cada política.
- **Usuarios ya escalados**: si alguien ya se auto-promovió, el fix no lo revierte. Mitigación: auditar `profiles.role` contra la lista esperada de admins al aplicar F1.
- **Regenerar tipos puede revelar más errores** de los 42 conocidos. Mitigación: presupuestar F3 con holgura; los casts manuales existentes marcan los puntos a tocar.
- **Signups públicos**: si se deshabilitan y el alta de usuarios depende de un flujo admin, verificar que `UserModal`/`useUsers` no dependan de `signUp` del cliente con privilegios.

## 7. Métricas de éxito

- 0 vías de auto-escalación (S1/S2 verificados manualmente y documentados).
- `tsc --noEmit` y `eslint .` en 0 errores, bloqueantes en build.
- Matriz rol × módulo verificada: cada rol accede solo a lo permitido, por URL directa y por API (consola).

## 8. Anexo — Hallazgos de origen

Revisión del 2026-07-06 sobre `main@3b6eeac`:

- Escalación de privilegios: `supabase/schema.sql:35-36` (update de profiles sin `WITH CHECK`), `supabase/migrations/001_fix_handle_new_user.sql:17` (rol desde metadata de cliente).
- Notificaciones: `supabase/schema.sql:359-360` (`with check (true)`).
- RLS sin membresía: `supabase/schema.sql:74-125`, `supabase/migrations/20260415_project_members.sql:32-40`.
- Rutas sin gate: `src/App.tsx:71-76`; bypass rol null: `src/components/layout/ProtectedRoute.tsx:24` + `src/hooks/useAuth.ts:46,68`.
- Tipos desactualizados: 42 errores `tsc`; lint: 40 errores / 16 warnings.
- Bugs UI: `src/components/marketing/LeadModal.tsx:73`, `ProjectModal`, `TicketModal`, `src/hooks/useDashboard.ts`, `src/hooks/useUsers.ts:67`.
- Config: `.env` trackeado desde el primer commit; `vercel.json` sin headers.
