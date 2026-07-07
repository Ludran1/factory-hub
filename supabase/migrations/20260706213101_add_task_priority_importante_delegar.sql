-- Añade prioridades 'importante' y 'delegar' al enum task_priority
-- (Importante tras Urgente, Delegar al final)
ALTER TYPE task_priority ADD VALUE IF NOT EXISTS 'importante' AFTER 'urgente';
ALTER TYPE task_priority ADD VALUE IF NOT EXISTS 'delegar' AFTER 'baja';
