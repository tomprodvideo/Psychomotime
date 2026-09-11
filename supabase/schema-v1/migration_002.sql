-- ============================================================
--  PSYCHOMOTIME — Migration 002
--  Ajoute : profil/logo & infos pro, adresse patient,
--  date d'émission & libellé de prestation sur les factures.
--  À coller dans : Supabase > SQL Editor > New query > Run
--  (Relançable sans danger.)
-- ============================================================

-- Profil pro (logo en base64, adresse, SIRET, ADELI, mentions, contacts…)
alter table public.settings
  add column if not exists profile jsonb not null default '{}'::jsonb;

-- Adresse du patient (utile sur les factures)
alter table public.patients
  add column if not exists address text;

-- Données de facturation
alter table public.invoices
  add column if not exists issue_date date;
alter table public.invoices
  add column if not exists service_label text;
