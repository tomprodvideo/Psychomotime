-- ============================================================================
--  SEEDS — DONNÉES ENTIÈREMENT FICTIVES
-- ============================================================================
--  Aucune donnée réelle de patient, de responsable légal ou de professionnel.
--  Les noms sont volontairement invraisemblables pour qu'aucune confusion ne
--  soit possible. Les identifiants professionnels sont des suites factices et
--  n'appartiennent à personne.
--
--  Deux cabinets, pour que chaque test d'isolation ait une contrepartie :
--    · Cabinet « Les Trois Ballons »  — praticien seul, micro-BNC, rétrocession
--    · Cabinet « Passerelle Motrice » — SELARL, deux membres, loyer
-- ============================================================================

-- Identifiants figés : les tests s'y réfèrent par leur valeur.
-- aaaa… = cabinet A, bbbb… = cabinet B.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'alpha.praticien@exemple-fictif.test'),
  ('b0000000-0000-4000-8000-000000000001', 'beta.praticien@exemple-fictif.test'),
  ('b0000000-0000-4000-8000-000000000002', 'beta.assistant@exemple-fictif.test'),
  ('c0000000-0000-4000-8000-000000000001', 'gamma.sansacces@exemple-fictif.test'),
  ('d0000000-0000-4000-8000-000000000001', 'delta.plateforme@exemple-fictif.test')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- cabinet A
insert into public.practices (id, name) values
  ('a1111111-1111-4111-8111-111111111111', 'Cabinet Les Trois Ballons');

insert into public.practice_members (id, practice_id, user_id, role, status, joined_at) values
  ('a2222222-2222-4222-8222-222222222221',
   'a1111111-1111-4111-8111-111111111111',
   'a0000000-0000-4000-8000-000000000001', 'owner', 'active', now());

insert into public.practitioner_profiles (id, practice_id, member_id, display_name, diploma_title, email) values
  ('a3333333-3333-4333-8333-333333333331',
   'a1111111-1111-4111-8111-111111111111',
   'a2222222-2222-4222-8222-222222222221',
   'Alpha Bouclette', 'Psychomotricienne D.E.', 'alpha.praticien@exemple-fictif.test');

insert into public.practice_subscriptions (practice_id, status, trial_ends_at) values
  ('a1111111-1111-4111-8111-111111111111', 'active', null);

insert into public.legal_entities (id, practice_id, legal_name, legal_form, address_line1, postal_code, city) values
  ('a4444444-4444-4444-8444-444444444441',
   'a1111111-1111-4111-8111-111111111111',
   'Alpha Bouclette', 'entreprise_individuelle',
   '12 rue des Cerceaux Fictifs', '00000', 'Villefictive');

-- Micro-BNC : régime de l'ENTREPRISE INDIVIDUELLE, pas une société.
-- Les taux sont des valeurs de démonstration, non sourcées, et le champ
-- `note` le dit explicitement. [VALIDATION HUMAINE] expert-comptable.
insert into public.fiscal_configurations (
  practice_id, legal_entity_id, valid_from,
  tax_regime, social_scheme, accounting_method, vat_regime,
  charge_arrangement, retrocession_rate_bp, monthly_rent_cents,
  social_contribution_rate_bp, note
) values (
  'a1111111-1111-4111-8111-111111111111',
  'a4444444-4444-4444-8444-444444444441',
  date '2026-01-01',
  'micro_bnc', 'tns', 'recettes_depenses', 'exoneration_soins',
  'retrocession', 2500, 0,
  2320,
  'Valeurs de démonstration, non sourcées. Ne pas utiliser pour une déclaration.'
);

insert into public.practice_locations (practice_id, label, address_line1, postal_code, city, is_primary) values
  ('a1111111-1111-4111-8111-111111111111', 'Cabinet principal',
   '12 rue des Cerceaux Fictifs', '00000', 'Villefictive', true);

insert into public.practice_settings (practice_id, settings, created_by) values
  ('a1111111-1111-4111-8111-111111111111',
   '{"theme_color":"#1d5854","document_font":"serif"}'::jsonb,
   'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------- cabinet B
insert into public.practices (id, name) values
  ('b1111111-1111-4111-8111-111111111111', 'Passerelle Motrice');

insert into public.practice_members (id, practice_id, user_id, role, status, joined_at) values
  ('b2222222-2222-4222-8222-222222222221',
   'b1111111-1111-4111-8111-111111111111',
   'b0000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('b2222222-2222-4222-8222-222222222222',
   'b1111111-1111-4111-8111-111111111111',
   'b0000000-0000-4000-8000-000000000002', 'assistant', 'active', now());

insert into public.practitioner_profiles (id, practice_id, member_id, display_name, diploma_title) values
  ('b3333333-3333-4333-8333-333333333331',
   'b1111111-1111-4111-8111-111111111111',
   'b2222222-2222-4222-8222-222222222221',
   'Beta Ritournelle', 'Psychomotricien D.E.');

insert into public.practice_subscriptions (practice_id, status, trial_ends_at) values
  ('b1111111-1111-4111-8111-111111111111', 'trialing', now() + interval '7 days');

insert into public.legal_entities (id, practice_id, legal_name, legal_form, address_line1, postal_code, city) values
  ('b4444444-4444-4444-8444-444444444441',
   'b1111111-1111-4111-8111-111111111111',
   'Passerelle Motrice SELARL', 'selarl',
   '3 impasse du Tapis Imaginaire', '00000', 'Bourgfactice');

insert into public.fiscal_configurations (
  practice_id, legal_entity_id, valid_from,
  tax_regime, social_scheme, accounting_method, vat_regime,
  charge_arrangement, retrocession_rate_bp, monthly_rent_cents,
  social_contribution_rate_bp, note
) values (
  'b1111111-1111-4111-8111-111111111111',
  'b4444444-4444-4444-8444-444444444441',
  date '2026-01-01',
  'is', 'tns', 'creances_dettes', 'exoneration_soins',
  -- Le taux de rétrocession est conservé bien que le mode retenu soit le
  -- loyer : basculer de mode n'efface aucune valeur. [A-02]
  'loyer', 3000, 60000,
  2320,
  'Valeurs de démonstration, non sourcées. Ne pas utiliser pour une déclaration.'
);

insert into public.practice_locations (practice_id, label, address_line1, postal_code, city, is_primary) values
  ('b1111111-1111-4111-8111-111111111111', 'Cabinet de ville',
   '3 impasse du Tapis Imaginaire', '00000', 'Bourgfactice', true);

-- ---------------------------------------------------- identifiants datés
-- L'ADELI porte une date de fin, le RPPS prend le relais : un document ancien
-- reste relisible avec l'identifiant qui valait à sa date. [A-13]
insert into public.professional_identifiers
  (practice_id, practitioner_profile_id, kind, value, valid_from, valid_to) values
  ('a1111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333331',
   'adeli', '000000000', date '2015-09-01', date '2024-10-01'),
  ('a1111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333331',
   'rpps',  '00000000000', date '2024-03-01', null),
  ('b1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333331',
   'rpps',  '11111111111', date '2024-03-01', null);

insert into public.professional_identifiers
  (practice_id, legal_entity_id, kind, value, valid_from) values
  ('a1111111-1111-4111-8111-111111111111', 'a4444444-4444-4444-8444-444444444441',
   'siret', '00000000000000', date '2015-09-01'),
  ('b1111111-1111-4111-8111-111111111111', 'b4444444-4444-4444-8444-444444444441',
   'siret', '11111111111111', date '2021-01-04');

-- ------------------------------------------------ administrateur plateforme
insert into public.platform_admins (user_id, note) values
  ('d0000000-0000-4000-8000-000000000001',
   'Compte de démonstration. Ne donne accès qu''aux abonnements, jamais aux dossiers.');
