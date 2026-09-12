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
--     L'appelant s'en charge APRÈS, une fois qu'il n'y a plus de retour
--     possible, et il compare ce qui a été retiré à ce qui devait l'être.
--
--  ── UNE INCOHÉRENCE TRANSITOIRE, CONSIGNÉE ────────────────────────────────
--
--  Les tables de la v1 encore en service — `settings`, `invoices`, `bilans`,
--  `documents`, `expenses` — sont clés sur `user_id` avec cascade. Supprimer
--  `auth.users` les emporte donc TOUJOURS, y compris quand le cabinet, lui,
--  survit parce qu'il est partagé. L'écran annonce alors « seule votre
--  appartenance est retirée », ce qui est vrai du modèle cible et faux de ces
--  tables-là.
--
--  Sans effet aujourd'hui : aucun écran ne permet d'ajouter un membre à un
--  cabinet, donc le cas ne peut pas se produire. Il devient bloquant le jour
--  où le partage s'ouvre, et il disparaît quand les tables v1 disparaissent,
--  au lot des transmissions. [A-59]
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
  v_d integer;
  v_p integer;
  v_lignes integer;
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
    /* SEULS LES MEMBRES ACTIFS COMPTENT. Une invitation jamais acceptée ou une
     * appartenance révoquée n'est pas quelqu'un qui travaille dans ce cabinet.
     * Les compter bloquait l'effacement définitivement — et le message
     * demandait alors de retirer des membres par un écran qui n'existe pas. */
    if (select count(*) from public.practice_members m2
         where m2.practice_id = c.practice_id
           and m2.status = 'active') > 1
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
             where m2.practice_id = m.practice_id
               and m2.status = 'active') as membres_actifs
      from public.practice_members m
      join public.practices p on p.id = m.practice_id
     where m.user_id = v_user
  loop
    if c.membres_actifs <= 1 then
      -- Le compte est le seul à travailler ici : le cabinet n'est qu'à lui.
      select count(*) into v_d from public.patients
       where practice_id = c.practice_id;
      select count(*) into v_p from public.billing_documents
       where practice_id = c.practice_id;

      -- La trace est posée AVANT, pour qu'elle survive à la suppression :
      -- `audit_events.practice_id` passe alors à null et la ligne demeure.
      insert into public.audit_events
        (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
      values (c.practice_id, v_user, 'practice.delete_with_account',
              'practice', c.practice_id,
              jsonb_build_object('dossiers', v_d, 'pieces', v_p));

      delete from public.practices where id = c.practice_id;

      /* ON VÉRIFIE CE QU'ON VIENT DE FAIRE, et ce n'est pas une précaution
       * décorative. Toutes les tables sont en `force row level security`, et
       * `practices` n'a aucune politique DELETE : si le propriétaire de cette
       * fonction venait à perdre l'attribut qui lui fait contourner la RLS, le
       * `delete` serait FILTRÉ — zéro ligne, aucune erreur. La fonction
       * annoncerait une suppression qui n'a pas eu lieu, les fichiers du
       * stockage seraient détruits, et le cabinet resterait : le défaut
       * d'origine sous une autre cause.
       *
       * C'est la doctrine déjà écrite dans `lib/auth/guard.ts` : zéro ligne
       * affectée EST un échec. Elle vaut aussi en base. */
      get diagnostics v_lignes = row_count;
      if v_lignes = 0 then
        raise exception
          'La suppression du cabinet « % » n''a affecté aucune ligne. Rien n''a été supprimé.',
          c.name using errcode = 'internal_error';
      end if;

      v_supprimes := v_supprimes + 1;
      -- Les compteurs s'ACCUMULENT : écrasés à chaque tour, ils ne rendaient
      -- que le dernier cabinet parcouru.
      v_dossiers := v_dossiers + v_d;
      v_pieces := v_pieces + v_p;
    else
      -- D'autres praticiens travaillent ici : on ne retire que l'appartenance.
      delete from public.practice_members
       where practice_id = c.practice_id and user_id = v_user;
      get diagnostics v_lignes = row_count;
      if v_lignes = 0 then
        raise exception
          'Le retrait de votre appartenance au cabinet « % » n''a affecté aucune ligne.',
          c.name using errcode = 'internal_error';
      end if;
      v_quittes := v_quittes + 1;
    end if;
  end loop;

  delete from auth.users where id = v_user;
  get diagnostics v_lignes = row_count;
  if v_lignes = 0 then
    raise exception
      'Le compte n''a pas pu être supprimé. Aucune de vos données n''a été supprimée.'
      using errcode = 'internal_error';
  end if;

  return jsonb_build_object(
    'cabinets_supprimes', v_supprimes,
    'cabinets_quittes', v_quittes,
    'dossiers_supprimes', v_dossiers,
    'pieces_supprimees', v_pieces);
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
