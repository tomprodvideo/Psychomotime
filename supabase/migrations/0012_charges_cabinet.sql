-- ============================================================================
--  0012 — CHARGES DU CABINET
-- ============================================================================
--  Le revenu net d'une pratique libérale ne se lit pas sur les seules factures.
--  La v1 le savait : elle tenait des charges ponctuelles et des charges
--  récurrentes. Ce fichier les porte dans le modèle cible, avec deux
--  différences qui comptent.
--
--   1. MONTANTS EN CENTIMES ENTIERS. La v1 les stockait en `numeric` euros ;
--      douze mensualités de 383,33 € donnaient 4 599,96 € au lieu de 4 600 €,
--      et l'écart grossissait chaque année.
--
--   2. UNE CHARGE RÉCURRENTE EST UN MODÈLE, PAS UN MONTANT. La v1 rangeait les
--      dépenses récurrentes dans le JSON des réglages, hors de toute période :
--      changer un loyer récrivait donc rétroactivement toutes les années
--      passées. Ici, une récurrence porte ses dates de début et de fin, et les
--      périodes antérieures gardent le montant qui était le leur.
--
--  CE QU'ELLE NE FAIT PAS. Elle ne qualifie aucune charge au regard de la
--  fiscalité : déductible ou non, amortissable ou non, ces questions relèvent
--  d'un expert-comptable et le champ `category` ne prétend pas y répondre.
--  [VALIDATION HUMAINE — expert-comptable]
-- ============================================================================

create table public.practice_expenses (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  -- Catégories d'USAGE, pour regrouper un relevé. Ce ne sont pas des postes
  -- comptables normalisés, et l'interface ne doit pas les présenter comme tels.
  category text not null default 'autre' check (category in (
    'loyer', 'retrocession', 'cotisations', 'assurance', 'materiel',
    'formation', 'deplacement', 'logiciel', 'honoraires', 'autre'
  )),

  label text,
  amount_cents bigint not null check (amount_cents >= 0),
  spent_on date not null,

  -- Période de rattachement, quand elle diffère de la date de décaissement.
  period_start date,
  period_end date,

  /* Origine : saisie à la main, ou engendrée par une récurrence. Une charge
   * engendrée reste modifiable — une mensualité exceptionnelle existe — et
   * garde le lien vers le modèle qui l'a produite. */
  recurrence_id uuid,

  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint practice_expenses_periode_ck check (
    period_end is null or period_start is null or period_end >= period_start)
);
create index idx_practice_expenses on public.practice_expenses (practice_id, spent_on desc);
create trigger practice_expenses_updated_at before update on public.practice_expenses
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
--  Charges récurrentes
-- ---------------------------------------------------------------------------
--  Un MODÈLE daté. Il ne porte aucun montant passé : il dit ce qui est dû, à
--  partir de quand, et jusqu'à quand. Les charges effectives en sont issues.
create table public.expense_recurrences (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  category text not null default 'autre' check (category in (
    'loyer', 'retrocession', 'cotisations', 'assurance', 'materiel',
    'formation', 'deplacement', 'logiciel', 'honoraires', 'autre'
  )),
  label text not null check (length(btrim(label)) > 0),
  amount_cents bigint not null check (amount_cents >= 0),
  period text not null default 'mensuel' check (period in ('mensuel', 'annuel')),

  starts_on date not null,
  ends_on date,

  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expense_recurrences_fin_ck check (ends_on is null or ends_on >= starts_on)
);
create index idx_expense_recurrences on public.expense_recurrences (practice_id)
  where active;
create trigger expense_recurrences_updated_at before update on public.expense_recurrences
  for each row execute function app.set_updated_at();

alter table public.practice_expenses
  add constraint practice_expenses_recurrence_fk
  foreign key (recurrence_id) references public.expense_recurrences(id) on delete set null;

-- ---------------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------------
alter table public.practice_expenses    enable row level security;
alter table public.expense_recurrences  enable row level security;
alter table public.practice_expenses    force row level security;
alter table public.expense_recurrences  force row level security;

do $$
declare
  t text;
begin
  foreach t in array array['practice_expenses', 'expense_recurrences']
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

-- ============================================================================
--  REPRISE DES CHARGES v1
-- ============================================================================
do $$
declare
  e record;
  r jsonb;
  v_practice uuid;
  v_categorie text;
  v_debut date;
begin
  if to_regclass('public.expenses') is null then
    return;
  end if;
  if exists (select 1 from public.practice_expenses) then
    return;
  end if;

  for e in select * from public.expenses
  loop
    select m.practice_id into v_practice
      from public.practice_members m
     where m.user_id = e.user_id and m.status = 'active'
     limit 1;
    if v_practice is null then
      continue;
    end if;

    -- La v1 ne connaissait que trois types. Ils sont repris tels quels ; les
    -- autres catégories n'existent que pour les saisies à venir.
    v_categorie := case lower(btrim(coalesce(e.type, '')))
      when 'loyer' then 'loyer'
      when 'urssaf' then 'cotisations'
      when 'retrocession' then 'retrocession'
      else 'autre' end;

    insert into public.practice_expenses
      (practice_id, category, label, amount_cents, spent_on,
       period_start, period_end, note, created_at)
    values (
      v_practice, v_categorie,
      nullif(btrim(coalesce(e.label, '')), ''),
      round(coalesce(e.amount, 0) * 100)::bigint,
      -- Une charge sans date ne peut entrer dans aucun total. Faute de mieux,
      -- la date de saisie fait foi, et la note le dit.
      coalesce(e.expense_date, e.created_at::date),
      null, null,
      btrim(coalesce(e.notes, '') ||
        case when e.expense_date is null
             then E'\n(Date de décaissement absente en v1 : date de saisie retenue.)'
             else '' end),
      e.created_at);
  end loop;

  -- Les dépenses récurrentes, extraites du JSON des réglages. Leur date de
  -- début est inconnue de la v1 : on ne l'invente pas, on prend le 1er janvier
  -- de l'année courante et on le CONSIGNE, pour qu'aucune période antérieure ne
  -- se retrouve chargée d'un montant qu'elle ne portait pas.
  if to_regclass('public.settings') is not null then
    v_debut := make_date(extract(year from current_date)::integer, 1, 1);
    for e in select * from public.settings
    loop
      select m.practice_id into v_practice
        from public.practice_members m
       where m.user_id = e.user_id and m.status = 'active'
       limit 1;
      if v_practice is null then
        continue;
      end if;

      for r in
        select value from jsonb_array_elements(
          case when jsonb_typeof(e.profile -> 'recurring_expenses') = 'array'
               then e.profile -> 'recurring_expenses' else '[]'::jsonb end)
      loop
        insert into public.expense_recurrences
          (id, practice_id, category, label, amount_cents, period, starts_on, active)
        values (
          coalesce((r ->> 'id')::uuid, gen_random_uuid()),
          v_practice, 'autre',
          coalesce(nullif(btrim(coalesce(r ->> 'label', '')), ''),
                   'Charge récurrente (reprise de la v1)'),
          round(coalesce((r ->> 'amount')::numeric, 0) * 100)::bigint,
          case when r ->> 'period' = 'annuel' then 'annuel' else 'mensuel' end,
          v_debut,
          coalesce((r ->> 'active')::boolean, true))
        on conflict (id) do nothing;
      end loop;
    end loop;
  end if;
end
$$;
