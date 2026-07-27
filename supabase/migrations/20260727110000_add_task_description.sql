-- Descripción rica (tiptap JSON: texto, checklist, imágenes) para tareas
alter table public.tasks add column description jsonb;
