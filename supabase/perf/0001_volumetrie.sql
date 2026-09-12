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
  -- Les volumes. Modifier ici, pas ailleurs.
  n_dossiers   integer := 400;
  n_annees     integer := 8;
  v_patient    uuid;
  v_parcours   uuid;
  v_doc        uuid;
  v_pay        uuid;
  v_debut      timestamptz;
  i            integer;
  j            integer;
  v_seances    integer;
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
      (practice_id, first_name, last_name, birth_date, status, created_at)
    values (
      'c1111111-1111-4111-8111-111111111111',
      'Prenomfictif' || i,
      'Nomfictif' || i,
      -- Des naissances étalées, pour que les tris par date ne trient pas une
      -- colonne constante : un index paraîtrait alors parfait à tort.
      make_date(2005 + (i % 18), 1 + (i % 12), 1 + (i % 28)),
      case when i % 9 = 0 then 'archive' else 'actif' end,
      now() - make_interval(days => (i * 7) % (n_annees * 365)))
    returning id into v_patient;

    insert into public.care_pathways
      (practice_id, patient_id, label, status, waitlisted_on)
    values (
      'c1111111-1111-4111-8111-111111111111', v_patient,
      'Parcours ' || i,
      case when i % 11 = 0 then 'liste_attente'
           when i % 9 = 0 then 'clos' else 'actif' end,
      case when i % 11 = 0
           then (now() - make_interval(days => i % 200))::date end)
    returning id into v_parcours;

    -- Entre 4 et 24 séances par dossier : la dispersion compte, un nombre
    -- constant rendrait les estimations du planificateur trop faciles.
    v_seances := 4 + (i % 21);
    for j in 1..v_seances loop
      v_debut := date_trunc('hour', now())
               - make_interval(days => (i * 3 + j * 7) % (n_annees * 365))
               + make_interval(hours => 8 + (j % 9));
      insert into public.appointments
        (practice_id, patient_id, pathway_id, kind, starts_at, ends_at,
         attendance, billable)
      values (
        'c1111111-1111-4111-8111-111111111111', v_patient, v_parcours,
        case when j = 1 then 'bilan' else 'seance' end,
        v_debut, v_debut + interval '45 minutes',
        case when v_debut > now() then 'prevu'
             when j % 13 = 0 then 'absence_non_excusee'
             when j % 17 = 0 then 'annule_par_patient'
             else 'honore' end,
        true);
    end loop;

    -- Une facture émise tous les trois dossiers, avec ses lignes et son
    -- règlement : de quoi mesurer les listes de la comptabilité.
    if i % 3 = 0 then
      insert into public.billing_documents
        (practice_id, kind, patient_id, pathway_id, payer_is_patient,
         status, series, number, issued_on, total_cents,
         snapshot, created_at)
      values (
        'c1111111-1111-4111-8111-111111111111', 'facture', v_patient, v_parcours,
        true, 'emis', 'VOL',
        'VOL' || lpad(i::text, 6, '0'),
        (now() - make_interval(days => (i * 5) % (n_annees * 365)))::date,
        0,
        jsonb_build_object(
          'cabinet', jsonb_build_object('nom', 'Cabinet de volumétrie fictive'),
          'patient', jsonb_build_object('nom', 'Prenomfictif' || i)),
        now() - make_interval(days => (i * 5) % (n_annees * 365)))
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
