-- ============================================================
--  PSYCHOMOTIME — Migration 010 : compteur de numéros de facture
--  Garantit qu'un numéro attribué n'est jamais réattribué, même
--  après suppression d'une facture.
--  À coller dans : Supabase > SQL Editor > New query > Run
--  (Ce script peut être relancé sans danger.)
-- ============================================================

-- Un compteur par utilisateur et par « portée ». La portée est le modèle de
-- numéro avec sa partie fixe déjà résolue, le compteur restant en {N} :
-- « 2026-{N} », « F2026-03-{N} »… Changer d'année ou de mois crée donc une
-- nouvelle portée, et donc une nouvelle série repartant de 1.
create table if not exists public.invoice_counters (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null,
  last_seq integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, scope)
);

alter table public.invoice_counters enable row level security;

drop policy if exists "own invoice_counters" on public.invoice_counters;
create policy "own invoice_counters" on public.invoice_counters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Réserve le rang suivant de façon atomique : deux factures créées en même
-- temps ne peuvent pas obtenir le même numéro (l'upsert verrouille la ligne).
--
-- p_min sert d'amorçage : c'est le plus grand rang déjà présent dans les
-- factures existantes pour cette portée. Il évite de repartir de 1 sur une
-- base déjà remplie, et rattrape un numéro saisi à la main plus haut que le
-- compteur.
create or replace function public.next_invoice_seq(
  p_scope text,
  p_min integer default 0
)
returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  v_seq integer;
begin
  -- Appelée sans session (éditeur SQL Supabase, tâche cron…), auth.uid() est
  -- NULL : on le dit explicitement plutôt que de laisser échouer la contrainte
  -- NOT NULL avec un message obscur.
  if auth.uid() is null then
    raise exception
      'next_invoice_seq : aucune session authentifiée (auth.uid() est NULL). '
      'Cette fonction doit être appelée depuis l''application.';
  end if;

  insert into public.invoice_counters (user_id, scope, last_seq)
  values (auth.uid(), p_scope, greatest(coalesce(p_min, 0), 0) + 1)
  on conflict (user_id, scope) do update
    set last_seq = greatest(
          public.invoice_counters.last_seq,
          greatest(coalesce(p_min, 0), 0)
        ) + 1,
        updated_at = now()
  returning last_seq into v_seq;

  return v_seq;
end;
$$;

revoke all on function public.next_invoice_seq(text, integer) from public;
grant execute on function public.next_invoice_seq(text, integer) to authenticated;
