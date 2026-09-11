-- ============================================================================
--  SEEDS — REGISTRE D'INSTRUMENTS, ENTIÈREMENT FICTIF
-- ============================================================================
--  AUCUN instrument réel n'est nommé, et aucune borne ne provient d'un manuel.
--  Les découpages ci-dessous sont des conventions inventées pour les tests :
--  ils ne valent pour aucune pratique, et le produit n'en livre aucun.
-- ============================================================================

-- Instrument en RÉFÉRENCE SEULE : nommé, rien de plus. Aucune échelle ne peut
-- lui être rattachée — c'est ce que le test vérifie.
insert into public.instruments
  (id, practice_id, name, publisher, edition, age_min_months, age_max_months,
   normative_population, domains, licence_status, validity_warnings, created_by)
values (
  'a8000000-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  'Épreuve d''observation (fictive)', 'Éditeur imaginaire', '1re édition',
  36, 83, 'Population de démonstration, sans valeur',
  array['motricite_globale', 'equilibre'],
  'reference_seule',
  'Instrument de démonstration. Aucun résultat structuré ne doit en être tiré.',
  'a0000000-0000-4000-8000-000000000001');

-- Instrument dont le praticien cote lui-même, hors du logiciel.
insert into public.instruments
  (id, practice_id, name, publisher, edition, form, age_min_months, age_max_months,
   normative_population, domains, licence_status, licence_checked_on,
   licence_checked_by, validity_warnings, created_by)
values (
  'a8000000-0000-4000-8000-000000000002',
  'a1111111-1111-4111-8111-111111111111',
  'Batterie d''essai (fictive)', 'Éditeur imaginaire', '2e édition', 'Forme A',
  36, 191, 'Population de démonstration, sans valeur',
  array['motricite_fine', 'coordinations', 'graphomotricite'],
  'scores_saisis_par_le_praticien', current_date - 30,
  'Praticienne du cabinet de démonstration',
  'Étalonnage de démonstration. Ne pas employer pour une lecture clinique.',
  'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- échelle
insert into public.instrument_scales
  (id, practice_id, instrument_id, name, result_type, mean, sd,
   min_value, max_value, decimals, direction, note)
values (
  'a9000000-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  'a8000000-0000-4000-8000-000000000002',
  'Note standard d''essai', 'note_standard', 10, 3, 1, 19, 0,
  'croissant_favorable',
  'Échelle de démonstration. Les bornes sont une convention du cabinet, pas une reprise de manuel.');

-- ------------------------------------------------------------ vocabulaire
insert into public.band_vocabularies
  (id, practice_id, name, usage, validated_by, validated_on, note)
values (
  'aa000000-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  'Vocabulaire de démonstration', 'document_remis',
  'Praticienne du cabinet de démonstration', current_date - 10,
  'Mots choisis pour un document remis à une famille. Un seul mot par bande.');

insert into public.band_vocabulary_labels (practice_id, vocabulary_id, key, text)
values
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000001', 'b1', 'Très en deçà'),
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000001', 'b2', 'En deçà'),
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000001', 'b3', 'Dans la moyenne'),
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000001', 'b4', 'Au-dessus');

-- Vocabulaire INTERNE, non validé : ses mots ne doivent pas sortir du cabinet.
insert into public.band_vocabularies (id, practice_id, name, usage, note)
values (
  'aa000000-0000-4000-8000-000000000002',
  'a1111111-1111-4111-8111-111111111111',
  'Notes de travail', 'interne',
  'Mots employés en interne, jamais imprimés sur un document remis.');

insert into public.band_vocabulary_labels (practice_id, vocabulary_id, key, text)
values
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000002', 'b1', 'À reprendre'),
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000002', 'b2', 'Fragile'),
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000002', 'b3', 'Attendu'),
  ('a1111111-1111-4111-8111-111111111111', 'aa000000-0000-4000-8000-000000000002', 'b4', 'Solide');

-- ------------------------------------------------------------ jeu de bandes
insert into public.scale_band_sets
  (id, practice_id, scale_id, vocabulary_id, version, origin, source,
   source_checked_on, created_by)
values (
  'ab000000-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  'a9000000-0000-4000-8000-000000000001',
  'aa000000-0000-4000-8000-000000000001',
  'v1', 'convention_praticien',
  'Convention du cabinet de démonstration, arrêtée pour les tests.',
  current_date - 10,
  'a0000000-0000-4000-8000-000000000001');

-- Découpage continu, sans trou ni chevauchement. La borne haute de chaque
-- bande est exclue, celle de la dernière est incluse : c'est exactement ce qui
-- manquait au découpage d'origine, où la valeur 7 tombait dans deux bandes.
insert into public.scale_bands
  (practice_id, band_set_id, position, lower_bound, lower_inclusive,
   upper_bound, upper_inclusive, label_key, colour)
values
  ('a1111111-1111-4111-8111-111111111111', 'ab000000-0000-4000-8000-000000000001', 1,  1, true,  5, false, 'b1', '#c0504d'),
  ('a1111111-1111-4111-8111-111111111111', 'ab000000-0000-4000-8000-000000000001', 2,  5, true,  8, false, 'b2', '#d99b2b'),
  ('a1111111-1111-4111-8111-111111111111', 'ab000000-0000-4000-8000-000000000001', 3,  8, true, 14, false, 'b3', '#4e7d2f'),
  ('a1111111-1111-4111-8111-111111111111', 'ab000000-0000-4000-8000-000000000001', 4, 14, true, 19, true,  'b4', '#7ba653');

-- Jeu VOLONTAIREMENT INVALIDE : deux bandes se chevauchent à la valeur 7,
-- exactement comme le découpage d'origine. Il sert à prouver que le produit
-- refuse désormais de l'activer.
insert into public.scale_band_sets
  (id, practice_id, scale_id, vocabulary_id, version, origin, source)
values (
  'ab000000-0000-4000-8000-000000000002',
  'a1111111-1111-4111-8111-111111111111',
  'a9000000-0000-4000-8000-000000000001',
  'aa000000-0000-4000-8000-000000000001',
  'v0-defectueux', 'convention_praticien',
  'Reproduction du découpage défectueux d''origine, pour les tests.');

insert into public.scale_bands
  (practice_id, band_set_id, position, lower_bound, lower_inclusive,
   upper_bound, upper_inclusive, label_key, colour)
values
  ('a1111111-1111-4111-8111-111111111111', 'ab000000-0000-4000-8000-000000000002', 1, 1, true,  8, true, 'b1', '#c0504d'),
  ('a1111111-1111-4111-8111-111111111111', 'ab000000-0000-4000-8000-000000000002', 2, 7, true, 14, true, 'b3', '#4e7d2f');

-- Cabinet B, pour l'isolation.
insert into public.instruments (id, practice_id, name, licence_status)
values (
  'b8000000-0000-4000-8000-000000000001',
  'b1111111-1111-4111-8111-111111111111',
  'Instrument du cabinet B (fictif)', 'reference_seule');

-- Activation du jeu valide. Le seed s'exécute sans session : il pose donc
-- directement l'état, là où l'application passera par `activate_band_set`, qui
-- valide d'abord le découpage. C'est cette fonction que les tests exercent.
update public.scale_band_sets
   set active = true,
       validated_by = 'Praticienne du cabinet de démonstration',
       validated_on = current_date - 10
 where id = 'ab000000-0000-4000-8000-000000000001';
