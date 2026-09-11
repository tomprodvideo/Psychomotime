-- ============================================================================
--  0006 — RÉDUCTION DE LA SURFACE ANONYME
-- ============================================================================
--  Trois fonctions héritées de la v1 restaient appelables par un visiteur SANS
--  SESSION, via `/rest/v1/rpc/...`, pour la même raison que les autres : les
--  privilèges par défaut de Supabase.
--
--  Aucune n'est exploitable — `delete_my_account` supprime « l'utilisateur
--  courant », c'est-à-dire personne ; `is_admin` répond faux ; `handle_new_user`
--  est un déclencheur qui échoue hors de son contexte. Mais une fonction
--  inutilement exposée est une fonction qu'il faudra ré-auditer à chaque
--  changement, et `handle_new_user` accorde le rôle d'administrateur sur
--  comparaison d'adresse : elle n'a rien à faire dans la surface d'API.
--
--  Après ce fichier, la surface anonyme du schéma `public` se limite à UNE
--  fonction : `invoice_by_token`, publique par conception, qui sert la facture
--  d'un patient sans compte. C'est exactement l'exception nommée par le
--  contrôle de couverture (`supabase/local/02_coverage.sql`).
-- ============================================================================

do $$
declare
  f record;
begin
  -- ATTENTION AU PSEUDO-RÔLE `PUBLIC`. Révoquer sur `anon` seul ne suffit pas :
  -- si la fonction est accordée à PUBLIC, `anon` en hérite. Il faut retirer les
  -- deux, puis rendre explicitement à `authenticated` ce dont l'application a
  -- réellement besoin.
  for f in
    select p.oid::regprocedure as signature, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('delete_my_account', 'is_admin', 'next_invoice_seq')
  loop
    execute format('revoke execute on function %s from public', f.signature);
    execute format('revoke execute on function %s from anon', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
    raise notice '0006 : % réservée aux comptes connectés.', f.proname;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
--  `handle_new_user` : laissée en l'état, et voici pourquoi
-- ---------------------------------------------------------------------------
--  C'est un DÉCLENCHEUR sur `auth.users`, appelé par le service
--  d'authentification de Supabase au moment de l'inscription. Appelée comme
--  RPC, elle échoue immédiatement : il n'y a pas d'enregistrement `NEW` hors
--  du contexte d'un déclencheur. Elle est donc inerte, pas exploitable.
--
--  Lui retirer ses privilèges maintenant reviendrait à toucher au chemin
--  d'inscription en production pour un gain nul. Elle disparaîtra avec la
--  reprise de la table `subscriptions`, que le socle remplace déjà par
--  `practice_subscriptions` et `platform_admins` — ce dernier rendant caduc
--  l'octroi du rôle d'administrateur sur comparaison d'adresse e-mail, qui est
--  le vrai défaut de cette fonction.
--
--  [À FAIRE — lot abonnements] Supprimer `handle_new_user` en même temps que la
--  table `subscriptions`.
