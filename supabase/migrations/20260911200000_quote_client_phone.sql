-- =============================================
-- TELÉFONO EN EL SNAPSHOT DE LA COTIZACIÓN
--
-- Omisión del diseño original: quotes snapshotea empresa, contacto, email, RUC
-- y dirección, pero no el teléfono. Sin él no se puede mandar la cotización por
-- WhatsApp, y tomarlo del lead en el momento del envío rompería el principio
-- del snapshot (el documento no puede cambiar retroactivamente) y además falla
-- cuando lead_id es null.
-- =============================================

alter table quotes add column client_phone text;

-- Normalizado, igual que en leads: es con lo que se llama a la API de WhatsApp.
alter table quotes add column client_phone_e164 text
  generated always as (public.normalize_phone_pe(client_phone)) stored;

comment on column quotes.client_phone_e164 is
  'Generada desde client_phone con normalize_phone_pe. La app nunca la escribe.';

-- Las cotizaciones ya emitidas se rellenan desde su lead. Es el único momento
-- en que mirar el lead es correcto: la cotización nació sin el dato.
update quotes q
set client_phone = l.contact_phone
from leads l
where q.lead_id = l.id and q.client_phone is null;
