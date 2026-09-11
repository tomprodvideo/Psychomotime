-- ============================================================================
--  0008 — LE GARDE DU DERNIER PROPRIÉTAIRE NE BLOQUE PLUS LA SUPPRESSION
--         D'UN CABINET
-- ============================================================================
--  LE DÉFAUT. `app.guard_last_owner` empêche un cabinet de perdre son dernier
--  propriétaire actif. C'est juste — mais il se déclenchait aussi lorsque le
--  cabinet LUI-MÊME était supprimé : la suppression en cascade retire ses
--  membres, le déclencheur voit le dernier propriétaire partir, et refuse.
--
--  Résultat : un cabinet devenait indestructible. Ce n'est pas gênant au
--  quotidien — l'archivage est la voie normale, et une suppression de cabinet
--  ne doit pas être banale — mais cela rendait impossible de nettoyer un
--  cabinet créé par erreur ou pour une vérification.
--
--  Trouvé en supprimant un compte de vérification créé pour regarder les
--  écrans. Le garde-fou avait raison sur le fond et tort sur le contexte.
--
--  LA CORRECTION. Si le cabinet n'existe plus, il n'y a plus de propriétaire à
--  protéger : le déclencheur laisse passer. Dans tous les autres cas, il refuse
--  exactement comme avant.
-- ============================================================================

create or replace function app.guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid := coalesce(old.practice_id, new.practice_id);
  v_owners integer;
begin
  -- Suppression en cascade du cabinet : la ligne parente est retirée d'abord,
  -- les membres ensuite. Il n'y a alors plus rien à protéger.
  if tg_op = 'DELETE'
     and not exists (select 1 from public.practices p where p.id = v_practice) then
    return old;
  end if;

  select count(*) into v_owners
  from public.practice_members m
  where m.practice_id = v_practice
    and m.role = 'owner'
    and m.status = 'active'
    and m.id <> coalesce(old.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if tg_op = 'UPDATE'
     and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;

  if v_owners = 0 and old.role = 'owner' and old.status = 'active' then
    raise exception
      'Un cabinet doit conserver au moins un propriétaire actif.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;
