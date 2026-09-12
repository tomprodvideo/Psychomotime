-- ============================================================================
--  JEU DE DONNÉES v1 — ENTIÈREMENT FICTIF
--  Chargé uniquement par `npm run db:cutover`, sur une base jetable, pour
--  rejouer la bascule sur des données qui ont la FORME de la production.
--  Jamais appliqué ailleurs.
-- ============================================================================

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-000000000001', 'praticienne.v1@exemple-fictif.test'),
  ('11111111-1111-4111-8111-000000000002', 'autre.v1@exemple-fictif.test')
on conflict (id) do nothing;

insert into public.settings (user_id, display_name)
values ('11111111-1111-4111-8111-000000000001', 'Cabinet Girouette (fictif)')
on conflict (user_id) do update set display_name = excluded.display_name;

-- NOTE SUR LA v1 : le déclencheur `handle_new_user` crée automatiquement une
-- ligne d'abonnement « trialing » à l'inscription. Un compte SANS abonnement
-- n'existe donc pas en production. Le jeu d'essai le reflète : on force l'état
-- du premier compte, et on laisse le second tel que le déclencheur l'a posé.
insert into public.subscriptions (user_id, email, status, manual_override)
values ('11111111-1111-4111-8111-000000000001',
        'praticienne.v1@exemple-fictif.test', 'active', true)
on conflict (user_id) do update
   set status = excluded.status,
       manual_override = excluded.manual_override,
       trial_end = null;

-- Un dossier complet : responsable légal ET dossier de suivi renseignés.
insert into public.patients
  (id, user_id, first_name, last_name, birth_date, email, phone, address, notes,
   guardian, dossier)
values (
  '22222222-2222-4222-8222-000000000001',
  '11111111-1111-4111-8111-000000000001',
  'Marceline', 'Cabriole', date '2017-03-14',
  'famille.cabriole@exemple-fictif.test', '00 00 00 00 11',
  '5 place du Cerf-Volant Fictif',
  'Arrive souvent en avance.',
  jsonb_build_object(
    'relation', 'Mère',
    'first_name', 'Perrine',
    'last_name', 'Cabriole',
    'phone', '00 00 00 00 12',
    'email', 'perrine.cabriole@exemple-fictif.test',
    'address', '5 place du Cerf-Volant Fictif'),
  jsonb_build_object(
    'prescripteur', 'Dr Églantine Fictive',
    'ordonnance_date', '2026-02-10',
    'referrer', 'Enseignante de CE1',
    'motif', 'Gêne à l''écrit signalée en classe.',
    'diagnostic', 'Aucun diagnostic médical communiqué à ce jour.',
    'hypothese', 'À explorer côté graphomotricité.',
    'accompagnement', 'Séances hebdomadaires envisagées.',
    'school', 'École des Moulins Imaginaires',
    'autres_suivis', 'Orthophonie en cours.',
    'complement', 'Fratrie de trois.')
);

-- Un dossier minimal : ni responsable légal, ni dossier de suivi.
insert into public.patients (id, user_id, first_name, last_name, birth_date)
values ('22222222-2222-4222-8222-000000000002',
        '11111111-1111-4111-8111-000000000001',
        'Gustave', 'Ritournelle', date '1955-08-21');

-- Un dossier SANS AUCUN NOM : la contrainte de la cible l'interdit. La reprise
-- doit le conserver avec un libellé explicite, pas le perdre.
insert into public.patients (id, user_id, first_name, last_name)
values ('22222222-2222-4222-8222-000000000003',
        '11111111-1111-4111-8111-000000000001', '', '');

-- Un patient d'un AUTRE compte : la reprise doit créer deux cabinets distincts.
insert into public.patients (id, user_id, first_name, last_name)
values ('22222222-2222-4222-8222-000000000004',
        '11111111-1111-4111-8111-000000000002', 'Isaure', 'Farandole');

-- Un bilan et une facture rattachés : leurs liens doivent survivre.
insert into public.bilans (id, user_id, patient_id, patient_name, title, bilan_date)
values ('33333333-3333-4333-8333-000000000001',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000001',
        'Marceline Cabriole', 'Bilan psychomoteur', date '2026-02-20');

insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number, revenue_gross)
values ('44444444-4444-4444-8444-000000000001',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000001',
        'Marceline Cabriole', 'F2026-001', 65);

-- ============================================================================
--  FACTURES v1 — les formes que la production peut contenir
-- ============================================================================
--  Chaque ligne ci-dessous existe pour un cas que la reprise doit traiter
--  autrement qu'en le copiant. Elles sont toutes fictives.

-- Payée intégralement, rattachée à un mois, avec PCO et estimations dérivées.
insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number,
   billing_month, billing_year, has_pco, revenue_gross, revenue_gross_paid,
   payment_method, payment_date, issue_date, service_label,
   retrocession_amount, urssaf_amount, notes)
values ('44444444-4444-4444-8444-000000000002',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000001',
        'Marceline Cabriole', 'F2026-002',
        'mars', 2026, true, 130, 130,
        'Virement', date '2026-03-28', date '2026-03-25',
        'Deux séances de psychomotricité',
        13, 25.74, 'Réglé sans relance.');

-- Partiellement payée : la v1 ne montrait qu'un total payé, jamais un solde.
insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number,
   billing_month, billing_year, revenue_gross, revenue_gross_paid,
   payment_method, payment_date, issue_date, service_label)
values ('44444444-4444-4444-8444-000000000003',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000002',
        'Gustave Ritournelle', 'F2026-003',
        'avril', 2026, 90, 45,
        'Chèque', date '2026-04-12', date '2026-04-02',
        'Bilan psychomoteur — acompte');

-- Sans numéro et sans patient : la v1 l'autorisait. Rien ne doit être inventé.
insert into public.invoices
  (id, user_id, patient_name, revenue_gross, issue_date, service_label)
values ('44444444-4444-4444-8444-000000000004',
        '11111111-1111-4111-8111-000000000001',
        '', 50, date '2026-04-20', '');

-- Numéro EN DOUBLON dans le même compte : aucune contrainte ne l'empêchait.
insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number,
   revenue_gross, issue_date, service_label)
values ('44444444-4444-4444-8444-000000000005',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000002',
        'Gustave Ritournelle', 'F2026-001',
        70, date '2026-05-04', 'Séance de psychomotricité');

-- Plusieurs prestations sur une facture (colonne `lines`, migration v1 013).
insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number,
   revenue_gross, issue_date, service_label, lines)
values ('44444444-4444-4444-8444-000000000006',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000001',
        'Marceline Cabriole', 'F2026-004',
        195, date '2026-05-18', 'Séances et réunion',
        jsonb_build_array(
          jsonb_build_object(
            'id', 'aaaaaaaa-0000-4000-8000-000000000001',
            'catalog_id', null,
            'label', 'Séance de psychomotricité',
            'pricing', 'unitaire', 'unit_price', 45, 'quantity', 3,
            'dates', jsonb_build_array('2026-05-05', '2026-05-12', '2026-05-19'),
            'amount', 135, 'date_render', 'par_date',
            'intro', 'Séances réalisées aux dates suivantes :', 'note', null),
          jsonb_build_object(
            'id', 'aaaaaaaa-0000-4000-8000-000000000002',
            'catalog_id', null,
            'label', 'Réunion de coordination',
            'pricing', 'forfait', 'unit_price', 60, 'quantity', 1,
            'dates', jsonb_build_array('2026-05-22'),
            'amount', 60, 'date_render', 'liste',
            'intro', null, 'note', 'À la demande de l''école.')));

-- Encaissé SUPÉRIEUR au brut : le surplus est un trop-perçu, pas une affectation.
insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number,
   revenue_gross, revenue_gross_paid, payment_method, payment_date,
   issue_date, service_label)
values ('44444444-4444-4444-8444-000000000007',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000001',
        'Marceline Cabriole', 'F2026-005',
        60, 80, 'Espèces', date '2026-06-02', date '2026-06-01',
        'Séance de psychomotricité');

-- Facture d'un compte pointant le patient d'un AUTRE compte : le lien doit être
-- coupé, jamais suivi.
insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number,
   revenue_gross, issue_date, service_label)
values ('44444444-4444-4444-8444-000000000008',
        '11111111-1111-4111-8111-000000000001',
        '22222222-2222-4222-8222-000000000004',
        'Isaure Farandole', 'F2026-006',
        55, date '2026-06-15', 'Séance de psychomotricité');

-- Second compte, MÊME numéro que le premier : l'unicité est par cabinet, ce
-- numéro doit donc rester intact.
insert into public.invoices
  (id, user_id, patient_id, patient_name, invoice_number,
   revenue_gross, issue_date, service_label)
values ('44444444-4444-4444-8444-000000000009',
        '11111111-1111-4111-8111-000000000002',
        '22222222-2222-4222-8222-000000000004',
        'Isaure Farandole', 'F2026-001',
        80, date '2026-06-20', 'Séance de psychomotricité');

-- Le compteur de la v1 : le dernier rang ATTRIBUÉ, plus haut que le plus grand
-- numéro visible, parce qu'une facture a été supprimée depuis.
insert into public.invoice_counters (user_id, scope, last_seq)
values ('11111111-1111-4111-8111-000000000001', 'F2026-{N}', 7),
       ('11111111-1111-4111-8111-000000000002', 'F2026-{N}', 1)
on conflict (user_id, scope) do update set last_seq = excluded.last_seq;

-- Réglages du compte : gabarit de numérotation NON standard, taux, et un
-- catalogue de prestations. Tout doit survivre à la bascule.
update public.settings
   set retrocession_rate = 0.25,
       urssaf_rate = 0.232,
       charge_mode = 'retrocession',
       profile = jsonb_build_object(
         'invoice_number_format', 'F{AAAA}-{NNN}',
         'service_catalog', jsonb_build_array(
           jsonb_build_object(
             'id', 'cccccccc-0000-4000-8000-000000000001',
             'label', 'Séance de psychomotricité',
             'unit_price', 45, 'pricing', 'unitaire',
             'default_date_render', 'par_date',
             'intro', 'Séances réalisées aux dates suivantes :',
             'active', true),
           jsonb_build_object(
             'id', 'cccccccc-0000-4000-8000-000000000002',
             'label', 'Réunion de coordination',
             'unit_price', 60, 'pricing', 'forfait',
             'default_date_render', 'liste',
             'intro', '', 'active', false)))
 where user_id = '11111111-1111-4111-8111-000000000001';

-- La première facture du jeu reçoit sa date d'émission : sans elle, l'ordre de
-- reprise dépendrait de l'heure d'exécution du test.
update public.invoices set issue_date = date '2026-02-20'
 where id = '44444444-4444-4444-8444-000000000001';

-- Les lignes de la facture multi-prestations pointent le catalogue.
update public.invoices
   set lines = jsonb_set(
         jsonb_set(lines, '{0,catalog_id}', '"cccccccc-0000-4000-8000-000000000001"'),
         '{1,catalog_id}', '"cccccccc-0000-4000-8000-000000000002"')
 where id = '44444444-4444-4444-8444-000000000006';

-- Charges du cabinet : une ponctuelle datée, une sans date, une d'un autre type.
insert into public.expenses (user_id, type, label, amount, expense_date, notes)
values ('11111111-1111-4111-8111-000000000001', 'loyer',
        'Loyer du cabinet — mars', 383.33, date '2026-03-05', 'Virement mensuel.'),
       ('11111111-1111-4111-8111-000000000001', 'urssaf',
        'Acompte URSSAF', 420, date '2026-04-15', null),
       ('11111111-1111-4111-8111-000000000001', 'autre',
        'Matériel de passation', 89.90, null, 'Facture égarée.');

-- Une dépense récurrente, rangée par la v1 dans le JSON des réglages, donc
-- hors de toute période : la reprise doit lui donner une date de début.
update public.settings
   set profile = profile || jsonb_build_object(
         'recurring_expenses', jsonb_build_array(
           jsonb_build_object(
             'id', 'dddddddd-0000-4000-8000-000000000001',
             'label', 'Assurance responsabilité civile',
             'amount', 21.5, 'period', 'mensuel', 'active', true)))
 where user_id = '11111111-1111-4111-8111-000000000001';
