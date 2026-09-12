-- ============================================================================
--  0013 — SEARCH_PATH ÉPINGLÉ SUR TOUTES LES FONCTIONS, ET NON LES SEULES
--  FONCTIONS À PRIVILÈGES
-- ============================================================================
--  CE QUI S'EST PASSÉ. Le contrôle de couverture local n'exigeait un
--  `search_path` épinglé que des fonctions `security definer` — celles qui
--  s'exécutent avec les droits de leur propriétaire. Le raisonnement était
--  qu'une fonction `security invoker` n'a pas plus de pouvoir que son appelant,
--  donc rien à détourner.
--
--  C'est vrai pour les DROITS. Ce n'est pas vrai pour la RÉSOLUTION DES NOMS.
--  Un déclencheur s'exécute dans la session de celui qui écrit ; si cette
--  session a posé son propre `search_path`, les noms non qualifiés que la
--  fonction emploie se résolvent selon CE chemin. Une fonction de garde dont
--  les noms se résolvent ailleurs que prévu est une garde qu'on peut contourner.
--
--  Les trois fonctions ci-dessous ne lisent aucune table — elles ne comparent
--  que `old` et `new`, ou un couple de valeurs. Le risque est donc ici
--  théorique. Mais une garantie qui dépend du contenu actuel d'une fonction
--  n'en est pas une : elle doit tenir par construction, pour que la prochaine
--  modification n'ait pas à y penser.
--
--  Signalé par l'analyseur de Supabase, que le harnais local ne reproduisait
--  pas. Le contrôle `tests.check_rls_coverage` est élargi en conséquence : il
--  refuse désormais TOUTE fonction de `app` ou `public` sans chemin épinglé.
-- ============================================================================

alter function app.guard_issued_document() set search_path = public, pg_temp;
alter function app.guard_delete_document() set search_path = public, pg_temp;
alter function app.effective_licence_status(text, date) set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
--  `handle_new_user` n'est pas appelable par un visiteur anonyme
-- ---------------------------------------------------------------------------
--  C'est une fonction de déclencheur héritée de la v1, posée sur `auth.users`.
--  Elle n'a aucune raison d'être exposée dans l'API : appelée hors déclencheur
--  elle échoue, mais une fonction publiquement appelable qui n'a pas à l'être
--  reste une surface d'attaque de plus, et un signalement de plus à trier.
--
--  Le seul point d'entrée qui doit rester ouvert au visiteur anonyme est
--  `invoice_by_token`, et il le reste : c'est le contrat de la consultation
--  d'une facture par son lien.
do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    revoke all on function public.handle_new_user() from public, anon, authenticated;
  end if;
end
$$;
