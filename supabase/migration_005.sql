-- ============================================================
--  PSYCHOMOTIME — Migration 005 : auto-résiliation d'abonnement
--  Permet à un utilisateur de résilier SON abonnement (uniquement).
--  Il ne peut jamais s'auto-activer ni se donner le rôle admin.
--  À coller dans : Supabase > SQL Editor > New query > Run
-- ============================================================

drop policy if exists "sub self cancel" on public.subscriptions;
create policy "sub self cancel" on public.subscriptions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and status = 'canceled'
    and manual_override = false
    and is_admin = false
  );
