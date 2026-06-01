-- Store user-adjustable rubric weights with the rest of the coaching profile.
-- Historical evaluations keep their original rubric score records; this setting
-- only affects future agent turns.

alter table public.profiles
  add column if not exists rubric_weights jsonb not null default '{}'::jsonb;
