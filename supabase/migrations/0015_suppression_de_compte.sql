-- ============================================================================
--  0015 — SUPPRIMER SON COMPTE SUPPRIME RÉELLEMENT SES DONNÉES
-- ============================================================================
--  LE DÉFAUT, ET C'EST UNE RÉGRESSION INTRODUITE PAR CETTE REFONTE.
--
--  En v1, tout était clé sur `user_id` avec `on delete cascade` : supprimer le
--  compte supprimait tout, et `delete from auth.users` suffisait.
--
--  Le locataire est devenu le CABINET. `public.practices` ne porte AUCUNE clé
--  étrangère vers `auth.users` — c'est ce qui permet à un cabinet de survivre
--  au départ d'un praticien, et c'était voulu. Mais `delete_my_account` n'a pas
--  suivi : elle supprimait toujours la seule ligne `auth.users`, ce qui ne
--  cascadait plus que `practice_members`.
--
--  Résultat : le cabinet, ses dossiers, ses pièces comptables et leurs
--  instantanés — nom et adresse du patient compris — SURVIVAIENT. Orphelins,
--  invisibles de tous puisque plus aucun membre ne pouvait les lire, mais bien
--  présents. Pendant que l'écran promettait « toutes vos données seront
--  supprimées ».
--
--  Une promesse d'effacement non tenue est plus grave qu'un effacement
--  impossible : la personne croit l'avoir obtenu et ne le redemande pas.
--
--  Trouvé par la relecture protection des données du lot 5.
--
--  ── CE QUE LA NOUVELLE FONCTION FAIT, CABINET PAR CABINET ─────────────────
--
--   · Le compte est le SEUL membre → le cabinet est supprimé, et tout avec lui.
--   · D'autres membres existent, le compte n'est pas le dernier propriétaire
--     actif → seule son appartenance est retirée. Les données du cabinet
--     appartiennent aussi aux autres ; les détruire serait détruire leur travail.
--   · D'autres membres existent ET le compte est le dernier propriétaire actif
--     → LA SUPPRESSION EST REFUSÉE, avec un motif. Les deux autres issues
--     seraient mauvaises : détruire les données d'autrui, ou laisser un cabinet
--     que plus personne ne peut administrer.
--
--  ── CE QU'ELLE NE FAIT PAS ────────────────────────────────────────────────
--
--   · Elle ne touche pas au journal. `audit_events.practice_id` est
--     `on delete set null` : les traces survivent, sans nom de personne — elles
--     ne portent qu'une action, un type de sujet et un identifiant technique.
--     Effacer le journal effacerait la preuve que la suppression a eu lieu.
--     [VALIDATION HUMAINE — DPO] La durée de conservation de ce journal reste
--     à trancher, comme toutes les autres.
--   · Elle ne supprime aucun fichier du stockage : cela ne se fait pas en SQL.
--     L'appelant s'en charge AVANT, et c'est signalé côté application.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. La garde des pièces émises ne rend plus un cabinet indestructible
-- ---------------------------------------------------------------------------
--  Même raisonnement qu'en 0008 pour le dernier propriétaire, et même
--  démonstration : une pièce émise ne se supprime pas — mais lorsque le cabinet
--  lui-même disparaît, il n'y a plus de série à protéger, plus de numérotation
--  à tenir, plus personne à qui rendre des comptes. La garde avait raison sur
--  le fond et tort sur le contexte.
--
--  Vérifié en exécution : sans cette correction, la suppression d'un cabinet
--  portant une facture émise échoue sur ce déclencheur.
create or replace function app.guard_delete_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Suppression en cascade du cabinet : la ligne parente part d'abord.
  if not exists (select 1 from public.practices p where p.id = old.practice_id) then
    return old;
  end if;

  if old.status <> 'brouillon' then
    raise exception
      'Une pièce émise ne se supprime pas : elle se conserve et s''annule par un avoir. Supprimer creuserait un trou définitif dans la numérotation.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
--  2. La suppression de compte
-- ---------------------------------------------------------------------------
/**
 * Supprime le compte appelant et ce qui n'appartient qu'à lui.
 *
 * AUCUN PARAMÈTRE, et c'est délibéré : la fonction ne peut agir que sur
 * l'appelant. Une fonction `security definer` qui accepterait un identifiant
 * de compte permettrait de supprimer celui d'un autre.
 *
 * Rend un compte rendu de ce qui a été fait, pour que l'interface puisse le
 * DIRE au lieu de l'affirmer. L'ancienne version rendait `void`, et l'appelant
 * redirigeait vers la page de connexion quoi qu'il arrive.
 */
--  `drop` avant `create` : la version v1 rend `void`, et PostgreSQL refuse de
--  changer le type de retour d'une fonction existante. La base de
--  développement, reconstruite depuis les seules migrations de la cible, ne
--  portait pas la v1 et ne pouvait donc pas le voir. C'est la répétition de la
--  bascule — qui rejoue le schéma v1 d'abord — qui a trouvé le défaut, avant
--  la production.
drop function if exists public.delete_my_account();

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.current_user_id();
  c record;
  v_supprimes integer := 0;
  v_quittes integer := 0;
  v_dossiers integer := 0;
  v_pieces integer := 0;
begin
  if v_user is null then
    raise exception 'Aucune session.' using errcode = 'insufficient_privilege';
  end if;

  -- PREMIER PASSAGE : on refuse AVANT de supprimer quoi que ce soit.
  -- Une suppression partielle laisserait le compte dans un état que personne
  -- n'a demandé — des cabinets détruits, d'autres non, et l'appelant toujours
  -- connecté sans savoir lesquels.
  for c in
    select m.practice_id, p.name
      from public.practice_members m
      join public.practices p on p.id = m.practice_id
     where m.user_id = v_user
  loop
    if (select count(*) from public.practice_members m2
         where m2.practice_id = c.practice_id) > 1
       and (select count(*) from public.practice_members m3
             where m3.practice_id = c.practice_id
               and m3.user_id <> v_user
               and m3.role = 'owner' and m3.status = 'active') = 0
    then
      raise exception
        'Vous êtes le dernier propriétaire du cabinet « % », qui compte d''autres membres. Transférez la propriété à l''un d''eux, ou retirez-les, avant de supprimer votre compte.',
        c.name using errcode = 'check_violation';
    end if;
  end loop;

  -- SECOND PASSAGE : on agit.
  for c in
    select m.practice_id, p.name,
           (select count(*) from public.practice_members m2
             where m2.practice_id = m.practice_id) as membres
      from public.practice_members m
      join public.practices p on p.id = m.practice_id
     where m.user_id = v_user
  loop
    if c.membres = 1 then
      -- Le compte est seul : le cabinet n'appartient qu'à lui.
      select count(*) into v_dossiers from public.patients
       where practice_id = c.practice_id;
      select count(*) into v_pieces from public.billing_documents
       where practice_id = c.practice_id;

      -- La trace est posée AVANT, pour qu'elle survive à la suppression :
      -- `audit_events.practice_id` passe alors à null et la ligne demeure.
      insert into public.audit_events
        (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
      values (c.practice_id, v_user, 'practice.delete_with_account',
              'practice', c.practice_id,
              jsonb_build_object('dossiers', v_dossiers, 'pieces', v_pieces));

      delete from public.practices where id = c.practice_id;
      v_supprimes := v_supprimes + 1;
    else
      -- D'autres praticiens travaillent ici : on ne retire que l'appartenance.
      delete from public.practice_members
       where practice_id = c.practice_id and user_id = v_user;
      v_quittes := v_quittes + 1;
    end if;
  end loop;

  delete from auth.users where id = v_user;

  return jsonb_build_object(
    'cabinets_supprimes', v_supprimes,
    'cabinets_quittes', v_quittes,
    'dossiers_supprimes', v_dossiers,
    'pieces_supprimees', v_pieces);
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
