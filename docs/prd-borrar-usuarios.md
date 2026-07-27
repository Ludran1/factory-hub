# PRD — Borrado de usuarios desde el módulo Usuarios

- **Autor:** Adriano (con revisión asistida por Claude Code)
- **Fecha:** 2026-07-27
- **Estado:** Borrador — pendiente de aprobación
- **Repositorio:** factory-hub (React 19 + Vite + Supabase, SPA en Vercel)
- **Relacionado:** `docs/prd-hardening.md` (F1 aplicada; este PRD sigue el mismo patrón admin-only vía Edge Function que `create-user`)

## 1. Contexto y problema

El módulo **Usuarios** (`/usuarios`) permite crear usuarios (Edge Function `create-user`), editar nombre/rol/módulos y enviar reset de contraseña, pero **no permite eliminarlos**. Hoy dar de baja a alguien exige entrar al dashboard de Supabase (Authentication → Users), que:

- Requiere acceso al proyecto Supabase (solo Adriano lo tiene; los demás admins de la app no).
- No valida reglas de negocio de la app (nada impide borrar al último admin o borrarse a uno mismo).
- Queda fuera del flujo natural de gestión que la página Usuarios ya centraliza.

Restricción técnica: borrar en `auth.users` requiere la **Admin API con service role key**, que jamás puede llegar al browser. Por diseño (app 100% cliente con anon key), el borrado **debe** pasar por una Edge Function, igual que el alta.

## 2. Objetivos

1. Un admin puede eliminar a un usuario desde la página Usuarios, con confirmación explícita.
2. El borrado es completo: cuenta de `auth.users` + perfil + datos dependientes según las reglas de cascade ya definidas en el esquema.
3. Imposible dejar el sistema sin administradores o auto-eliminarse por accidente.

### No-objetivos (fuera de alcance)

- Desactivación/suspensión reversible de cuentas (soft delete). Si se necesita, es otro PRD.
- Reasignación interactiva de tareas/tickets del usuario borrado (quedan sin asignar, ver §4.3).
- Borrado masivo (multi-select).
- Auditoría/log de quién borró a quién (deseable futuro, no bloqueante).

## 3. Usuarios afectados

- **Admins**: ganan la capacidad de dar de baja miembros sin depender del dashboard de Supabase.
- **Resto de roles**: sin cambios; no ven ni pueden invocar el borrado.

## 4. Requerimientos

### 4.1 Funcionales

| ID | Requerimiento | Detalle | Criterio de aceptación |
|----|---------------|---------|------------------------|
| D1 | Edge Function `delete-user` | Nueva función en `supabase/functions/delete-user/index.ts`, espejo de `create-user`: valida JWT del llamador, verifica `role = 'admin'` en su profile, y ejecuta `auth.admin.deleteUser(user_id)` con service role. Recibe `{ user_id }` (el `auth.users.id`, no el id del profile). | Llamada con JWT de no-admin → 403. Sin JWT → 401. `user_id` inexistente → 404. |
| D2 | Guarda: no auto-borrado | La función rechaza si `user_id` == id del llamador. | Admin intenta borrarse a sí mismo → 400 con mensaje claro. |
| D3 | Guarda: último admin | La función rechaza si el objetivo es admin y es el único con `role = 'admin'` en `profiles`. | Con 1 solo admin en el sistema, borrar a ese admin → 400 "No se puede eliminar al último admin". Con 2+ admins, sí se permite. |
| D4 | Botón en la tabla | Icono 🗑️ (`Trash2`) en la columna Acciones de `UsersPage`, junto a editar y reset. Deshabilitado (con tooltip) sobre la propia fila del usuario logueado. | Botón visible para cada fila; el de la fila propia no ejecuta. |
| D5 | Confirmación explícita | Diálogo de confirmación (AlertDialog) antes de borrar: nombre del usuario + advertencia de irreversibilidad y de qué pasa con sus datos (§4.3). Botón destructivo "Eliminar". | No existe camino de un solo click al borrado. |
| D6 | Hook `useDeleteUser` | En `src/hooks/useUsers.ts`, `useMutation` que invoca la función con `supabase.functions.invoke('delete-user')`, extrae el mensaje de error del body (mismo patrón `FunctionsHttpError` de `useCreateUser`) e invalida las queries `['users']` y `['profiles', 'all']`. | Éxito → toast + fila desaparece sin recargar. Error → toast con el mensaje real de la función (no genérico). |

### 4.2 Seguridad

| ID | Requerimiento | Detalle |
|----|---------------|---------|
| SEC1 | Autorización server-side | La única validación que cuenta es la de la Edge Function (JWT + profile admin). Ocultar/deshabilitar el botón en UI es solo UX; un no-admin llamando a la función por consola debe recibir 403. |
| SEC2 | Service role confinada | La service role key vive solo en secrets de la Edge Function (ya configurado para `create-user`). Nada nuevo llega al cliente. |
| SEC3 | Sin RLS nueva | No se abre ninguna política de DELETE sobre `profiles` al rol `authenticated`: el borrado del profile ocurre por cascade de `auth.users`, ejecutado con service role. |

### 4.3 Efecto en datos (cascade existente, verificado en esquema)

Al borrar en `auth.users`, `profiles.user_id` tiene `on delete cascade` → el profile cae, y desde el profile:

- **Se borran** (cascade): membresías en `project_members`, notificaciones, comentarios en tickets y leads, posts de colaboración del usuario.
- **Quedan sin asignar** (`set null`): tareas (`assignee_id`), tickets (`assigned_to`), leads (`assigned_to`), proyectos donde era owner (`owner_id`), `updated_by` de recursos.

El diálogo de confirmación (D5) debe decir esto en una línea: *"Se eliminarán sus comentarios y notificaciones; sus tareas y tickets quedarán sin asignar."*

## 5. Plan de entrega

Una sola fase, un PR:

| Paso | Contenido |
|------|-----------|
| 1 | Edge Function `delete-user` (D1–D3) |
| 2 | `useDeleteUser` en `useUsers.ts` (D6) |
| 3 | Botón + AlertDialog en `UsersPage` (D4–D5) |
| 4 | Deploy: `supabase functions deploy delete-user` (mismo flujo que `create-user`) |
| 5 | Verificación manual (§7) |

Sin migración SQL: no cambia el esquema ni las políticas.

## 6. Riesgos y mitigaciones

- **Borrado irreversible con pérdida de comentarios**: es el comportamiento del cascade actual. Mitigación: advertencia explícita en el diálogo (D5). Si más adelante duele, el camino es soft delete (fuera de alcance, §2).
- **Carrera último-admin**: dos admins borrándose mutuamente a la vez podrían dejar 0 admins. Riesgo aceptado (equipo de 6, ventana de milisegundos); el chequeo D3 se hace server-side justo antes del delete, no en la UI.
- **Usuario borrado con sesión activa**: su JWT sigue siendo válido hasta expirar, pero sin profile las políticas RLS le niegan todo y la app lo expulsa al no poder cargar el perfil. Verificar en §7.

## 7. Verificación (criterio de cierre)

Matriz manual antes de dar por cerrado:

1. Admin borra a un developer → desaparece de la tabla, no puede volver a loguearse, sus tareas quedan sin asignar.
2. Admin intenta borrarse a sí mismo → botón deshabilitado; por consola (invoke directo) → 400.
3. No-admin invoca `delete-user` por consola con su JWT → 403.
4. Sistema con un solo admin → borrar a ese admin (por consola) → 400.
5. Usuario borrado con pestaña abierta → siguiente navegación lo saca a login.

## 8. Métricas de éxito

- 0 accesos al dashboard de Supabase para bajas de usuario después del deploy.
- Matriz §7 completa y documentada en el PR.
