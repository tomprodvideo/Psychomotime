-- ============================================================
--  PSYCHOMOTIME — Migration 006 : tuteur / parent sur la fiche patient
--  À coller dans : Supabase > SQL Editor > New query > Run
-- ============================================================

alter table public.patients
  add column if not exists guardian jsonb not null default '{}'::jsonb;
