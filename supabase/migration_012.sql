-- ============================================================
--  PSYCHOMOTIME — Migration 012 : cloisonnement du lien de facture
--  La fonction invoice_by_token s'exécute en security definer, donc
--  hors RLS. Sa jointure sur les patients n'était pas rattachée au
--  cabinet propriétaire de la facture : une facture pointant le
--  patient d'un autre cabinet aurait exposé l'adresse de celui-ci à
--  toute personne détenant le lien.
--  Correction : la jointure exige désormais que le patient appartienne
--  au même compte que la facture. Aucune autre modification.
--  À coller dans : Supabase > SQL Editor > New query > Run
--  (Ce script peut être relancé sans danger.)
--  Retour arrière : rejouer migration_011.sql.
-- ============================================================

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
      'service_label',  i.service_label
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
