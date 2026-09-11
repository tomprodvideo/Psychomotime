-- ============================================================================
--  0000 — MISE À L'ÉCART DU MODÈLE v1
-- ============================================================================
--  Ce fichier s'exécute AVANT tous les autres. Il n'a d'effet que sur une base
--  qui porte déjà le modèle v1 — c'est-à-dire la production. Sur une base
--  neuve, il ne fait rien.
--
--  POURQUOI IL EXISTE. La table `patients` de la v1 et celle du modèle cible
--  portent le même nom. Les faire coexister est impossible ; les faire se
--  succéder exige que l'ancienne soit écartée avant que la nouvelle ne soit
--  créée. C'est tout ce que fait ce fichier : il RENOMME, il ne supprime rien.
--
--  CE QU'IL NE TOUCHE PAS. `bilans`, `invoices`, `expenses`, `settings`,
--  `documents`, `doc_folders`, `invoice_counters` et `subscriptions` restent en
--  place et continuent de servir l'application. Elles seront reprises par leurs
--  lots respectifs. Leur clé étrangère vers `patients` est rétablie par la
--  migration 0003, qui copie les données en CONSERVANT LES IDENTIFIANTS — les
--  liens existants tiennent donc sans être réécrits.
--
--  RETOUR ARRIÈRE. Tant que `patients_v1` existe, l'opération est réversible :
--  supprimer les tables du modèle cible et renommer `patients_v1` en
--  `patients` rétablit l'état antérieur. La suppression définitive de
--  `patients_v1` est une opération distincte, qui n'est pas dans ce fichier.
-- ============================================================================

do $$
declare
  v_a_user_id boolean;
begin
  -- Rien à faire si `public.patients` n'existe pas encore.
  if to_regclass('public.patients') is null then
    raise notice '0000 : aucune table patients préexistante, rien à écarter.';
    return;
  end if;

  -- Distinguer la v1 de la cible : seule la v1 porte `user_id`.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients'
      and column_name = 'user_id'
  ) into v_a_user_id;

  if not v_a_user_id then
    raise notice '0000 : la table patients est déjà celle du modèle cible.';
    return;
  end if;

  if to_regclass('public.patients_v1') is not null then
    raise exception
      'patients_v1 existe déjà : une bascule a été engagée puis interrompue. '
      'Inspecter la base avant de rejouer.'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- Les clés étrangères de `bilans` et `invoices` suivent le renommage et
  -- pointeront sur `patients_v1`. La migration 0003 les repointe.
  alter table public.patients rename to patients_v1;
  raise notice '0000 : patients renommée en patients_v1.';
end
$$;
