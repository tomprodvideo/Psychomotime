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
