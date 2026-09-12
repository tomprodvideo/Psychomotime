-- ============================================================================
--  VOLUMÉTRIE — UN CABINET FICTIF DE TAILLE RÉALISTE
-- ============================================================================
--  Le jeu de démonstration compte cinq dossiers et dix-sept rendez-vous. À
--  cette échelle, TOUT est rapide, y compris ce qui ne tiendra pas : un balayage
--  complet de table sur cinq lignes coûte moins qu'un parcours d'index.
--
--  Les budgets de performance ne veulent donc rien dire tant qu'on ne mesure
--  pas sur un volume que le produit rencontrera. Ce fichier le fabrique.
--
--  ── L'ÉCHELLE, ET POURQUOI CELLE-CI ───────────────────────────────────────
--
--  Une psychomotricienne libérale à temps plein reçoit de l'ordre de 25 à 30
--  personnes par semaine. Sur dix ans d'exercice, avec les dossiers clos qui
--  restent en base, quelques centaines de dossiers et quelques milliers de
--  séances sont un ordre de grandeur plausible.
--
--  [HYPOTHÈSE — produit] Ces nombres ne sont PAS une mesure de l'activité
--  réelle d'un cabinet : personne ne me l'a fournie. Ils servent à donner aux
--  budgets un point d'appui honnête, et se règlent par les variables
--  ci-dessous. Ce qui compte n'est pas leur exactitude mais leur ordre de
--  grandeur : un défaut qui se voit à 400 dossiers se verrait à 250.
--
--  ── CE QUE CE FICHIER N'EST PAS ───────────────────────────────────────────
--
--  Ce n'est pas un jeu de démonstration : les noms sont engendrés par
--  concaténation et n'ont aucune vraisemblance. Il ne s'applique QUE sur une
--  base jetable, jamais sur la base de développement ni ailleurs.
-- ============================================================================

\set ON_ERROR_STOP on

-- Un cabinet à part, pour que les mesures ne dépendent pas du jeu de
-- démonstration et que celui-ci reste lisible.
\set cabinet   '''c1111111-1111-4111-8111-111111111111'''
\set titulaire '''c0000000-0000-4000-8000-000000000001'''

do $$
declare
  /* Les volumes. Réglables sans toucher au fichier :
   *   BUDGET_DOSSIERS=2000 npm run db:budget
   * Le défaut vise un cabinet plausible ; les valeurs hautes servent à
   * chercher LE POINT DE RUPTURE, qui est une information utile en soi. */
  n_dossiers   integer := coalesce(
    nullif(current_setting('budget.dossiers', true), '')::integer, 400);
  n_annees     integer := 8;
  v_patient    uuid;
  v_parcours   uuid;
  v_doc        uuid;
  v_pay        uuid;
  v_debut      timestamptz;
  i            integer;
  j            integer;
  v_seances    integer;
  v_statut     text;
  v_ouvert     date;
  v_total      bigint;
begin
  insert into auth.users (id, email)
  values ('c0000000-0000-4000-8000-000000000001',
          'volumetrie@exemple-fictif.test')
  on conflict (id) do nothing;

  insert into public.practices (id, name)
  values ('c1111111-1111-4111-8111-111111111111', 'Cabinet de volumétrie fictive');
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('c1111111-1111-4111-8111-111111111111',
          'c0000000-0000-4000-8000-000000000001', 'owner', 'active');

  for i in 1..n_dossiers loop
    insert into public.patients
      (practice_id, first_name, last_name, birth_date, status,
       archived_at, archive_reason, created_at)
    values (
      'c1111111-1111-4111-8111-111111111111',
      'Prenomfictif' || i,
      'Nomfictif' || i,
      -- Des naissances étalées, pour que les tris par date ne trient pas une
      -- colonne constante : un index paraîtrait alors parfait à tort.
      make_date(2005 + (i % 18), 1 + (i % 12), 1 + (i % 28)),
      -- Un dossier archivé porte sa date et son motif : la contrainte du modèle
      -- l'exige, et c'est elle qui empêche un archivage sans explication.
      case when i % 9 = 0 then 'archive' else 'actif' end,
      case when i % 9 = 0
           then now() - make_interval(days => (i * 7) % (n_annees * 365)) end,
      case when i % 9 = 0 then 'Fin de prise en soin (jeu de volumétrie)' end,
      now() - make_interval(days => (i * 7) % (n_annees * 365)))
    returning id into v_patient;

    -- Un parcours terminé PORTE SA DATE DE FIN : `care_pathways_fin_ck` l'exige,
    -- et c'est elle qui empêche un dossier clos sans date de clôture.
    v_ouvert := (now() - make_interval(days => (i * 7) % (n_annees * 365)))::date;
    v_statut := case when i % 11 = 0 then 'liste_attente'
                     when i % 9 = 0 then 'termine' else 'actif' end;
    insert into public.care_pathways
      (practice_id, patient_id, label, status, waitlisted_on, started_on, ended_on)
    values (
      'c1111111-1111-4111-8111-111111111111', v_patient,
      'Parcours ' || i,
      v_statut,
      case when v_statut = 'liste_attente'
           then (now() - make_interval(days => i % 200))::date end,
      v_ouvert,
      /* La date de fin suit LE STATUT CALCULÉ, pas une seconde condition :
       * les deux divergeaient pour i divisible par 9 et par 11 à la fois, et
       * le modèle refusait — à juste titre — un parcours en liste d'attente
       * portant une date de clôture.
       *
       * Elle se DÉDUIT de la date d'ouverture, elle ne se calcule pas à part :
       * deux formules indépendantes finissaient par se croiser aux grands
       * volumes, et un parcours se fermait avant de s'ouvrir. Trouvé en
       * cherchant le point de rupture à 2 000 dossiers. */
      case when v_statut = 'termine'
           then least(v_ouvert + (30 + (i % 400)), current_date) end)
    returning id into v_parcours;

    -- Entre 4 et 24 séances par dossier : la dispersion compte, un nombre
    -- constant rendrait les estimations du planificateur trop faciles.
    v_seances := 4 + (i % 21);
    for j in 1..v_seances loop
      /* L'ÉTALEMENT COUVRE AUSSI AUJOURD'HUI ET LES SEMAINES À VENIR.
       *
       * Une première version ne produisait que du passé : les deux mesures de
       * l'accueil — la journée, et les rendez-vous à renseigner — portaient
       * alors sur ZÉRO ligne et ne mesuraient rien. Un budget tenu sur un
       * ensemble vide est un budget qui ne dit rien.
       *
       * Un dossier sur sept a donc une séance aujourd'hui, un sur cinq une
       * séance dans les jours qui viennent. */
      v_debut := date_trunc('day', now())
               + make_interval(hours => 8 + (j % 9))
               + case
                   when i % 7 = 0 and j = 2 then interval '0 day'
                   when i % 5 = 0 and j = 3 then make_interval(days => 1 + (i % 6))
                   else - make_interval(
                          days => 1 + ((i * 3 + j * 7) % (n_annees * 365)))
                 end;
      /* Le vocabulaire des présences est celui du modèle, pas un vocabulaire
       * inventé pour la mesure : `a_venir`, `honore`, `absent_non_excuse`,
       * `annule_patient`. Et une absence non excusée PORTE SON MOTIF —
       * `appointments_motif_ck` l'exige, parce qu'une absence qu'on facturera
       * peut-être ne se constate pas sans un mot d'explication. */
      insert into public.appointments
        (practice_id, patient_id, pathway_id, kind, starts_at, ends_at,
         attendance, attendance_note, billable)
      values (
        'c1111111-1111-4111-8111-111111111111', v_patient, v_parcours,
        case when j = 1 then 'bilan' else 'seance' end,
        v_debut, v_debut + interval '45 minutes',
        case when v_debut > now() then 'a_venir'
             -- Un rendez-vous passé qu'on n'a pas encore renseigné : c'est le
             -- blocage silencieux du produit, et l'accueil doit le remonter.
             when j % 11 = 0 then 'a_venir'
             when j % 13 = 0 then 'absent_non_excuse'
             when j % 17 = 0 then 'annule_patient'
             else 'honore' end,
        case when v_debut <= now() and j % 13 = 0 and j % 11 <> 0
             then 'Non prévenue (jeu de volumétrie)' end,
        true);
    end loop;

    -- Une facture émise tous les trois dossiers, avec ses lignes et son
    -- règlement : de quoi mesurer les listes de la comptabilité.
    if i % 3 = 0 then
      /* BROUILLON D'ABORD, LIGNES ENSUITE, ÉMISSION EN DERNIER — c'est l'ordre
       * que le moteur comptable impose, et il a raison : les lignes d'une
       * pièce émise ne se modifient plus. Un jeu de volumétrie qui contournerait
       * cette règle produirait des pièces qui n'existent pas dans le produit,
       * et mesurerait donc autre chose que le produit. */
      insert into public.billing_documents
        (practice_id, kind, patient_id, pathway_id, payer_is_patient, created_at)
      values (
        'c1111111-1111-4111-8111-111111111111', 'facture', v_patient, v_parcours,
        true, now() - make_interval(days => (i * 5) % (n_annees * 365)))
      returning id into v_doc;

      v_total := 0;
      for j in 1..(1 + (i % 4)) loop
        insert into public.billing_lines
          (practice_id, document_id, position, label,
           unit_price_cents, quantity, amount_cents)
        values ('c1111111-1111-4111-8111-111111111111', v_doc, j,
                'Séance de psychomotricité', 4500, 1, 4500);
        v_total := v_total + 4500;
      end loop;

      update public.billing_documents
         set status = 'emis', series = 'VOL',
             number = 'VOL' || lpad(i::text, 6, '0'),
             issued_on = (now() - make_interval(days => (i * 5) % (n_annees * 365)))::date,
             snapshot = jsonb_build_object(
               'cabinet', jsonb_build_object('nom', 'Cabinet de volumétrie fictive'),
               'patient', jsonb_build_object('nom', 'Prenomfictif' || i))
       where id = v_doc;

      -- Deux factures sur trois sont réglées : il faut des soldes non nuls
      -- pour que les listes « à régler » aient quelque chose à filtrer.
      if i % 3 = 0 and i % 9 <> 0 then
        insert into public.payments
          (practice_id, received_on, amount_cents, method)
        values ('c1111111-1111-4111-8111-111111111111',
                (now() - make_interval(days => (i * 5) % (n_annees * 365)))::date,
                v_total, 'virement')
        returning id into v_pay;
        insert into public.payment_allocations
          (practice_id, payment_id, document_id, amount_cents)
        values ('c1111111-1111-4111-8111-111111111111', v_pay, v_doc, v_total);
      end if;
    end if;
  end loop;
end
$$;

-- Sans statistiques à jour, le planificateur travaille sur des estimations
-- d'une table vide : on mesurerait un plan que la production n'aurait jamais.
analyze;
