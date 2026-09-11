-- ============================================================
--  PSYCHOMOTIME — Migration 007 : dossier de suivi du patient
--  À coller dans : Supabase > SQL Editor > New query > Run
-- ============================================================

alter table public.patients
  add column if not exists dossier jsonb not null default '{}'::jsonb;
