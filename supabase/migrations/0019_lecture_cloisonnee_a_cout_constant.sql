-- ============================================================================
--  0019 — LA MÊME ISOLATION, ÉVALUÉE UNE FOIS AU LIEU D'UNE FOIS PAR LIGNE
-- ============================================================================
--  MESURÉ, PAS SUPPOSÉ. Sur un cabinet fictif de 400 dossiers et 5 591
--  rendez-vous, la première page de la liste des dossiers — vingt-cinq lignes —
--  coûtait 35,09 ms. Le plan dit pourquoi :
--
--    Index Scan using idx_patients_practice on patients (rows=356)
--      Filter: (app.can_write(practice_id) OR app.is_member(practice_id))
--
--  Ce filtre s'évalue POUR CHAQUE LIGNE examinée. Les deux fonctions sont
--  `security definer` : le planificateur ne peut pas les incorporer, et chacune
--  interroge `practice_members`. Trois cent cinquante-six lignes examinées font
--  sept cent douze interrogations pour afficher vingt-cinq noms. Le parcours
--  d'index lui-même prenait 1,2 ms ; le filtre le portait à 34,5 ms.
--
--  Après les deux corrections ci-dessous, la même requête coûte 1,49 ms —
--  le sous-plan est haché et évalué UNE FOIS (`loops=1`). Vingt-trois fois
--  moins, à isolation rigoureusement identique.
--
--  ── DEUX CORRECTIONS, ET AUCUNE NE CHANGE QUI VOIT QUOI ───────────────────
--
--  1. LE « OR » ÉTAIT REDONDANT. Les politiques d'écriture étaient déclarées
--     `for all`, ce qui applique aussi leur clause `using` à la LECTURE. Le
--     moteur évaluait donc `can_write OR is_member` sur chaque ligne lue. Or
--     `app.can_write` appelle `app.has_role`, qui exige la même appartenance
--     active que `app.is_member`, plus un rôle : écrire implique donc lire, et
--     la branche `can_write` ne pouvait JAMAIS élargir le résultat. Elle
--     doublait le coût sans rien autoriser de plus.
--
--     Les politiques `for all` deviennent donc `insert` + `update` + `delete`,
--     aux prédicats inchangés. Une écriture porte sur quelques lignes : le coût
--     par ligne n'y a aucune importance, et la forme fonctionnelle y reste
--     la plus lisible.
--
--  2. L'APPARTENANCE SE CALCULE UNE FOIS. `app.is_member(practice_id)` prend la
--     colonne de chaque ligne en argument : sa valeur change d'une ligne à
--     l'autre, le moteur doit donc la rappeler à chaque fois. `practice_id in
--     (select app.mes_cabinets())` pose la question dans l'autre sens — quels
--     cabinets sont les miens ? — et cette réponse-là ne dépend d'aucune ligne.
--     PostgreSQL la calcule une fois et la hache.
--
--     LA SÉMANTIQUE EST LA MÊME, terme à terme : `is_member` exige que
--     `practice_id` ne soit pas nul et qu'il existe une appartenance active de
--     l'appelant à ce cabinet. La forme ensembliste énumère exactement ces
--     appartenances-là ; un `practice_id` nul ne figure dans aucun ensemble.
--
--  ── CE QUI PROUVE QUE L'ISOLATION N'A PAS BOUGÉ ───────────────────────────
--
--  Les dix fichiers de contrôle du dépôt, dont ceux qui démontrent une fuite
--  entre cabinets et exigent qu'elle soit fermée. Ils ont été rejoués après
--  cette migration, et une isolation délibérément rouverte les fait échouer.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Mes cabinets, et ceux dont je peux lire le contenu clinique
-- ---------------------------------------------------------------------------
/**
 * Les cabinets auxquels l'appelant appartient activement.
 *
 * Rend un ENSEMBLE plutôt qu'un booléen, et c'est toute la différence : la
 * question ne porte plus sur une ligne, donc sa réponse se calcule une fois.
 *
 * `security definer` comme ses voisines : `practice_members` est elle-même
 * sous RLS, et une politique qui devrait lire cette table pour s'évaluer
 * tournerait en rond.
 */
create or replace function app.mes_cabinets()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.practice_id
    from public.practice_members m
   where m.user_id = app.current_user_id()
     and m.status = 'active';
$$;
revoke all on function app.mes_cabinets() from public, anon;
grant execute on function app.mes_cabinets() to authenticated;

/**
 * Les cabinets dont l'appelant peut lire les contenus cliniques.
 *
 * Aujourd'hui ce sont les mêmes rôles que l'écriture — propriétaire et
 * praticien — et c'est délibéré : un assistant tient un agenda et une
 * facturation, il ne lit pas les notes. Cette fonction existe séparément pour
 * que le jour où les deux divergeront, il n'y ait qu'un endroit à changer.
 */
create or replace function app.mes_cabinets_cliniques()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.practice_id
    from public.practice_members m
   where m.user_id = app.current_user_id()
     and m.status = 'active'
     and m.role = any (array['owner', 'practitioner']);
$$;
revoke all on function app.mes_cabinets_cliniques() from public, anon;
grant execute on function app.mes_cabinets_cliniques() to authenticated;

-- ---------------------------------------------------------------------------
--  2. Réécriture des politiques
-- ---------------------------------------------------------------------------
--  PILOTÉE PAR LE CATALOGUE, pour qu'aucune table n'échappe à la réécriture —
--  il y en a soixante-huit — mais avec une correspondance EXACTE : toute
--  politique dont le prédicat n'est pas l'un de ceux qu'on sait traduire fait
--  échouer la migration au lieu d'être laissée en l'état sans que personne ne
--  le sache. C'est le contraire d'un `else` silencieux.
do $$
declare
  p record;
  v_nouveau text;
  v_traduites integer := 0;
  v_scindees integer := 0;
begin
  -- 2a. Les lectures : le booléen par ligne devient une appartenance à un
  --     ensemble calculé une fois.
  for p in
    select schemaname, tablename, policyname, qual, roles
      from pg_policies
     where schemaname = 'public' and cmd = 'SELECT'
     order by tablename, policyname
  loop
    v_nouveau := case p.qual
      when 'app.is_member(practice_id)'
        then 'practice_id in (select app.mes_cabinets())'
      when 'app.is_member(id)'
        then 'id in (select app.mes_cabinets())'
      when 'app.can_read_clinical(practice_id)'
        then 'practice_id in (select app.mes_cabinets_cliniques())'
      when '(app.is_member(practice_id) OR app.is_platform_admin())'
        then '(practice_id in (select app.mes_cabinets()) or app.is_platform_admin())'
      else null end;

    if v_nouveau is null then
      -- Les politiques qui ne dépendent d'aucune colonne de ligne — celles de
      -- la plateforme — ne gagnent rien à être réécrites : leur prédicat est
      -- déjà constant pour toute la requête.
      if p.qual in ('app.is_platform_admin()', 'true') then
        continue;
      end if;

      /* LES TABLES DE LA v1 SONT LAISSÉES INTACTES, ET C'EST DÉLIBÉRÉ.
       *
       * Elles s'isolent encore par `auth.uid() = user_id` : c'est l'ancien
       * modèle, où le locataire était le compte et non le cabinet. Rien à y
       * gagner — elles disparaîtront avec leurs tables — et beaucoup à y
       * perdre : une traduction approximative sur une table qu'on s'apprête à
       * retirer est un risque pris pour rien.
       *
       * L'exemption est NOMMÉE, pas silencieuse : toute autre forme
       * inattendue fait toujours échouer la migration. C'est la répétition de
       * la bascule — qui rejoue le schéma v1 d'abord — qui a montré qu'il
       * fallait ce cas ; la base de développement, elle, ne le porte pas. */
      if p.qual like '%auth.uid()%' or p.qual like '%user_id%' then
        continue;
      end if;

      raise exception
        'Politique de lecture non reconnue : %.% → %. Traduisez-la explicitement plutôt que de la laisser derrière.',
        p.tablename, p.policyname, p.qual;
    end if;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format(
      'create policy %I on public.%I for select to %s using (%s)',
      p.policyname, p.tablename, array_to_string(p.roles, ', '), v_nouveau);
    v_traduites := v_traduites + 1;
  end loop;

  -- 2b. Les écritures : `for all` porte aussi sur la lecture. On le scinde.
  for p in
    select schemaname, tablename, policyname, qual, with_check, roles
      from pg_policies
     where schemaname = 'public' and cmd = 'ALL'
     order by tablename, policyname
  loop
    -- Même exemption nommée, pour la même raison.
    if coalesce(p.qual, '') like '%auth.uid()%'
       or coalesce(p.qual, '') like '%user_id%'
       or coalesce(p.with_check, '') like '%auth.uid()%'
       or coalesce(p.with_check, '') like '%user_id%' then
      continue;
    end if;

    if p.qual is null or p.with_check is null or p.qual is distinct from p.with_check then
      raise exception
        'Politique d''écriture inattendue : %.% (using=%, with check=%). Scindez-la à la main.',
        p.tablename, p.policyname, p.qual, p.with_check;
    end if;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format(
      'create policy %I on public.%I for insert to %s with check (%s)',
      p.policyname || '_insert', p.tablename,
      array_to_string(p.roles, ', '), p.with_check);
    execute format(
      'create policy %I on public.%I for update to %s using (%s) with check (%s)',
      p.policyname || '_update', p.tablename,
      array_to_string(p.roles, ', '), p.qual, p.with_check);
    execute format(
      'create policy %I on public.%I for delete to %s using (%s)',
      p.policyname || '_delete', p.tablename,
      array_to_string(p.roles, ', '), p.qual);
    v_scindees := v_scindees + 1;
  end loop;

  raise notice '0019 : % lecture(s) traduite(s), % politique(s) d''écriture scindée(s).',
    v_traduites, v_scindees;
end
$$;
