-- ============================================================================
--  0010 — LE DÉFAUT DE FACTURATION SUIT L'ISSUE, ET NON L'ORDRE DE SAISIE
-- ============================================================================
--  LE DÉFAUT. `billable` vaut `false` en base, et le déclencheur ne le passait
--  à `true` que pour un créneau inséré avec l'issue « à venir ». Le chemin
--  normal — poser un rendez-vous, puis le qualifier — fonctionnait donc.
--
--  Mais une séance SAISIE APRÈS COUP, directement avec l'issue « honoré »,
--  restait NON FACTURABLE, sans que rien ne le dise. Elle disparaissait
--  ensuite de tout ce qui s'appuie sur les séances réalisées : une facture, et
--  demain une attestation de présence. Un silence, pas un refus — exactement le
--  type de défaut que cette refonte cherche à éliminer.
--
--  Trouvé en écrivant les tests du moteur comptable, qui posaient une séance
--  déjà honorée pour la facturer.
--
--  LA RÈGLE, désormais symétrique : à l'insertion, un rendez-vous est
--  facturable SAUF s'il n'a pas eu lieu. Le praticien garde la main — la règle
--  d'un cabinet à l'autre n'est pas la même — mais il ne perd plus une séance
--  par inadvertance.
-- ============================================================================

create or replace function app.guard_appointment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.patients p
    where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le patient n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  if new.pathway_id is not null and not exists (
    select 1 from public.care_pathways c
    where c.id = new.pathway_id
      and c.practice_id = new.practice_id
      and c.patient_id is not distinct from new.patient_id
  ) then
    raise exception 'Le parcours ne correspond pas à ce patient.'
      using errcode = 'foreign_key_violation';
  end if;

  -- LA CONTRAINTE QUI COMPTE. Une attestation de présence ne pourra être
  -- établie que sur des rendez-vous honorés : marquer « honoré » un créneau qui
  -- n'a pas commencé reviendrait à pouvoir attester d'une séance future.
  if new.attendance = 'honore' and new.starts_at > now() then
    raise exception
      'Un rendez-vous à venir ne peut pas être marqué comme honoré : il n''a pas encore eu lieu.'
      using errcode = 'check_violation';
  end if;

  -- Le défaut suit l'ISSUE, plus l'ordre de saisie. Un créneau qui a eu lieu,
  -- ou qui doit avoir lieu, est facturable ; une absence ou une annulation ne
  -- l'est pas. Dans les deux cas le praticien peut en décider autrement, mais
  -- jamais par inadvertance.
  if tg_op = 'INSERT' then
    new.billable := new.attendance in ('a_venir', 'honore', 'absent_excuse');
  end if;

  return new;
end;
$$;
