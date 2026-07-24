-- Temporizador por tarea: tiempo acumulado + inicio del tramo en curso
alter table public.tasks
  add column time_spent_seconds integer not null default 0,
  add column timer_started_at timestamptz;
