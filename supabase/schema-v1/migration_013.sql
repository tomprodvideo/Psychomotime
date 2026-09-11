-- ============================================================
--  PSYCHOMOTIME — Migration 013 : plusieurs prestations par facture
--  Une facture ne portait qu'une prestation : un libellé et un
--  montant. Les modèles réels en demandent plusieurs, chacune avec
--  ses dates de séance (« 3 séances + 2 réunions »).
--  Choix retenu : une colonne `lines jsonb` sur les factures, et
--  non une table enfant. Les lectures de facture sont des
--  select("*"), la RLS des factures s'applique donc sans politique
--  nouvelle, et l'enregistrement reste atomique — supabase-js ne
--  sait pas ouvrir de transaction.
--  AUCUN backfill. `lines = []` avec `revenue_gross > 0` est un état
--  LÉGAL ET PERMANENT : les factures déjà émises doivent se rendre
--  exactement comme aujourd'hui.
--  À coller dans : Supabase > SQL Editor > New query > Run
--  (Ce script peut être relancé sans danger.)
--  Retour arrière :
--    alter table public.invoices
--      drop constraint if exists invoices_lines_total_matches;
--    alter table public.invoices
--      drop constraint if exists invoices_lines_is_array;
--    drop function if exists public.invoice_lines_total(jsonb);
--    puis rejouer supabase/migration_012.sql (invoice_by_token sans
--    `lines`). La colonne `lines` n'est PAS supprimée : elle porte des
--    données de facturation, et sans écriture elle reste sans effet.
-- ============================================================

-- ------------------------------------------------------------
--  1. La colonne.
--
--  `not null default '[]'` : une facture sans ligne porte un tableau
--  vide, jamais NULL. Le défaut étant constant, PostgreSQL n'a pas à
--  réécrire la table.
-- ------------------------------------------------------------
alter table public.invoices
  add column if not exists lines jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
--  2. Somme des montants de ligne.
--
--  `->>` puis cast `numeric`, JAMAIS de flottant : sur de la
--  comptabilité, `(elem->>'amount')::numeric` relit le nombre tel
--  qu'il a été écrit, alors qu'un passage par `float8` introduirait
--  un écart de dernière décimale que la contrainte du point 4
--  transformerait en refus d'écriture inexplicable.
--
--  `immutable` : exigé pour servir dans une contrainte CHECK.
--
--  Le `case` protège l'appel : `jsonb_array_elements` lève une erreur
--  sur autre chose qu'un tableau, et rien ne garantit que la
--  contrainte du point 3 soit évaluée en premier.
--
--  Pas de `revoke` ici, contrairement aux autres fonctions de ce
--  dépôt : une fonction appelée dans une contrainte CHECK est
--  exécutée avec les droits de celui qui écrit la ligne. La priver du
--  droit PUBLIC ferait échouer les insertions. Elle ne lit aucune
--  table et ne rend qu'une somme : il n'y a rien à y protéger.
-- ------------------------------------------------------------
create or replace function public.invoice_lines_total(p_lines jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select coalesce(sum((elem->>'amount')::numeric), 0)
  from jsonb_array_elements(
         case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]'::jsonb end
       ) as elem;
$$;

-- ------------------------------------------------------------
--  3. `lines` est un tableau, toujours.
-- ------------------------------------------------------------
alter table public.invoices
  drop constraint if exists invoices_lines_is_array;
alter table public.invoices
  add constraint invoices_lines_is_array
  check (jsonb_typeof(lines) = 'array');

-- ------------------------------------------------------------
--  4. Le brut vaut la somme des lignes — dès qu'il y a des lignes.
--
--  La branche `= 0` n'est pas une commodité : c'est elle qui garde
--  légales les factures héritées, qui ont un `revenue_gross` non nul
--  et aucune ligne. Elle doit rester en place indéfiniment.
--
--  `round(..., 2)` des deux côtés : le brut est arrondi au centime à
--  l'écriture, les montants de ligne aussi.
-- ------------------------------------------------------------
alter table public.invoices
  drop constraint if exists invoices_lines_total_matches;
alter table public.invoices
  add constraint invoices_lines_total_matches
  check (
    jsonb_array_length(lines) = 0
    or round(revenue_gross, 2) = round(public.invoice_lines_total(lines), 2)
  );

-- ------------------------------------------------------------
--  5. Lecture publique d'UNE facture, par son jeton.
--
--  Reprise intégrale de migration_012.sql, à une clé près : `lines`
--  entre dans le bloc `invoice`. La liste blanche n'est élargie nulle
--  part ailleurs.
--
--  NE PAS PERDRE la condition `and p.user_id = i.user_id` de la
--  jointure : c'est le cloisonnement ajouté par la migration 012.
--  Sans elle, une facture pointant le patient d'un autre compte
--  exposerait l'adresse de celui-ci à tout porteur du lien.
--
--  Point signalé, non tranché ici : `i.lines` est renvoyé TEL QUEL,
--  donc avec la clé `catalog_id` de chaque ligne. Côté TypeScript,
--  `toPrintable` la retire (lib/invoiceShare.ts) et le document
--  imprimé ne l'a jamais contenue. Elle reste toutefois présente dans
--  la réponse brute de cette fonction, appelable par `anon` avec le
--  jeton. `catalog_id` est un identifiant d'entrée de catalogue : il
--  ne désigne aucun patient et n'ouvre aucun autre compte, mais c'est
--  de la structure de référentiel. Pour la retirer aussi côté base,
--  remplacer `'lines', i.lines` par :
--      'lines', coalesce((
--        select jsonb_agg(elem - 'catalog_id' order by ord)
--        from jsonb_array_elements(i.lines) with ordinality as t(elem, ord)
--      ), '[]'::jsonb)
-- ------------------------------------------------------------
create or replace function public.invoice_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- Un jeton trop court ne peut pas être légitime : on coupe court.
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;

  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', i.invoice_number,
      'patient_name',   i.patient_name,
      'billing_month',  i.billing_month,
      'billing_year',   i.billing_year,
      'has_pco',        i.has_pco,
      'revenue_gross',  i.revenue_gross,
      'payment_method', i.payment_method,
      'payment_date',   i.payment_date,
      'issue_date',     i.issue_date,
      'service_label',  i.service_label,
      'lines',          i.lines
    ),
    'patient', case
      when p.id is null then null
      else jsonb_build_object('address', p.address)
    end,
    'settings', jsonb_build_object(
      'display_name', s.display_name,
      'profile', jsonb_build_object(
        'logo_url',       s.profile->>'logo_url',
        'address',        s.profile->>'address',
        'postal_code',    s.profile->>'postal_code',
        'city',           s.profile->>'city',
        'business_phone', s.profile->>'business_phone',
        'business_email', s.profile->>'business_email',
        'siret',          s.profile->>'siret',
        'adeli',          s.profile->>'adeli',
        'legal_mentions', s.profile->>'legal_mentions'
      )
    )
  )
  into v_result
  from public.invoices i
  left join public.patients p
    on p.id = i.patient_id
   and p.user_id = i.user_id   -- cloisonnement : jamais le patient d'un autre cabinet
  left join public.settings s on s.user_id = i.user_id
  where i.share_token = p_token
    and (i.share_expires_at is null or i.share_expires_at > now());

  return v_result;
end;
$$;

-- Accessible sans compte : c'est tout l'objet du lien.
revoke all on function public.invoice_by_token(text) from public;
grant execute on function public.invoice_by_token(text) to anon, authenticated;
