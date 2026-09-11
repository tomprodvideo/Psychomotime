-- ============================================================================
--  SEEDS — DOSSIERS ENTIÈREMENT FICTIFS
-- ============================================================================
--  Aucune donnée réelle. Les noms sont volontairement invraisemblables.
--
--  Ces dossiers ne sont pas décoratifs : chacun représente une situation que le
--  modèle précédent ne savait PAS représenter. Ils servent de jeu de référence
--  aux tests et de démonstration.
--
--   · Fratrie Pirouette — deux enfants, la même mère, un seul contact partagé.
--     Garde alternée : deux titulaires de l'autorité parentale, deux adresses.
--   · Le père n'est destinataire que pour l'aîné. Le lien est daté.
--   · Le payeur est la grand-mère : ni le patient, ni un responsable légal.
--   · Prescripteur (médecin) et adresseur (enseignante) sont deux personnes.
--   · Un majeur sous curatelle — régime distinct de l'autorité parentale.
--   · Un parcours PCO, où le payeur n'est pas la famille.
-- ============================================================================

-- =====================================================  CONTACTS du cabinet A
insert into public.contacts
  (id, practice_id, kind, first_name, last_name, email, phone,
   address_line1, postal_code, city)
values
  -- Mère, titulaire de l'autorité parentale sur les deux enfants.
  ('a5000000-0000-4000-8000-000000000001',
   'a1111111-1111-4111-8111-111111111111', 'personne',
   'Ondine', 'Pirouette', 'ondine.pirouette@exemple-fictif.test', '00 00 00 00 01',
   '4 allée des Toupies Imaginaires', '00000', 'Villefictive'),
  -- Père, autre domicile.
  ('a5000000-0000-4000-8000-000000000002',
   'a1111111-1111-4111-8111-111111111111', 'personne',
   'Anselme', 'Pirouette', 'anselme.pirouette@exemple-fictif.test', '00 00 00 00 02',
   '17 quai des Cerfs-Volants', '00000', 'Villefictive'),
  -- Grand-mère : payeuse, sans autorité parentale.
  ('a5000000-0000-4000-8000-000000000003',
   'a1111111-1111-4111-8111-111111111111', 'personne',
   'Hortense', 'Farandole', null, '00 00 00 00 03',
   '2 sentier du Cerceau', '00000', 'Villefictive');

insert into public.contacts
  (id, practice_id, kind, first_name, last_name, profession, rpps, email)
values
  -- Médecin prescripteur. Le RPPS est une suite factice.
  ('a5000000-0000-4000-8000-000000000004',
   'a1111111-1111-4111-8111-111111111111', 'personne',
   'Barnabé', 'Tournesol-Fictif', 'Médecin généraliste', '00000000001',
   'cabinet.tournesol@exemple-fictif.test');

insert into public.contacts
  (id, practice_id, kind, organisation_name, email, address_line1, postal_code, city)
values
  -- Établissement scolaire : adresseur ET destinataire potentiel, sous réserve
  -- d'un consentement explicite.
  ('a5000000-0000-4000-8000-000000000005',
   'a1111111-1111-4111-8111-111111111111', 'organisation',
   'École élémentaire des Trois Cerceaux (fictive)',
   'ecole.troiscerceaux@exemple-fictif.test',
   '9 rue de la Récréation Inventée', '00000', 'Villefictive'),
  -- Plateforme de coordination : payeur d'un parcours, jamais la famille.
  ('a5000000-0000-4000-8000-000000000006',
   'a1111111-1111-4111-8111-111111111111', 'organisation',
   'Plateforme de coordination et d''orientation (fictive)',
   'pco@exemple-fictif.test',
   '1 avenue de la Coordination Imaginaire', '00000', 'Villefictive');

-- =====================================================  PATIENTS du cabinet A
insert into public.patients
  (id, practice_id, first_name, last_name, birth_date, norm_reference_sex,
   administrative_notes, created_by)
values
  -- Aîné, 8 ans. Aucune coordonnée propre : ce sont celles des parents.
  ('a6000000-0000-4000-8000-000000000001',
   'a1111111-1111-4111-8111-111111111111',
   'Zéphyr', 'Pirouette', date '2018-04-12', 'm',
   'Vient à pied depuis l''école. Créneau de fin d''après-midi souhaité.',
   'a0000000-0000-4000-8000-000000000001'),
  -- Cadette, 5 ans. Même mère : le contact est partagé, pas dupliqué.
  ('a6000000-0000-4000-8000-000000000002',
   'a1111111-1111-4111-8111-111111111111',
   'Capucine', 'Pirouette', date '2021-09-30', 'f',
   null,
   'a0000000-0000-4000-8000-000000000001'),
  -- Adulte sous curatelle : régime de protection d'un majeur, qui n'a rien à
  -- voir avec l'autorité parentale.
  ('a6000000-0000-4000-8000-000000000003',
   'a1111111-1111-4111-8111-111111111111',
   'Aristide', 'Bourrasque', date '1968-02-03', 'm',
   'Se déplace en transport adapté. Prévoir 15 minutes de battement.',
   'a0000000-0000-4000-8000-000000000001'),
  -- Dossier archivé : doit disparaître des listes actives sans être effacé.
  ('a6000000-0000-4000-8000-000000000004',
   'a1111111-1111-4111-8111-111111111111',
   'Philomène', 'Trampoline', date '2014-11-05', 'f',
   null,
   'a0000000-0000-4000-8000-000000000001');

update public.patients
   set status = 'archive',
       archived_at = now() - interval '200 days',
       archive_reason = 'Déménagement hors secteur, relais transmis.'
 where id = 'a6000000-0000-4000-8000-000000000004';

-- Contact protecteur du majeur.
insert into public.contacts
  (id, practice_id, kind, first_name, last_name, phone)
values
  ('a5000000-0000-4000-8000-000000000007',
   'a1111111-1111-4111-8111-111111111111', 'personne',
   'Léonie', 'Bourrasque', '00 00 00 00 07');

-- ========================================  LIENS : six rôles, pas un seul champ
insert into public.patient_contacts
  (practice_id, patient_id, contact_id, role, legal_basis, relationship,
   valid_from, is_primary, note)
values
  -- Zéphyr : les DEUX parents détiennent l'autorité parentale.
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001',
   'responsable_legal', 'autorite_parentale', 'Mère', date '2018-04-12', true, null),
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000002',
   'responsable_legal', 'autorite_parentale', 'Père', date '2018-04-12', false,
   'Résidence alternée : adresse distincte.'),
  -- Destinataire des comptes rendus : les deux parents, explicitement.
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000001',
   'destinataire', null, 'Mère', date '2026-01-15', true, null),
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000002',
   'destinataire', null, 'Père', date '2026-01-15', false, null),
  -- Payeuse : la grand-mère. Ni patiente, ni responsable légale.
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000003',
   'payeur', null, 'Grand-mère maternelle', date '2026-01-15', true,
   'Règle les honoraires. N''est destinataire d''aucun document clinique.'),
  -- Établissement : adresseur.
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a5000000-0000-4000-8000-000000000005',
   'etablissement', null, 'École', date '2026-01-10', true, null),

  -- Capucine : le MÊME contact « mère », réutilisé. Une seule adresse à tenir.
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000002',
   'a5000000-0000-4000-8000-000000000001',
   'responsable_legal', 'autorite_parentale', 'Mère', date '2021-09-30', true, null),
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000002',
   'a5000000-0000-4000-8000-000000000002',
   'responsable_legal', 'autorite_parentale', 'Père', date '2021-09-30', false, null),
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000002',
   'a5000000-0000-4000-8000-000000000001',
   'destinataire', null, 'Mère', date '2026-02-01', true,
   'Le père n''est pas destinataire pour cette enfant : demande de la famille.'),

  -- Aristide : protection d'un MAJEUR. `legal_basis` dit lequel.
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000003',
   'a5000000-0000-4000-8000-000000000007',
   'responsable_legal', 'curatelle', 'Sœur, curatrice', date '2023-06-01', true, null),
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000003',
   'a5000000-0000-4000-8000-000000000007',
   'destinataire', null, 'Sœur, curatrice', date '2023-06-01', true, null);

-- Lien CLOS : le père a été destinataire pour Capucine jusqu'en janvier.
-- On conserve la ligne : savoir à qui l'on a légitimement écrit fait partie de
-- la trace. C'est ce qu'un champ écrasé faisait disparaître.
insert into public.patient_contacts
  (practice_id, patient_id, contact_id, role, relationship, valid_from, valid_to, note)
values
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000002',
   'a5000000-0000-4000-8000-000000000002',
   'destinataire', 'Père', date '2025-09-01', date '2026-01-31',
   'Retiré à la demande de la famille.');

-- ==========================================================  PARCOURS DE SOIN
insert into public.care_pathways
  (id, practice_id, patient_id, label, status, referral_reason,
   referral_source_contact_id, prescriber_contact_id, prescription_date,
   funding_scheme, requested_on, started_on, created_by)
values
  -- Parcours libéral classique, actif.
  ('a7000000-0000-4000-8000-000000000001',
   'a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'Bilan puis suivi — écriture et coordination', 'actif',
   'Fatigue à l''écrit signalée par l''enseignante, gêne pour suivre le rythme de la classe.',
   'a5000000-0000-4000-8000-000000000005',
   'a5000000-0000-4000-8000-000000000004', date '2026-01-08',
   'liberal', date '2026-01-10', date '2026-01-22',
   'a0000000-0000-4000-8000-000000000001'),

  -- Parcours PCO : le payeur n'est pas la famille. Le circuit complet est
  -- traité au lot 5 ; ici, seul le rattachement existe.
  ('a7000000-0000-4000-8000-000000000002',
   'a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000002',
   'Parcours de repérage — plateforme de coordination', 'actif',
   'Adressée par la plateforme dans le cadre d''un repérage.',
   'a5000000-0000-4000-8000-000000000006',
   'a5000000-0000-4000-8000-000000000004', date '2026-02-02',
   'pco', date '2026-02-02', date '2026-02-18',
   'a0000000-0000-4000-8000-000000000001'),

  -- Demande en attente : ni refusée, ni commencée.
  ('a7000000-0000-4000-8000-000000000003',
   'a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000003',
   'Demande d''évaluation — équilibre et déplacements', 'liste_attente',
   'Chutes répétées depuis six mois, signalées par la curatrice.',
   null,
   'a5000000-0000-4000-8000-000000000004', date '2026-08-20',
   'liberal', date '2026-08-25', null,
   'a0000000-0000-4000-8000-000000000001');

-- Parcours clos, pour que la comparaison initial / réévaluation ait un support.
insert into public.care_pathways
  (practice_id, patient_id, label, status, referral_reason,
   prescriber_contact_id, prescription_date, funding_scheme,
   requested_on, started_on, ended_on, end_reason)
values
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000004',
   'Suivi 2024-2025', 'termine',
   'Difficultés de coordination signalées en grande section.',
   'a5000000-0000-4000-8000-000000000004', date '2024-09-15', 'liberal',
   date '2024-09-20', date '2024-10-07', date '2025-06-24',
   'Déménagement hors secteur. Relais transmis avec l''accord des parents.');

-- ================================================================  OBJECTIFS
insert into public.care_objectives
  (practice_id, pathway_id, label, detail, status, position, set_on, created_by)
values
  ('a1111111-1111-4111-8111-111111111111',
   'a7000000-0000-4000-8000-000000000001',
   'Tenir une ligne d''écriture sur dix minutes sans changer de prise',
   'Formulé avec l''enfant et ses parents. Réévaluation prévue en juin.',
   'en_cours', 1, date '2026-01-22',
   'a0000000-0000-4000-8000-000000000001'),
  ('a1111111-1111-4111-8111-111111111111',
   'a7000000-0000-4000-8000-000000000001',
   'Se repérer dans l''enchaînement des consignes en classe',
   null, 'en_cours', 2, date '2026-01-22',
   'a0000000-0000-4000-8000-000000000001'),
  ('a1111111-1111-4111-8111-111111111111',
   'a7000000-0000-4000-8000-000000000001',
   'Reprendre la course en récréation sans appréhension',
   null, 'atteint', 3, date '2026-01-22',
   'a0000000-0000-4000-8000-000000000001');

-- ===========================================================  NOTES CLINIQUES
insert into public.patient_notes
  (practice_id, patient_id, pathway_id, body, written_on,
   author_member_id, third_party_information, third_party_source)
values
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001',
   'Premier entretien. Se saisit du matériel sans attendre la consigne, puis s''arrête et cherche le regard. Tient la position assise au sol sur toute la durée.',
   date '2026-01-22',
   'a2222222-2222-4222-8222-222222222221', false, null),
  -- Note marquée « tiers » : L1111-7 CSP l'exclut du droit d'accès du patient.
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'a7000000-0000-4000-8000-000000000001',
   'Élément rapporté lors de l''appel, à ne pas reprendre tel quel dans un document remis.',
   date '2026-01-18',
   'a2222222-2222-4222-8222-222222222221', true,
   'Entretien téléphonique avec une tierce personne n''intervenant pas dans la prise en charge.');

-- ==============================================================  CONSENTEMENTS
insert into public.patient_consents
  (practice_id, patient_id, kind, scope, granted_by_contact_id,
   granted_on, evidence)
values
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'information_recue', null,
   'a5000000-0000-4000-8000-000000000001',
   date '2026-01-22', 'Notice remise en main propre, tracée en séance.'),
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'transmission_prescripteur',
   'Compte rendu de bilan au médecin prescripteur.',
   'a5000000-0000-4000-8000-000000000001',
   date '2026-01-22', 'Accord oral des deux parents, tracé le jour même.');

-- Consentement RETIRÉ : la ligne demeure. Savoir qu'une autorisation a existé
-- puis a été révoquée fait partie de la trace.
insert into public.patient_consents
  (practice_id, patient_id, kind, scope, granted_by_contact_id,
   granted_on, withdrawn_on, evidence)
values
  ('a1111111-1111-4111-8111-111111111111',
   'a6000000-0000-4000-8000-000000000001',
   'partage_etablissement',
   'Échange avec l''école sur les aménagements.',
   'a5000000-0000-4000-8000-000000000001',
   date '2026-02-05', date '2026-06-30',
   'Retrait demandé par les parents en fin d''année scolaire.');

-- ============================================  CABINET B — de quoi tester l'isolation
insert into public.contacts
  (id, practice_id, kind, first_name, last_name, email)
values
  ('b5000000-0000-4000-8000-000000000001',
   'b1111111-1111-4111-8111-111111111111', 'personne',
   'Solveig', 'Ricochet', 'solveig.ricochet@exemple-fictif.test');

insert into public.patients
  (id, practice_id, first_name, last_name, birth_date)
values
  ('b6000000-0000-4000-8000-000000000001',
   'b1111111-1111-4111-8111-111111111111',
   'Nils', 'Ricochet', date '2016-07-19');

insert into public.patient_contacts
  (practice_id, patient_id, contact_id, role, legal_basis, relationship, valid_from, is_primary)
values
  ('b1111111-1111-4111-8111-111111111111',
   'b6000000-0000-4000-8000-000000000001',
   'b5000000-0000-4000-8000-000000000001',
   'responsable_legal', 'autorite_parentale', 'Mère', date '2016-07-19', true);

insert into public.care_pathways
  (id, practice_id, patient_id, label, status, referral_reason, funding_scheme, started_on)
values
  ('b7000000-0000-4000-8000-000000000001',
   'b1111111-1111-4111-8111-111111111111',
   'b6000000-0000-4000-8000-000000000001',
   'Suivi en cours', 'actif', 'Motif de démonstration.', 'liberal', date '2026-03-02');

insert into public.patient_notes
  (practice_id, patient_id, body, written_on)
values
  ('b1111111-1111-4111-8111-111111111111',
   'b6000000-0000-4000-8000-000000000001',
   'Note de démonstration du cabinet B. Aucun membre du cabinet A ne doit pouvoir la lire.',
   date '2026-03-02');
