-- ============================================================================
--  0004 — DURCISSEMENT DES PRIVILÈGES DE FONCTION
-- ============================================================================
--  CE QUE CE FICHIER CORRIGE, et pourquoi le test local ne l'avait pas vu.
--
--  Supabase pose des PRIVILÈGES PAR DÉFAUT sur le schéma `public` :
--  toute fonction nouvellement créée y reçoit automatiquement `EXECUTE` pour
--  `anon`, `authenticated` et `service_role`. Un `revoke all ... from public`
--  ne les retire pas : il retire le privilège du pseudo-rôle PUBLIC, pas les
--  octrois nominatifs.
--
--  Résultat : `create_practice`, `archive_patient`, `unarchive_patient` et
--  `log_audit_event` étaient appelables par un visiteur NON AUTHENTIFIÉ, via
--  `/rest/v1/rpc/...`. Elles refusent toutes, parce qu'elles vérifient
--  l'appartenance et que `auth.uid()` est nul — mais une fonction qui refuse
--  reste une surface d'API exposée, et ce n'était pas voulu.
--
--  Le stub local ne reproduisait pas ces privilèges par défaut : le test de
--  couverture ne pouvait donc pas les voir. Il est étendu en conséquence
--  (`supabase/local/02_coverage.sql`), et le stub les reproduit désormais
--  (`supabase/local/00_auth_stub.sql`), pour que le prochain écart se voie
--  avant la mise en ligne, pas après.
-- ============================================================================

-- ---------- retrait de l'accès anonyme aux fonctions du modèle cible ----------
revoke execute on function public.create_practice(text) from anon;
revoke execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) from anon;
revoke execute on function public.archive_patient(uuid, text) from anon;
revoke execute on function public.unarchive_patient(uuid) from anon;

-- ---------- search_path épinglé partout ----------
--  Une fonction dont le `search_path` est modifiable peut voir sa résolution
--  de noms détournée. Ces cinq-là ne sont pas `security definer` — le risque
--  est donc moindre — mais l'épinglage ne coûte rien et retire l'exception.
alter function app.set_updated_at() set search_path = public, pg_temp;
alter function app.current_user_id() set search_path = public, pg_temp;
alter function app.can_administer(uuid) set search_path = public, pg_temp;
alter function app.can_write(uuid) set search_path = public, pg_temp;
alter function app.can_read_clinical(uuid) set search_path = public, pg_temp;

-- `app.current_user_id()` doit continuer de voir `auth.uid()`.
alter function app.current_user_id() set search_path = public, auth, pg_temp;

-- ============================================================================
--  PRIVILÈGES DE TABLE — remis à plat
-- ============================================================================
--  MÊME CAUSE, CONSÉQUENCE PLUS GRAVE. Les privilèges par défaut de Supabase
--  accordent `ALL` sur toute table créée dans `public`. Les `GRANT` ciblés de
--  la migration 0001 ajoutaient donc des droits à un ensemble déjà complet :
--  ils ne retiraient rien.
--
--  Concrètement, `audit_events` — conçu en AJOUT SEUL — recevait `UPDATE` et
--  `DELETE`. Seule la RLS l'empêchait encore d'être réécrit, puisqu'aucune
--  politique d'écriture n'existe. La garantie tenait donc sur une seule
--  couche au lieu de deux, et le test local, plus sévère que la production,
--  ne pouvait pas le voir.
--
--  On repart donc de zéro : REVOKE ALL, puis GRANT de ce qui est voulu et de
--  rien d'autre. La RLS reste la défense principale ; le privilège redevient
--  la seconde.
do $$
declare
  t text;
begin
  foreach t in array array[
    'practices', 'practice_members', 'platform_admins', 'practice_subscriptions',
    'practitioner_profiles', 'legal_entities', 'professional_identifiers',
    'fiscal_configurations', 'practice_locations', 'practice_settings',
    'audit_events', 'patients', 'contacts', 'patient_contacts',
    'care_pathways', 'care_objectives', 'patient_notes', 'patient_consents'
  ]
  loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end
$$;

-- Aucun privilège pour `anon` sur ces tables : un visiteur non authentifié n'a
-- rien à y lire. La seule sortie vers un non-authentifié reste la consultation
-- d'une facture par son jeton, qui passe par une fonction et non par une table.

-- Un cabinet ne naît que par `create_practice` et ne s'efface pas : des pièces
-- comptables en dépendent. D'où ni INSERT ni DELETE.
grant select, update                 on public.practices                to authenticated;
grant select, insert, update, delete on public.practice_members         to authenticated;
-- Le privilège d'administration de la plateforme s'accorde hors application.
grant select                         on public.platform_admins          to authenticated;
-- L'abonnement se lit ; il ne se crée ni ne se supprime depuis l'application.
grant select, update                 on public.practice_subscriptions   to authenticated;
grant select, insert, update, delete on public.practitioner_profiles    to authenticated;
grant select, insert, update, delete on public.legal_entities           to authenticated;
grant select, insert, update, delete on public.professional_identifiers to authenticated;
grant select, insert, update, delete on public.fiscal_configurations    to authenticated;
grant select, insert, update, delete on public.practice_locations       to authenticated;
-- Une version de paramètres est un fait daté : on en ajoute une, on ne
-- réécrit pas la précédente.
grant select, insert                 on public.practice_settings        to authenticated;
-- Journal en AJOUT SEUL : lecture seule par l'API, écriture par la seule
-- fonction `log_audit_event`. C'est ce que la ligne suivante garantit
-- désormais au niveau du privilège, et plus seulement de la politique.
grant select                         on public.audit_events             to authenticated;

grant select, insert, update, delete on public.patients         to authenticated;
grant select, insert, update, delete on public.contacts         to authenticated;
grant select, insert, update, delete on public.patient_contacts to authenticated;
grant select, insert, update, delete on public.care_pathways    to authenticated;
grant select, insert, update, delete on public.care_objectives  to authenticated;
grant select, insert, update, delete on public.patient_notes    to authenticated;
grant select, insert, update, delete on public.patient_consents to authenticated;

-- Les séquences d'identité doivent rester utilisables par les fonctions qui
-- insèrent, mais rien ne les expose directement.
revoke all on all sequences in schema public from anon;
