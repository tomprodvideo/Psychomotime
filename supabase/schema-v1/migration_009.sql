-- ============================================================
--  PSYCHOMOTIME — Migration 009 : suppression de son propre compte
--  Permet à un utilisateur connecté de supprimer SON compte et,
--  par cascade, toutes ses données (patients, bilans, factures…).
--  À coller dans : Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Supprime le compte auth ; toutes les tables liées ont un
  -- ON DELETE CASCADE sur user_id → nettoyage complet.
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
