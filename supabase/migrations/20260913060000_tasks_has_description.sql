-- =============================================
-- EGRESS: bandera para no descargar descripciones en las listas
--
-- tasks.description guarda el documento de tiptap con las imágenes pegadas en
-- base64: una sola tarea pesa 1,45 MB. El Kanban y el Gantt la traían entera
-- para cada tarea solo para decidir si mostrar un ícono, y lo hacían dos veces
-- por carga de Desarrollo (useTasks y useObjectives) y otra vez tras cada
-- movimiento de tarjeta o cada inicio/parada del timer.
--
-- Columna generada: la lista pide un booleano y el modal pide el contenido
-- solo cuando se abre una tarea.
-- =============================================

alter table tasks add column has_description boolean
  generated always as (description is not null) stored;
