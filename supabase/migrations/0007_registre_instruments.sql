-- ============================================================================
--  0007 — REGISTRE D'INSTRUMENTS, ÉCHELLES ET BANDES
-- ============================================================================
--  INTERDIT DANS CE SCHÉMA, SANS EXCEPTION :
--    items, stimuli, consignes de passation, feuilles de cotation, tables
--    d'étalonnage, algorithmes de conversion.
--  Toute migration ultérieure ajoutant une colonne ou une table destinée à
--  l'un de ces contenus doit être refusée en revue.
--
--  CE QUE CE FICHIER CORRIGE. Trois implémentations concurrentes de la même
--  règle de cotation cohabitent aujourd'hui dans le code : la couleur du
--  tableau, le texte de la légende et la courbe imprimée. Elles divergent aux
--  valeurs 4, 7 et 17, et une même teinte y signifie « très supérieur » d'un
--  côté et « moyenne » de l'autre — sur la même page d'un document remis à une
--  famille.
--
--  Aucun correctif ponctuel ne tiendrait : tant que trois endroits décident, ils
--  finiront par diverger à nouveau. Les bornes, les libellés et les couleurs
--  quittent donc le code pour devenir des DONNÉES, saisies et assumées par le
--  praticien. Le logiciel ne tranche plus à sa place — il applique ce qu'elle a
--  décidé, partout de la même façon.
--
--  AUCUN CATALOGUE N'EST LIVRÉ. Le produit ne fournit ni instrument, ni échelle,
--  ni jeu de bandes pré-rempli. Livrer un découpage repris d'un manuel serait
--  reproduire du contenu éditeur ; livrer un découpage inventé serait pire.
-- ============================================================================

-- ============================================================================
--  INSTRUMENTS — désignations et propriétés déclarées
-- ============================================================================
create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  -- Désignation. Saisie par le praticien, pour son propre usage.
  name text not null check (length(btrim(name)) > 0),
  publisher text,
  edition text,
  form text,                 -- formulaire, version de passation
  language text default 'fr',

  -- Plage d'âge ANNONCÉE par l'éditeur, en mois révolus. Sert à AVERTIR quand
  -- l'âge à la passation en sort — jamais à bloquer.
  age_min_months integer check (age_min_months is null or age_min_months >= 0),
  age_max_months integer check (age_max_months is null or age_max_months >= 0),

  -- Population de référence, en clair. « Enfants français, 2015 », « normes
  -- américaines ». C'est une limite de validité, elle doit pouvoir se dire.
  normative_population text,

  -- Domaines explorés, pour proposer l'instrument au bon endroit du bilan.
  domains text[] not null default '{}',

  /* ------------------------------------------------------------------------
   *  LICENCE — quatre statuts, du plus restrictif au plus permissif.
   *
   *  `reference_seule`                : l'instrument est nommé, rien de plus.
   *                                     Aucune échelle, aucun résultat
   *                                     structuré, aucune bande, aucune couleur.
   *  `scores_saisis_par_le_praticien` : le praticien possède l'instrument et
   *                                     cote lui-même, hors du logiciel. Le
   *                                     logiciel n'est qu'un cahier.
   *  `integration_editeur_autorisee`  : un accord écrit existe. Ce que l'accord
   *                                     dit, et rien de plus.
   *  `outil_libre_valide`             : les conditions de diffusion autorisent
   *                                     explicitement la reproduction.
   *
   *  Le passage à un statut plus permissif est explicite, daté et nominatif.
   *  Le repli vers un statut plus restrictif est automatique dès qu'une
   *  condition n'est plus remplie — jamais l'inverse.
   * --------------------------------------------------------------------- */
  licence_status text not null default 'reference_seule'
    check (licence_status in (
      'reference_seule',
      'scores_saisis_par_le_praticien',
      'integration_editeur_autorisee',
      'outil_libre_valide'
    )),
  licence_scope text,          -- périmètre recopié de l'accord
  licence_reference text,
  licence_url text,
  licence_expires_on date,
  licence_checked_on date,
  licence_checked_by text,

  -- Limites de validité à porter au document. « Étalonnage de 2003 »,
  -- « normes non françaises », « passation adaptée ».
  validity_warnings text,

  note text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint instruments_age_ck check (
    age_min_months is null or age_max_months is null
    or age_max_months >= age_min_months),

  -- Un accord éditeur qui ne nomme ni sa référence, ni sa date de vérification,
  -- ni qui l'a vérifiée n'est pas un accord : c'est une affirmation.
  constraint instruments_licence_editeur_ck check (
    licence_status <> 'integration_editeur_autorisee'
    or (licence_reference is not null
        and licence_checked_on is not null
        and licence_checked_by is not null)),

  -- « Librement accessible » n'est pas « libre de droits ». La charge de la
  -- preuve incombe à celui qui l'affirme.
  constraint instruments_licence_libre_ck check (
    licence_status <> 'outil_libre_valide'
    or (licence_url is not null and licence_checked_on is not null))
);
create index idx_instruments_practice on public.instruments (practice_id) where active;
create trigger instruments_updated_at before update on public.instruments
  for each row execute function app.set_updated_at();

/**
 * Statut de licence EFFECTIF, repli de sûreté compris.
 *
 * Une autorisation éditeur expirée ne disparaît pas du registre : elle cesse
 * simplement de produire ses effets. Le repli est descendant, jamais ascendant.
 */
create or replace function app.effective_licence_status(
  p_status text,
  p_expires_on date
)
returns text
language sql
immutable
as $$
  select case
    when p_status = 'integration_editeur_autorisee'
     and p_expires_on is not null and p_expires_on < current_date
    then 'scores_saisis_par_le_praticien'
    else p_status
  end;
$$;

-- ============================================================================
--  ÉCHELLES — ce qu'une valeur signifie, jamais comment on l'obtient
-- ============================================================================
--  Les moyennes et écarts-types servent à SITUER une valeur, pas à la convertir.
--  Aucune conversion d'une échelle vers une autre n'est possible ici, et ce
--  n'est pas un oubli : une conversion est propre à une version d'instrument et
--  suppose une autorisation.
create table public.instrument_scales (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,

  name text not null check (length(btrim(name)) > 0),

  result_type text not null check (result_type in (
    'brut',               -- score brut, non étalonné
    'note_standard',      -- moyenne et écart-type propres à l'instrument
    'note_t',
    'percentile',
    'ecart_type',         -- z, DS
    'age_developpement',
    'categorie',          -- qualitatif ordonné
    'autre'
  )),

  -- Renseignés SEULEMENT s'ils sont connus et déclarés. Jamais devinés.
  mean numeric,
  sd numeric,
  min_value numeric,
  max_value numeric,
  decimals integer not null default 0 check (decimals between 0 and 3),

  /* `non_oriente` est le défaut, et c'est délibéré : sans direction déclarée,
   * une valeur ne peut pas être colorée. Un score brut d'épreuve de temps où
   * « moins c'est mieux » se déclare `decroissant_favorable`. */
  direction text not null default 'non_oriente' check (direction in (
    'croissant_favorable', 'decroissant_favorable', 'non_oriente'
  )),

  note text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instrument_scales_bornes_ck check (
    min_value is null or max_value is null or max_value > min_value)
);
create index idx_instrument_scales_instrument on public.instrument_scales (instrument_id);
create index idx_instrument_scales_practice on public.instrument_scales (practice_id);
create trigger instrument_scales_updated_at before update on public.instrument_scales
  for each row execute function app.set_updated_at();

-- Une échelle n'a de sens que si le statut de licence autorise à structurer un
-- résultat. En `reference_seule`, le praticien écrit en texte libre.
create or replace function app.guard_scale_licence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_statut text;
  v_expire date;
begin
  select licence_status, licence_expires_on into v_statut, v_expire
    from public.instruments where id = new.instrument_id;

  if app.effective_licence_status(v_statut, v_expire) = 'reference_seule' then
    raise exception
      'Cet instrument est en « référence seule » : ses résultats se saisissent en texte libre, sans échelle ni bande.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger instrument_scales_licence
  before insert or update on public.instrument_scales
  for each row execute function app.guard_scale_licence();

-- ============================================================================
--  VOCABULAIRE DES BANDES
-- ============================================================================
--  Deux vocabulaires cohabitent aujourd'hui à quelques centimètres l'un de
--  l'autre sur le même document : « zone de fragilité » et « zone dite
--  pathologique » d'un côté, « faible » et « très faible » de l'autre.
--
--  Un vocabulaire est désormais un objet, choisi et ASSUMÉ. `usage` distingue
--  ce que le praticien s'autorise en interne de ce qu'il accepte d'imprimer sur
--  un document remis à une famille — ce ne sont pas les mêmes mots.
create table public.band_vocabularies (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  usage text not null default 'interne'
    check (usage in ('interne', 'document_remis')),
  -- Un vocabulaire imprimé sur un document remis doit être validé par quelqu'un.
  validated_by text,
  validated_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_band_vocabularies_practice on public.band_vocabularies (practice_id);
create trigger band_vocabularies_updated_at before update on public.band_vocabularies
  for each row execute function app.set_updated_at();

create table public.band_vocabulary_labels (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  vocabulary_id uuid not null references public.band_vocabularies(id) on delete cascade,
  key text not null check (length(btrim(key)) > 0),
  text text not null check (length(btrim(text)) > 0),
  unique (vocabulary_id, key),
  -- Deux bandes ne peuvent pas porter le même mot : ce serait illisible sur un
  -- document, et indécidable sur un graphique.
  unique (vocabulary_id, text)
);
create index idx_band_vocabulary_labels_practice on public.band_vocabulary_labels (practice_id);

-- ============================================================================
--  JEUX DE BANDES — versionnés, sourcés, jamais écrasés
-- ============================================================================
create table public.scale_band_sets (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  scale_id uuid not null references public.instrument_scales(id) on delete cascade,
  vocabulary_id uuid not null references public.band_vocabularies(id) on delete restrict,

  version text not null default 'v1',

  /* D'où vient ce découpage. `manuel_editeur` ne stocke QUE la référence : les
   * bornes restent saisies par le praticien, le produit ne livre aucun
   * découpage repris d'un manuel. */
  origin text not null check (origin in (
    'manuel_editeur', 'publication_citee', 'convention_praticien'
  )),
  source text not null check (length(btrim(source)) > 0),
  source_checked_on date,

  -- Un jeu ne devient actif que par `activate_band_set`, qui le valide d'abord.
  active boolean not null default false,
  validated_by text,
  validated_on date,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,

  unique (scale_id, version)
);
create index idx_scale_band_sets_scale on public.scale_band_sets (scale_id);
create index idx_scale_band_sets_practice on public.scale_band_sets (practice_id);
-- Un seul jeu actif par échelle : sans quoi deux découpages s'appliqueraient à
-- la même valeur, ce qui est exactement le défaut d'origine.
create unique index uq_scale_band_sets_actif
  on public.scale_band_sets (scale_id) where active;

create table public.scale_bands (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  band_set_id uuid not null references public.scale_band_sets(id) on delete cascade,
  position integer not null,

  -- `null` = ouvert. Les inclusivités sont explicites : c'est à la borne que
  -- les trois implémentations d'origine divergeaient.
  lower_bound numeric,
  lower_inclusive boolean not null default true,
  upper_bound numeric,
  upper_inclusive boolean not null default false,

  label_key text not null,
  colour text check (colour is null or colour ~ '^#[0-9a-fA-F]{6}$'),

  unique (band_set_id, position),
  unique (band_set_id, label_key),
  constraint scale_bands_bornes_ck check (
    lower_bound is null or upper_bound is null or lower_bound < upper_bound)
);
create index idx_scale_bands_set on public.scale_bands (band_set_id, position);
create index idx_scale_bands_practice on public.scale_bands (practice_id);

-- ---------------------------------------------------------------------------
--  Validation d'un jeu de bandes
-- ---------------------------------------------------------------------------
/**
 * Vérifie qu'un jeu de bandes est exploitable, et rend la liste des problèmes.
 *
 * Quatre invariants, vérifiés SUR LE JEU et non ligne à ligne :
 *   (a) au moins une bande ;
 *   (b) aucun chevauchement, inclusivités comprises — c'est là que le défaut
 *       d'origine se logeait, la valeur 7 tombant dans deux bandes à la fois ;
 *   (c) aucun trou entre deux bandes successives ;
 *   (d) chaque libellé existe dans le vocabulaire du jeu.
 *
 * Un jeu qui viole l'un des quatre ne peut pas devenir actif.
 */
create or replace function public.validate_band_set(p_band_set_id uuid)
returns table (probleme text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_vocab uuid;
  v_n integer;
  b record;
  precedente record;
  -- PIÈGE PL/pgSQL : `precedente IS NOT NULL` sur un RECORD n'est vrai que si
  -- TOUS ses champs sont non nuls. Une bande sans couleur suffisait à faire
  -- croire qu'il n'y avait pas de bande précédente, et les trous passaient
  -- inaperçus. D'où ce drapeau explicite.
  a_precedente boolean := false;
begin
  select vocabulary_id into v_vocab
    from public.scale_band_sets where id = p_band_set_id;
  if v_vocab is null then
    probleme := 'Jeu de bandes introuvable.';
    return next;
    return;
  end if;

  select count(*) into v_n from public.scale_bands where band_set_id = p_band_set_id;
  if v_n = 0 then
    probleme := 'Le jeu ne contient aucune bande.';
    return next;
    return;
  end if;

  for b in
    select * from public.scale_bands
     where band_set_id = p_band_set_id
     order by position
  loop
    -- (d) le libellé doit exister dans le vocabulaire du jeu.
    if not exists (
      select 1 from public.band_vocabulary_labels l
       where l.vocabulary_id = v_vocab and l.key = b.label_key
    ) then
      probleme := format(
        'La bande %s porte le libellé « %s », absent du vocabulaire choisi.',
        b.position, b.label_key);
      return next;
    end if;

    if a_precedente then
      -- (b) chevauchement : la borne haute de la précédente dépasse la borne
      --     basse de la suivante, ou les deux incluent la même valeur.
      if precedente.upper_bound is null or b.lower_bound is null then
        probleme := format(
          'Les bandes %s et %s sont toutes deux ouvertes : elles se recouvrent.',
          precedente.position, b.position);
        return next;
      elsif precedente.upper_bound > b.lower_bound then
        probleme := format(
          'Les bandes %s et %s se chevauchent entre %s et %s.',
          precedente.position, b.position, b.lower_bound, precedente.upper_bound);
        return next;
      elsif precedente.upper_bound = b.lower_bound
        and precedente.upper_inclusive and b.lower_inclusive then
        probleme := format(
          'La valeur %s appartient à la fois à la bande %s et à la bande %s.',
          b.lower_bound, precedente.position, b.position);
        return next;
      -- (c) trou : les bandes ne se touchent pas.
      elsif precedente.upper_bound < b.lower_bound then
        probleme := format(
          'Aucune bande ne couvre les valeurs comprises entre %s et %s.',
          precedente.upper_bound, b.lower_bound);
        return next;
      elsif precedente.upper_bound = b.lower_bound
        and not precedente.upper_inclusive and not b.lower_inclusive then
        probleme := format(
          'La valeur %s n''appartient à aucune bande.', b.lower_bound);
        return next;
      end if;
    end if;
    precedente := b;
    a_precedente := true;
  end loop;

  return;
end;
$$;
revoke all on function public.validate_band_set(uuid) from public, anon;
grant execute on function public.validate_band_set(uuid) to authenticated;

/**
 * Rend un jeu de bandes actif, après validation.
 *
 * Le jeu précédemment actif sur la même échelle est désactivé, pas supprimé :
 * un compte rendu ancien garde la trace du découpage sous lequel il a été
 * produit.
 */
create or replace function public.activate_band_set(
  p_band_set_id uuid,
  p_validated_by text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
  v_scale uuid;
  v_problemes text;
begin
  select practice_id, scale_id into v_practice, v_scale
    from public.scale_band_sets where id = p_band_set_id;

  if v_practice is null or not app.can_write(v_practice) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  select string_agg(probleme, E'\n') into v_problemes
    from public.validate_band_set(p_band_set_id);

  if v_problemes is not null then
    raise exception E'Ce découpage ne peut pas être appliqué :\n%', v_problemes
      using errcode = 'check_violation';
  end if;

  update public.scale_band_sets set active = false
   where scale_id = v_scale and active and id <> p_band_set_id;

  update public.scale_band_sets
     set active = true,
         validated_by = coalesce(p_validated_by, validated_by),
         validated_on = coalesce(validated_on, current_date)
   where id = p_band_set_id;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id)
  values (v_practice, app.current_user_id(), 'band_set.activate',
          'scale_band_set', p_band_set_id);
end;
$$;
revoke all on function public.activate_band_set(uuid, text) from public, anon;
grant execute on function public.activate_band_set(uuid, text) to authenticated;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.instruments            enable row level security;
alter table public.instrument_scales      enable row level security;
alter table public.band_vocabularies      enable row level security;
alter table public.band_vocabulary_labels enable row level security;
alter table public.scale_band_sets        enable row level security;
alter table public.scale_bands            enable row level security;

alter table public.instruments            force row level security;
alter table public.instrument_scales      force row level security;
alter table public.band_vocabularies      force row level security;
alter table public.band_vocabulary_labels force row level security;
alter table public.scale_band_sets        force row level security;
alter table public.scale_bands            force row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'instruments', 'instrument_scales', 'band_vocabularies',
    'band_vocabulary_labels', 'scale_band_sets', 'scale_bands'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (app.is_member(practice_id))', t || '_select', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (app.can_write(practice_id)) with check (app.can_write(practice_id))',
      t || '_write', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;
