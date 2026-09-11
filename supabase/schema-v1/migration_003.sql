-- ============================================================
--  PSYCHOMOTIME — Migration 003
--  Ajoute le champ "tests" (tests utilisés + tableaux M-ABC3) aux bilans.
--  À coller dans : Supabase > SQL Editor > New query > Run
--  (Relançable sans danger.)
-- ============================================================

alter table public.bilans
  add column if not exists tests jsonb not null default '{}'::jsonb;
