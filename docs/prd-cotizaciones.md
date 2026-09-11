# PRD — Cotizaciones / Propuestas en Factory Hub

- **Autor:** Adriano (con revisión asistida por Claude Code)
- **Fecha:** 2026-09-10 (decisiones de §8 cerradas el 2026-09-11)
- **Estado:** **F1–F4 construidas y aplicadas en producción el 2026-09-11.** F5 pendiente por diseño (depende de uso real). Ver §11 para lo verificado y lo que falta probar.
- **Repositorio:** factory-hub (React 19 + Vite + Supabase, SPA en Vercel)
- **Relacionado:** `docs/prd-hardening.md` (RLS como única capa real de autorización; este PRD la respeta), `docs/prd-borrar-usuarios.md` (patrón de operaciones con privilegio elevado)

## 1. Contexto y problema

El módulo **Marketing / CRM** (`/marketing`) gestiona el pipeline: `leads` con `company`, `contact_*`, `product`, `value`, `stage` (prospecto → demo → negociación → cerrado), `owner_id` y `expected_close_date`, más actividades y tareas por lead.

Hay dos huecos:

1. **`leads.value` es un número escrito a mano.** No existe ningún artefacto que lo justifique. Las métricas de `MarketingPage` (Pipeline total, Cerrado, Conversión, En negociación) y el Dashboard se calculan sobre estimaciones a dedo, no sobre montos realmente ofertados.
2. **La propuesta se hace fuera del sistema** (Word/Canva/PDF suelto). No queda registro de qué se le envió a quién, con qué precio, ni si el cliente lo abrió. Cuando el cliente dice "pero tú me dijiste 3,500" no hay documento que consultar.

**Decisión ya tomada (no re-abrir):** esto va en Factory Hub, no en el Super Admin de PeakGym. El Super Admin está modelado sobre gimnasios/tenants y no da cabida a cotizar nada que no sea una suscripción del vertical. Para el caso "gimnasio quiere plan anual con descuento", la solución correcta allá es precio personalizado sobre el tenant + link de pago, no un cotizador.

## 2. Objetivos

1. Emitir una propuesta desde un lead, con líneas de precio y totales, en soles o dólares.
2. Compartirla por **link público** (sin adjuntar PDF) y saber si el cliente la abrió.
3. Que `leads.value` deje de ser a dedo: pasa a derivarse de la propuesta aceptada.
4. Historial de lo enviado: una propuesta enviada no se edita, se versiona.

### No-objetivos (fuera de alcance)

- Facturación electrónica, series autorizadas, OSE o cualquier integración SUNAT. Una cotización **no** es comprobante de pago; la restricción legal aparece recién en la factura/boleta.
- Firma electrónica legalmente vinculante. La aceptación por link es registro comercial, no firma digital certificada.
- Cobro / pasarela de pago desde la propuesta.
- Catálogo de servicios con múltiples listas de precios (price books). En F5 entra un catálogo plano, nada más.
- Cotizar suscripciones PeakGym (vive en Super Admin, ver §1).
- Desglose de IGV en el documento. Decidido en §8: se cotiza a precio final. La estructura queda preparada (`igv_rate` default 0) pero no se usa ni se muestra.
- Historial de tipo de cambio con fines contables. `fx_rates` guarda lo que hace falta para precargar un valor razonable, no es un libro de TC para SUNAT.
- Página de Configuración global. Los datos del emisor se editan desde un diálogo admin-only dentro de Cotizaciones (§4.1), no se crea un módulo nuevo.

## 3. Usuarios afectados

- **Closer**: gana emitir y enviar propuestas de sus propios leads. Es el usuario principal.
- **Marketing**: ve todas las propuestas (lectura), igual que hoy ve todos los leads.
- **Admin**: todo, incluida cotización sin lead asociado.
- **Cliente externo (anónimo)**: actor nuevo. Abre un link público, lee y acepta/rechaza. Nunca se autentica.
- **Resto de roles** (`developer`, `support`): sin cambios, no ven el módulo.

## 4. Ubicación en el producto — el "dónde"

**Decisión: submódulo dentro de Marketing / CRM. No se agrega ítem nuevo al sidebar.**

### 4.1 Puntos de entrada

| # | Lugar | Qué hace | Archivo |
|---|-------|----------|---------|
| 1 | **Sección "Cotizaciones" dentro de `LeadPanel`** | Entrada principal. Lista las cotizaciones de ese lead + botón "Nueva cotización". Mismo patrón visual que las secciones de Actividad y Tareas que el panel ya tiene. | `src/components/marketing/LeadPanel.tsx` |
| 2 | **Tercera pestaña en `/marketing`** | `Pipeline · Tabla · Cotizaciones`. Listado global con filtro por estado, para ver todo sin entrar lead por lead. El `Tabs` ya existe en la página. | `src/pages/MarketingPage.tsx` |
| 3 | **Ruta de detalle `/marketing/cotizacion/:id`** | El editor a pantalla completa. No cabe en un `Sheet` ni en un `Dialog`: son líneas editables + totales + vista previa del documento. | `src/pages/QuotePage.tsx` (nuevo) |
| 4 | **Ruta pública `/p/:token`** | Lo que ve el cliente. **Fuera de `ProtectedRoute`**, sin sidebar, sin `AppLayout`. | `src/pages/PublicQuotePage.tsx` (nuevo) |
| 5 | **Diálogo "Datos del emisor"** | Icono de engranaje en el header de la pestaña Cotizaciones, **solo admin**. Razón social, RUC, dirección, contacto, logo y términos por defecto. | `src/components/marketing/EmitterSettingsDialog.tsx` (nuevo) |

```
/marketing  ──► tab Cotizaciones ──┐
     │                             ├──► /marketing/cotizacion/:id  (editor, protegido)
     └──► LeadPanel ──► sección ───┘                │
                                                    │ "Enviar" congela + copia link
                                                    ▼
                                             /p/:token  (público, anon)
```

### 4.2 Permisos

Reusa el módulo **`marketing`** en `allowed_modules`. **No se crea un módulo nuevo.** Consecuencia práctica: nadie tiene que volver a configurar permisos de los usuarios existentes, y el filtro de `AppSidebar.tsx:49-54` sigue igual sin tocarse.

### 4.3 Por qué no un ítem propio en el sidebar

- La audiencia es exactamente la misma que ya entra a Marketing / CRM (closer, marketing, admin).
- El módulo no tiene vida propia sin el lead: el 100% de las cotizaciones de F1–F4 nacen de uno.
- El sidebar ya tiene 6 ítems; un séptimo para algo que se usa unas pocas veces por semana desbalancea la navegación.
- Evita migración de datos en `allowed_modules`.

**Cuándo se promueve a top-level:** si empiezas a cotizar a clientes recurrentes sin pasar por el pipeline (renovaciones, ampliaciones de alcance), `/cotizaciones` pasa a ser ruta propia. El cambio es una línea en `navItems` de `AppSidebar.tsx:18-24`, una ruta en `App.tsx`, y agregar `'cotizaciones'` a los `allowed_modules` de quien corresponda. El modelo de datos de §5 no cambia — por eso `quotes.lead_id` es nullable desde el día uno.

## 5. Modelo de datos

```sql
create type quote_status     as enum ('borrador','enviada','aceptada','rechazada','vencida');
create type quote_event_type as enum ('creada','enviada','vista','aceptada','rechazada','revisada');

create table quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,   -- nullable: ver 4.3
  number text unique not null,                            -- 'COT-2026-0001', lo pone un trigger
  version int not null default 1,
  parent_quote_id uuid references quotes(id) on delete set null,

  -- snapshot del cliente al emitir (NO join vivo a leads)
  client_company text not null,
  client_contact text,
  client_email text,
  client_doc text,                                        -- RUC / DNI
  client_address text,

  title text not null,
  currency text not null default 'PEN',                   -- 'PEN' | 'USD'
  fx_rate numeric not null default 1,                     -- soles por dólar al emitir; 1 si es PEN
  issue_date date not null default current_date,
  valid_until date,
  status quote_status not null default 'borrador',

  igv_rate numeric not null default 0,                    -- 0 = precio final, sin línea de impuesto
  subtotal  numeric not null default 0,                   -- los 5 los calcula un trigger
  discount  numeric not null default 0,
  igv       numeric not null default 0,
  total     numeric not null default 0,
  total_pen numeric not null default 0,                   -- total · fx_rate, solo para métricas

  terms text,
  owner_id uuid references profiles(id) on delete set null,
  public_token uuid not null unique default gen_random_uuid(),
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade not null,
  description text not null,
  detail text,                            -- línea secundaria opcional (alcance del ítem)
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,    -- monto absoluto, no %
  position int not null default 0
);

create table quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade not null,
  type quote_event_type not null,
  actor_id uuid references profiles(id) on delete set null,  -- null = el cliente desde el link
  meta jsonb,
  created_at timestamptz default now()
);

-- El lead hereda la moneda de su cotización aceptada (Q8).
-- Sin esto, "Pipeline total" suma soles con dólares y el número es basura.
alter table leads add column currency text not null default 'PEN';
alter table leads add column value_pen numeric not null default 0;

-- Datos del emisor: fila única, editable por admin (Q18).
create table org_settings (
  id boolean primary key default true check (id),   -- fuerza una sola fila
  legal_name text not null default '',
  ruc text not null default '',
  address text,
  email text,
  phone text,
  website text,
  logo_base64 text,                                 -- data URI; no hay bucket de Storage en el proyecto
  default_terms text,                               -- precarga quotes.terms
  updated_at timestamptz default now()
);
insert into org_settings (id) values (true) on conflict do nothing;

-- Caché de tipo de cambio (Q19). Una fila por día publicado.
create table fx_rates (
  date date primary key,
  usd_pen numeric not null,
  source text not null default 'BCRP PD04640PD',
  fetched_at timestamptz not null default now()
);
```

### 5.1 Decisiones de diseño y por qué

| Decisión | Razón |
|----------|-------|
| **Snapshot del cliente** en `quotes`, no join a `leads` | El documento no puede cambiar retroactivamente. Si corriges el nombre del contacto en el lead seis meses después, la cotización que enviaste debe seguir diciendo lo que decía. |
| **Totales guardados y calculados por trigger**, no por el cliente | La app es 100% browser con anon key: cualquiera puede escribir `total = 0` desde consola. El trigger recalcula desde `quote_items` en cada insert/update/delete y pisa lo que venga del cliente. Mismo principio de `prd-hardening`: RLS y triggers son la única capa real. |
| **`number` asignado por trigger** desde una secuencia | El cliente nunca elige el correlativo. El año en el string es informativo; la secuencia no se reinicia (simplificación consciente). |
| **`version` + `parent_quote_id`** | Estándar de la industria: la enviada se congela, el cambio es una revisión. |
| **`discount` como monto, no %** | Los porcentajes sobre líneas con cantidades generan discrepancias de redondeo al cuadrar con el cliente. |
| **`public_token` uuid v4** | 122 bits de entropía, no enumerable. Es el único secreto que protege la vista pública. |
| **`fx_rate` congelado en la cotización, no global** | Si el tipo de cambio vive en una config global, el histórico se reescribe solo: una cotización de enero cambia de valor en junio. Guardarlo en la fila es lo que hacen los CRMs serios (Salesforce lo llama *dated exchange rates*). El closer lo escribe al emitir; se precarga con una constante editable en config. |
| **`total_pen` materializado** | Las métricas de `/marketing` y el Dashboard suman una sola columna, sin joins ni conversiones en el cliente. Lo calcula el mismo trigger que los totales. |
| **`igv_rate` con default 0** | Decidido: se cotiza a precio final, sin desglose (§8). Dejar la columna cuesta una línea en el trigger y una condición en el documento; el día que factures con RUC pasa a 18 por config y no hay migración. Con rate 0 la línea de impuesto no se renderiza. |
| **Emisor en vivo, NO snapshot** | Al revés que el cliente. Tu RUC y dirección cambian casi nunca, y cuando cambian normalmente **quieres** que los documentos viejos muestren el dato actual. Además evita duplicar el logo en base64 en cada fila. Tradeoff consciente: si alguna vez necesitas congelarlo, se copian los campos de texto al enviar (el logo se queda vivo igual). |
| **Logo en base64, no en Storage** | El proyecto no usa Supabase Storage en ningún lado; `TaskModal.tsx:143` mete imágenes como data URI y `WhiteBoard.tsx:21` ya comprime con umbral. Abrir un bucket solo para un logo agrega configuración, políticas y una superficie nueva. Se redimensiona a ~400px de ancho antes de guardar y se rechaza sobre 100 KB. |

### 5.2 Lógica de servidor

- `recalc_quote_totals(quote_id)` — `security definer`, disparada por trigger en `quote_items` y ante cambio de `igv_rate`.
- `assign_quote_number()` — trigger `before insert` en `quotes`.
- `lock_sent_quote()` — trigger `before update`: si `OLD.status <> 'borrador'`, solo permite cambios de `status`, `sent_at` y `accepted_at`; cualquier otro campo levanta excepción. Equivalente en `quote_items`: bloquea escritura si la cotización padre no está en borrador.

### 5.3 Integración de tipo de cambio (Q19)

**Fuente elegida: BCRP.** API pública de la Base de Datos de Estadísticas, gratis, sin token ni registro.

```
GET https://estadisticas.bcrp.gob.pe/estadisticas/series/api/PD04640PD/json/<ini>/<fin>/ing
```

`PD04640PD` = *TC Sistema bancario SBS (S/ por US$) — Venta*. Respuesta:

```json
{ "config": { "title": "...", "series": [{ "name": "...", "dec": "3" }] },
  "periods": [ { "name": "09.Sep.26", "values": ["3.362"] } ] }
```

Verificado el 2026-09-10. Otras series útiles si se necesitan: `PD04639PD` (SBS compra), `PD04637PD` / `PD04638PD` (interbancario compra/venta).

**Por qué no va directo desde el browser:**

1. La app es un SPA; no hay garantía de CORS desde `estadisticas.bcrp.gob.pe`, y si el BCRP lo cambia la feature se cae sin aviso.
2. Cada closer que abre el editor pegaría al BCRP. Con caché en `fx_rates` es una llamada al día para todo el equipo.

Va por Edge Function `fx-rate` (tercera del proyecto, junto a `create-user` y `delete-user`).

**Detalle operativo que importa:** el BCRP **no publica el valor del día en curso** — al consultar el 2026-09-10 el valor del 10 vuelve como `"n.d."` y el último real era el del 9. La función pide los últimos ~10 días, descarta los `n.d.`, hace upsert de los que falten y devuelve el más reciente con su fecha. El editor muestra esa fecha; el closer decide si le sirve.

**Nota contable:** el BCRP y el "tipo de cambio SUNAT" no son exactamente el mismo número. Para una cotización da igual (es referencia comercial). Si algún día esto alimenta facturación, el TC que exige SUNAT es el suyo publicado, y ahí toca un proveedor con token (apis.net.pe, decolecta) o scraping. Fuera de alcance hoy.

## 6. Requerimientos

### P0 — Núcleo

| ID | Requerimiento | Detalle | Criterio de aceptación |
|----|---------------|---------|------------------------|
| Q1 | Crear cotización desde un lead | Botón en la sección Cotizaciones de `LeadPanel`. Precarga el snapshot del cliente desde el lead (`company`, `contact_name`, `contact_email`) y el `owner_id` del lead. Nace en `borrador`. | Desde un lead se llega a `/marketing/cotizacion/:id` con los datos del cliente ya puestos. |
| Q2 | Editor de líneas | Agregar / editar / eliminar / reordenar líneas. Totales en vivo en el cliente (UX), pero la fuente de verdad es el trigger. | 3 líneas con cantidades y descuentos → subtotal, descuento y total correctos tras refrescar la página. |
| Q3 | Totales correctos | `subtotal = Σ(qty·unit_price)`, `descuento = Σ(discount)`, `igv = (subtotal − descuento) · igv_rate/100` (hoy 0), `total = subtotal − descuento + igv`, `total_pen = total · fx_rate`. Redondeo a 2 decimales, dentro del trigger. | Caso documentado con importes que rompen redondeo (3 × 333.33 con descuento). Con `igv_rate = 0` el documento no renderiza línea de impuesto. Cotización en USD con `fx_rate 3.75` deja `total_pen` correcto. |
| Q4 | Enviar = congelar | Acción "Enviar": `status → enviada`, `sent_at = now()`, evento `enviada`, y copia el link `/p/:token` al portapapeles. A partir de ahí el documento es inmutable. | Editar una línea de una cotización enviada → error de la DB, no solo UI deshabilitada. Verificado desde consola del navegador. |
| Q5 | Vista pública | `/p/:token` fuera de `ProtectedRoute`, sin sidebar. Renderiza el mismo componente `QuoteDocument` que la vista previa interna. Token inválido o cotización en borrador → 404 amable, sin filtrar si existe o no. | Abrir el link en ventana de incógnito muestra la propuesta. Cambiar un carácter del token → 404. |
| Q6 | Registro de visto | Al cargar `/p/:token` se registra evento `vista` (con `meta` mínima: fecha). Deduplicado a 1 por hora para no ensuciar el historial. | El closer ve "Vista hace 2h" en el panel interno. |
| Q7 | Aceptar / rechazar desde el link | Botones en la vista pública. Pide el nombre de quien acepta. Solo si `status = 'enviada'` y `valid_until >= hoy`. | Aceptar marca `aceptada` + `accepted_at` + evento con el nombre. Cotización vencida muestra aviso y no deja aceptar. |
| Q8 | `leads.value` derivado | Al aceptar: `leads.value = quotes.total`, `leads.currency = quotes.currency`, `leads.value_pen = quotes.total_pen` y `leads.stage = 'cerrado'`. | Aceptar una cotización de S/ 4,200 deja el lead en cerrado con value 4200 / PEN, visible en el Kanban sin tocar la DB a mano. Aceptar una de USD 1,200 a 3.75 deja `value 1200`, `currency USD`, `value_pen 4500`. |

### P1 — Operación

| ID | Requerimiento | Detalle | Criterio de aceptación |
|----|---------------|---------|------------------------|
| Q9 | Listado global | Pestaña Cotizaciones en `/marketing`: número, cliente, título, total, estado, validez, closer. Filtro por estado y búsqueda por cliente/número. | Se listan todas las que el rol puede ver, respetando RLS. |
| Q10 | Duplicar / revisar | "Nueva versión" sobre una enviada: copia cabecera + líneas, `version + 1`, `parent_quote_id`, vuelve a `borrador`, número nuevo. | La v1 sigue accesible e intacta; la v2 es editable. |
| Q11 | Vencimiento | Cotización con `valid_until` pasado y estado `enviada` se muestra como vencida. Cálculo en lectura (no hay cron). | Listado y vista pública coinciden en marcarla vencida. |
| Q12 | Impresión / PDF | `QuoteDocument` con estilos `print:` de Tailwind; Ctrl+P produce un PDF limpio, sin sidebar ni botones. Disponible también en la vista pública. | PDF de 1–2 páginas, legible, con número y totales. |
| Q13 | Historial en el panel | Timeline de `quote_events` en la vista interna de la cotización. | Se ve creada → enviada → vista → aceptada con fechas. |
| Q18 | Datos del emisor editables | Diálogo admin-only (§4.1 #5) sobre `org_settings`: razón social, RUC, dirección, email, teléfono, web, logo y términos por defecto. El logo se redimensiona a ~400px y se guarda como data URI; se rechaza sobre 100 KB. `QuoteDocument` lee de aquí, y `get_public_quote` los devuelve para la vista pública. **Bloquea F3** — sin esto el documento no tiene cabecera. | Un admin cambia el RUC y el cambio se ve en el documento y en el link público sin redeploy. Un no-admin no ve el engranaje ni puede escribir la tabla (verificado por consola). |
| Q19 | Tipo de cambio automático | Edge Function `fx-rate` que consulta el **BCRP** (serie `PD04640PD`, TC Sistema bancario SBS venta) y cachea en `fx_rates`. API pública, sin token. Al elegir moneda USD, el editor precarga el último valor disponible, muestra su fecha ("TC BCRP del 09/09: 3.362") y un botón de refrescar. **El campo queda editable**: lo que se guarda en `quotes.fx_rate` es lo que quede en el input. | Crear cotización en USD precarga el TC sin que yo lo escriba. Si el BCRP no responde o devuelve `n.d.`, cae al último valor cacheado y lo marca como desactualizado, nunca bloquea la edición. Sobrescribir el valor a mano funciona y se respeta. |

### P2 — Consistencia con lo que ya existe

| ID | Requerimiento | Detalle | Criterio de aceptación |
|----|---------------|---------|------------------------|
| Q14 | Arreglar la moneda de las métricas | `MarketingPage` hardcodea `$` en las 4 tarjetas de métricas y en la columna Valor de la tabla. Las tarjetas pasan a sumar `value_pen` y se rotulan `S/`; la columna Valor de la tabla y las tarjetas del Kanban muestran cada lead en **su** moneda (`formatMoney(value, currency)`). | Ninguna vista muestra `$` sobre un importe en soles. Un lead en USD se ve como `$ 1,200` en la tabla pero suma 4,500 al pipeline total. |
| Q17 | Migración de leads existentes | El `alter table` de §5 pone `currency = 'PEN'` y `value_pen = value` para todo lo que ya existe. Asume que los values actuales son soles pese al `$` de la UI — **confirmar antes de correr F1**. | Tras la migración, "Pipeline total" da el mismo número que hoy, solo que rotulado `S/`. |
| Q15 | Notificación al responder | Insertar en `notifications` (tabla ya existente) para el `owner_id` cuando el cliente acepta o rechaza. | El closer ve la campanita al volver a la app. |
| Q16 | Tipos regenerados | `src/types/database.ts` incluye las 3 tablas nuevas y los 2 enums. | `tsc --noEmit` en 0 errores. |

## 7. Seguridad

Mismo principio que `prd-hardening`: **RLS es la única capa real**; la UI solo acompaña.

### 7.1 RLS interna (espejo exacto de `leads`)

```sql
-- closer: gestiona cotizaciones de leads propios
create policy "Closers manage quotes of own leads" on quotes for all using (
  exists (select 1 from profiles p join leads l on l.owner_id = p.id
          where p.user_id = auth.uid() and p.role = 'closer' and l.id = quotes.lead_id)
);
-- marketing/admin: lectura total
create policy "Admins and marketing view all quotes" on quotes for select using (
  exists (select 1 from profiles where user_id = auth.uid() and role in ('admin','marketing'))
);
-- admin: control total (incluye cotizaciones con lead_id null)
create policy "Admins manage all quotes" on quotes for all using (
  exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
);
```

`quote_items` y `quote_events` heredan por `exists` sobre la `quotes` padre.

`org_settings`: **select** para cualquier autenticado (el documento necesita la cabecera), **update solo admin**. Sin `insert` ni `delete` para nadie — la fila única nace en la migración y el `check (id)` impide una segunda.

`fx_rates`: **select** para cualquier autenticado; **ninguna política de escritura**. La escribe solo la Edge Function con service role, igual que el patrón de `create-user`.

### 7.2 Acceso público — **sin política `anon` sobre las tablas**

Una policy `for select to anon` sobre `quotes` expondría todas las cotizaciones enviadas a cualquiera que use la anon key (que es pública, va en el bundle). El acceso público va **solo** por funciones `security definer` con `set search_path = public`:

| Función | Quién ejecuta | Qué devuelve / hace |
|---------|---------------|---------------------|
| `get_public_quote(p_token uuid)` | `anon` | JSON con la cotización + líneas + datos del emisor (`org_settings`), **sin** `public_token`, `owner_id` ni `lead_id`. Solo si `status <> 'borrador'`. `null` si no existe. |
| `log_quote_view(p_token uuid)` | `anon` | Inserta evento `vista`. No devuelve nada. |
| `respond_quote(p_token uuid, p_accept bool, p_signer text)` | `anon` | Valida estado y vigencia, cambia `status`, registra evento, actualiza el lead (Q8) y notifica (Q15). |

**Riesgo asumido y explícito:** cualquiera con el link puede aceptar en nombre del cliente. Es exactamente cómo funcionan las cotizaciones de HubSpot, PandaDoc y similares cuando no hay firma electrónica. La mitigación es la entropía del token, más el hecho de que la aceptación es evidencia comercial y no contrato firmado. Si algún día hace falta más, se agrega código por email al aceptar.

## 8. Decisiones

**Resueltas (2026-09-10):**

1. **Moneda — PEN por defecto, USD opcional.** Selector por cotización. Sin conversión automática: `fx_rate` se escribe a mano al emitir y queda congelado (§5.1). Las métricas suman `total_pen` / `value_pen`; cada documento se muestra en su propia moneda.
2. **IGV — precio final, sin desglose.** `igv_rate` default 0 y la línea de impuesto no se renderiza. La columna queda para el día que factures con RUC.

3. **Emisor editable desde la app**, no constantes en código. Tabla `org_settings` de fila única + diálogo admin-only en la pestaña Cotizaciones (Q18). Se lee en vivo, no se congela por cotización (§5.1).
4. **Los `leads.value` actuales son soles.** Confirmado. La migración de Q17 los marca `PEN` y copia `value_pen = value`.
5. **Tipo de cambio automático desde el BCRP** (§5.3), cacheado en `fx_rates` y precargado en el editor, siempre editable a mano (Q19). Sin constante por defecto en código: si nunca hubo fetch exitoso y el usuario no escribe nada, la cotización no se puede pasar a USD.

**Ninguna decisión abierta. F1 puede arrancar.**

## 9. Plan de construcción

Las horas son órdenes de magnitud, no compromiso.

### F1 — Datos y seguridad (~3–4 h) · sin UI

- `supabase/migrations/<ts>_quotes.sql`: enums, 5 tablas (`quotes`, `quote_items`, `quote_events`, `org_settings`, `fx_rates`), índices, secuencia, triggers (`assign_quote_number`, `recalc_quote_totals`, `lock_sent_quote`), RLS y las 3 funciones públicas de §7.2.
- `alter table leads` + backfill de `currency`/`value_pen` (Q17), confirmado en §8.4.
- Actualizar `supabase/schema.sql`.

**Criterio de salida:** por SQL puedo crear una cotización con líneas y los totales salen correctos, incluida una en USD con su `total_pen`; un closer ajeno no la ve (probado con dos sesiones); `get_public_quote` devuelve datos con token válido y `null` con token inválido; una cotización `enviada` rechaza el update de una línea.

### F2 — CRUD interno (~4–5 h)

- `src/types/database.ts` — tablas y enums nuevos (Q16).
- `src/hooks/useQuotes.ts` — `useQuotes`, `useQuote`, `useQuotesByLead`, `useCreateQuote`, `useUpdateQuote` y las mutaciones de línea, siguiendo el patrón exacto de `useLeads.ts`.
- `src/pages/QuotePage.tsx` — editor, ruta `/marketing/cotizacion/:id`.
- `src/components/marketing/QuoteItemsEditor.tsx` — tabla editable de líneas (reusa `@dnd-kit` para reordenar, ya está instalado).
- `src/components/marketing/QuoteSection.tsx` — la sección dentro de `LeadPanel`.
- `supabase/functions/fx-rate/index.ts` + `src/hooks/useFxRate.ts` — tipo de cambio (Q19).
- Ediciones: `src/App.tsx` (ruta lazy), `src/components/marketing/LeadPanel.tsx` (montar la sección).

**Criterio de salida:** crear, editar y borrar un borrador completo desde la UI, con totales que cuadran tras refrescar. Una cotización en USD precarga el TC del BCRP y deja sobrescribirlo. Q1, Q2, Q3, Q19.

### F3 — Documento y envío (~4 h)

- `src/components/marketing/QuoteDocument.tsx` — **un solo renderer**, usado por la vista previa interna y por la pública. Los estilos `print:` viven aquí (Q12).
- `src/components/marketing/EmitterSettingsDialog.tsx` + `src/hooks/useOrgSettings.ts` — datos del emisor (Q18). **Va primero en esta fase**: el documento no se puede armar sin cabecera.
- `src/pages/PublicQuotePage.tsx` + ruta fuera de `ProtectedRoute` en `App.tsx`.
- Acción Enviar (congelar + copiar link) en `QuotePage`.
- `src/lib/quotes.ts` — helpers de formato de moneda e importes (usado también por Q14) y el resize del logo.

**Criterio de salida:** Q4, Q5, Q6, Q12, Q18. Prueba real: enviar una propuesta a un cliente por WhatsApp y que se vea bien en su teléfono.

### F4 — Cerrar el círculo (~2–3 h)

- Aceptar/rechazar público (Q7), sincronización con el lead (Q8), notificación (Q15).
- Timeline de eventos en la vista interna (Q13).
- Listado global + pestaña en `MarketingPage` (Q9).
- Duplicar como nueva versión (Q10), vencimiento (Q11).
- Arreglar la moneda en métricas, Kanban y tabla (Q14) — las tarjetas pasan a sumar `value_pen`.

**Criterio de salida:** el pipeline de `/marketing` refleja montos reales de cotizaciones, no estimaciones a mano.

### F5 — Opcional, según uso real

Solo si F1–F4 se usan de verdad durante unas semanas:

- **Narrativa con tiptap**: bloque de propuesta (contexto, alcance, entregables, timeline) arriba de la tabla de precios. Es lo que realmente vende un proyecto de agencia, y el editor ya está montado y lazy-loaded.
- **Catálogo de servicios**: tabla `quote_catalog` plana; la línea referencia un ítem y guarda snapshot de precio. Se paga solo a la tercera cotización repetida.
- **Plantillas** de propuesta por tipo de proyecto.

## 10. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El link público es el único secreto | UUID v4 (122 bits). No se listan tokens en ninguna respuesta pública. Si un link se filtra, "Nueva versión" invalida el anterior de facto; se puede agregar revocación explícita si hace falta. |
| Aceptación suplantable | Asumido, §7.2. Estándar de la industria sin firma electrónica. |
| Redondeo que no cuadra con el cliente | Redondeo a 2 decimales en un solo lugar (el trigger); el cliente nunca calcula el total que se guarda. Caso de prueba explícito en Q3. |
| Tipo de cambio escrito a mano y mal | Se precarga del BCRP, así que el error exige sobrescribirlo a propósito. Solo afecta `total_pen` (métricas), nunca el importe que ve el cliente. Corregible: es un update sobre una columna derivada, no sobre el documento. |
| El BCRP cambia el formato de su API o la tumba | El fallo es blando por diseño: la función cae al último valor de `fx_rates` y el campo sigue siendo editable a mano. Nadie queda bloqueado para cotizar. Cambiar de proveedor toca un solo archivo (`supabase/functions/fx-rate/index.ts`). |
| Logo pesado inflando cada carga | Resize a ~400px y tope de 100 KB en el diálogo. Es una fila leída una vez por sesión, cacheada por TanStack Query. |
| Leads existentes marcados `PEN` por error | Confirmado en §8.4 que son soles. |
| `leads.value` con dos fuentes de verdad | Al aceptar, el trigger pisa `value`. A partir de F4 el campo es derivado: `LeadModal` no debe permitir editarlo a mano en leads con cotización aceptada. |
| Alcance que se infla en F5 | F5 no arranca sin semanas de uso real de F1–F4. |

## 11. Estado de la construcción (2026-09-11)

### Aplicado en producción

- Migraciones `20260911120000_quotes.sql` (+ dos correcciones: cast de enum en `log_quote_event`, trigger `quotes_updated_at`). `supabase/schema.sql` actualizado.
- Edge Function `fx-rate` desplegada (v1, `verify_jwt` activo).
- `alter table leads` con `currency` + `value_pen`; los 10 leads existentes quedaron en `PEN` con `value_pen = value` (§8.4).

### Verificado contra la base real

| Qué | Resultado |
|-----|-----------|
| Totales con importes que rompen redondeo | 3×333.33 + 1200 + 2×450.55 − 150 = **3101.09 → 2951.09**; en USD a 3.362 → `total_pen` **9921.56**. Correcto. |
| Correlativo por trigger | `COT-2026-0002`, `COT-2026-0003`. El cliente nunca lo manda. |
| Inmutabilidad de una enviada | Bloqueados: cambio de título, de total, de precio de línea e inserción de línea nueva. También bloqueó despegarla de su lead. |
| `get_public_quote` | Token válido → documento completo **sin** `public_token`, `owner_id`, `lead_id`, `total_pen`. Token inválido → `null`. |
| **Acceso anónimo real** (curl con anon key, sin sesión) | `SELECT` directo a `quotes`, `quote_items` y `org_settings` → `[]`. RPC con token → documento. Es el punto central del diseño y funciona. |
| `respond_quote` | Sin nombre → rechaza. Con nombre → acepta, registra el firmante, cierra el lead (`value` 1000, `PEN`, stage `cerrado`) y notifica al closer. Segundo intento → "ya fue respondida". |
| `log_quote_view` | Registra la vista como anónima (`actor_id` null), deduplicada por hora. |
| Edge Function `fx-rate` | Devolvió `{date: 2026-09-09, usd_pen: 3.362, stale: true}` y cacheó 7 días, saltando fines de semana. El `stale: true` es correcto: el BCRP no publica el día en curso. |
| Typecheck | 40 errores, **idéntico al baseline** de `main`. Cero errores nuevos. |
| Lint | 50 errores / 14 warnings, **idéntico al baseline**. Cero nuevos. |
| Build | `vite build` OK. |

Todos los datos de prueba se borraron y los dos leads tocados (CARIBBEAN DANCE, WESTGYM) volvieron a su valor, moneda y etapa originales. Único residuo: su `updated_at` avanzó, porque el trigger `leads_updated_at` lo pisa y no se puede restaurar.

### Falta probar — requiere navegador

Nada de la UI se ejerció en un navegador; lo verificado es la capa de datos y el acceso público por HTTP. Pendiente de una pasada manual:

1. Crear cotización desde `LeadPanel` → editor → agregar líneas → totales en vivo.
2. Reordenar líneas arrastrando (dnd-kit).
3. Cambiar a USD y ver la precarga del TC + el botón de refrescar.
4. Enviar, abrir `/p/:token` en incógnito, aceptar.
5. `Ctrl+P` en el documento y en la vista pública (los estilos `print:` no se probaron).
6. Subir un logo en el diálogo del emisor (el resize a 400px no se ejerció).
7. Que un closer no-admin no vea el engranaje del emisor ni cotizaciones ajenas.

### Desviaciones respecto al plan original

- **Q11 (vencimiento)**: se calcula en lectura con `effectiveStatus()`, sin tocar la DB. El enum `quote_status` tiene el valor `vencida` pero nunca se persiste.
- **Se agregó `quotes_updated_at`** por consistencia con `leads` y `notes`; no estaba en el plan.
- **`useUpdateQuote` tipa su patch con `QuoteUpdate`**, no con `Partial<Quote>`: el tipo del cliente ya no permite ni mencionar `number`, `total` ni `public_token`. La barrera está en la DB, pero conviene que TypeScript también la marque.
