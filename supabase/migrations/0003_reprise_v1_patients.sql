-- ============================================================================
--  0003 — REPRISE DES DONNÉES v1 DU DOSSIER PATIENT
-- ============================================================================
--  N'a d'effet que si `patients_v1` existe, c'est-à-dire après la mise à l'écart
--  opérée par 0000. Sur une base neuve, ne fait rien.
--
--  CE QU'ELLE FAIT
--   1. Crée un cabinet par compte utilisateur ayant des données, et rend ce
--      compte propriétaire. Le locataire passe ainsi du compte au cabinet sans
--      qu'aucune donnée ne change de main.
--   2. Copie chaque patient EN CONSERVANT SON IDENTIFIANT. C'est ce qui permet
--      aux bilans et aux factures existants de rester rattachés.
--   3. Extrait le responsable légal du JSON `guardian` vers un contact de plein
--      droit, avec son rôle daté.
--   4. Extrait le dossier de suivi du JSON `dossier` vers un parcours de soin,
--      avec son prescripteur et son adresseur devenus des contacts.
--   5. Repointe les clés étrangères de `bilans` et `invoices`.
--
--  CE QU'ELLE NE FAIT PAS. Elle ne supprime pas `patients_v1`, ni aucune autre
--  table v1. Tant qu'elles sont là, le retour arrière reste possible.
--
--  CE QU'ELLE NE PEUT PAS DEVINER. Les champs libres de la v1 ne portent pas
--  l'information nécessaire pour trancher : un « prescripteur » y est une
--  chaîne de caractères, pas une personne identifiée. La reprise crée donc un
--  contact par valeur distincte, sans dédoublonnage automatique — fusionner
--  deux contacts est une décision, pas une déduction.
-- ============================================================================

do $$
declare
  v_user record;
  v_practice_id uuid;
  v_member_id uuid;
  v_patient record;
  v_contact_id uuid;
  v_pathway_id uuid;
  v_nom text;
  v_prenom text;
  v_texte text;
begin
  if to_regclass('public.patients_v1') is null then
    raise notice '0003 : aucune donnée v1 à reprendre.';
    return;
  end if;

  -- ---------------------------------------------------------------- cabinets
  for v_user in
    select distinct p.user_id,
           coalesce(nullif(btrim(s.display_name), ''), 'Cabinet') as nom
      from public.patients_v1 p
      left join public.settings s on s.user_id = p.user_id
  loop
    -- Un compte déjà membre d'un cabinet garde le sien.
    select m.practice_id into v_practice_id
      from public.practice_members m
     where m.user_id = v_user.user_id and m.status = 'active'
     limit 1;

    if v_practice_id is null then
      insert into public.practices (name) values (v_user.nom)
      returning id into v_practice_id;

      insert into public.practice_members
        (practice_id, user_id, role, status, joined_at)
      values (v_practice_id, v_user.user_id, 'owner', 'active', now())
      returning id into v_member_id;

      insert into public.practitioner_profiles (practice_id, member_id, display_name)
      values (v_practice_id, v_member_id, v_user.nom);

      -- L'abonnement reprend l'état v1 s'il existe, sinon reste inactif : on ne
      -- crée pas d'accès qui n'existait pas.
      insert into public.practice_subscriptions
        (practice_id, status, trial_ends_at, manual_override)
      select v_practice_id,
             coalesce(sub.status, 'inactive'),
             sub.trial_end,
             coalesce(sub.manual_override, false)
        from (select * from public.subscriptions where user_id = v_user.user_id) sub
      union all
      select v_practice_id, 'inactive', null, false
       where not exists (
         select 1 from public.subscriptions where user_id = v_user.user_id
       )
      limit 1;

      insert into public.audit_events
        (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
      values (v_practice_id, v_user.user_id, 'practice.migrate_v1',
              'practice', v_practice_id,
              jsonb_build_object('origine', 'reprise v1'));
    end if;

    -- ---------------------------------------------------------------- patients
    for v_patient in
      select * from public.patients_v1 where user_id = v_user.user_id
    loop
      insert into public.patients
        (id, practice_id, first_name, last_name, birth_date,
         email, phone, address_line1, administrative_notes, created_at, created_by)
      values (
        v_patient.id, v_practice_id,
        coalesce(v_patient.first_name, ''),
        -- La contrainte exige au moins un nom : un dossier v1 entièrement
        -- anonyme recevrait un libellé explicite plutôt que d'être perdu.
        case
          when coalesce(btrim(v_patient.first_name), '') = ''
           and coalesce(btrim(v_patient.last_name), '') = ''
          then 'Dossier sans nom (repris de la v1)'
          else coalesce(v_patient.last_name, '')
        end,
        v_patient.birth_date,
        v_patient.email, v_patient.phone, v_patient.address,
        v_patient.notes, v_patient.created_at, v_user.user_id
      )
      on conflict (id) do nothing;

      -- ------------------------------------------------ responsable légal
      v_prenom := nullif(btrim(coalesce(v_patient.guardian ->> 'first_name', '')), '');
      v_nom    := nullif(btrim(coalesce(v_patient.guardian ->> 'last_name', '')), '');

      if v_prenom is not null or v_nom is not null then
        insert into public.contacts
          (practice_id, kind, first_name, last_name, email, phone, address_line1)
        values (
          v_practice_id, 'personne', v_prenom, v_nom,
          nullif(btrim(coalesce(v_patient.guardian ->> 'email', '')), ''),
          nullif(btrim(coalesce(v_patient.guardian ->> 'phone', '')), ''),
          nullif(btrim(coalesce(v_patient.guardian ->> 'address', '')), '')
        )
        returning id into v_contact_id;

        -- Le fondement juridique n'est PAS déduit. La v1 disait « Tuteur /
        -- Parent » sans distinguer autorité parentale et protection d'un
        -- majeur : le deviner serait une affirmation de droit sans fondement.
        insert into public.patient_contacts
          (practice_id, patient_id, contact_id, role, relationship, is_primary, note)
        values (
          v_practice_id, v_patient.id, v_contact_id, 'responsable_legal',
          nullif(btrim(coalesce(v_patient.guardian ->> 'relation', '')), ''),
          true,
          'Repris de la v1. Fondement juridique à préciser : la v1 ne distinguait pas autorité parentale et mesure de protection.'
        );

        -- Le responsable légal de la v1 n'était jamais destinataire. Le
        -- devenir est une décision du praticien, pas une conséquence de la
        -- reprise : aucun rôle « destinataire » n'est créé ici.
      end if;

      -- ------------------------------------------------------ parcours de soin
      if v_patient.dossier is not null and v_patient.dossier <> '{}'::jsonb then
        insert into public.care_pathways
          (practice_id, patient_id, label, status, referral_reason,
           prescription_date, funding_scheme, created_by)
        values (
          v_practice_id, v_patient.id,
          'Parcours repris de la v1', 'actif',
          nullif(btrim(coalesce(v_patient.dossier ->> 'motif', '')), ''),
          case
            when coalesce(v_patient.dossier ->> 'ordonnance_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
            then (v_patient.dossier ->> 'ordonnance_date')::date
          end,
          'liberal', v_user.user_id
        )
        returning id into v_pathway_id;

        -- Prescripteur : chaîne libre en v1, contact de plein droit désormais.
        v_texte := nullif(btrim(coalesce(v_patient.dossier ->> 'prescripteur', '')), '');
        if v_texte is not null then
          insert into public.contacts (practice_id, kind, last_name, profession)
          values (v_practice_id, 'personne', v_texte, 'Prescripteur (repris de la v1)')
          returning id into v_contact_id;
          update public.care_pathways
             set prescriber_contact_id = v_contact_id
           where id = v_pathway_id;
        end if;

        -- Adresseur : distinct du prescripteur, la v1 le distinguait déjà.
        v_texte := nullif(btrim(coalesce(v_patient.dossier ->> 'referrer', '')), '');
        if v_texte is not null then
          insert into public.contacts (practice_id, kind, last_name)
          values (v_practice_id, 'personne', v_texte)
          returning id into v_contact_id;
          update public.care_pathways
             set referral_source_contact_id = v_contact_id
           where id = v_pathway_id;
        end if;

        -- Les champs cliniques libres deviennent des notes datées et
        -- attribuées, au lieu de rester des chaînes sans auteur.
        for v_texte, v_nom in
          select value, key from jsonb_each_text(v_patient.dossier)
           where key in ('diagnostic', 'hypothese', 'accompagnement',
                         'autres_suivis', 'complement')
             and btrim(coalesce(value, '')) <> ''
        loop
          insert into public.patient_notes
            (practice_id, patient_id, pathway_id, body, written_on, author_member_id)
          select v_practice_id, v_patient.id, v_pathway_id,
                 format('[%s, repris de la v1] %s', v_nom, v_texte),
                 coalesce(v_patient.created_at::date, current_date),
                 m.id
            from public.practice_members m
           where m.practice_id = v_practice_id and m.user_id = v_user.user_id
           limit 1;
        end loop;

        -- L'école est un établissement, pas une note clinique.
        v_texte := nullif(btrim(coalesce(v_patient.dossier ->> 'school', '')), '');
        if v_texte is not null then
          insert into public.contacts (practice_id, kind, organisation_name)
          values (v_practice_id, 'organisation', v_texte)
          returning id into v_contact_id;
          insert into public.patient_contacts
            (practice_id, patient_id, contact_id, role, is_primary)
          values (v_practice_id, v_patient.id, v_contact_id, 'etablissement', true);
        end if;
      end if;
    end loop;
  end loop;

  raise notice '0003 : reprise des données v1 terminée.';
end
$$;

-- ============================================================================
--  CLÉS ÉTRANGÈRES DES TABLES v1 RESTANTES
-- ============================================================================
--  `bilans` et `invoices` pointaient sur `patients`, devenue `patients_v1`. Les
--  identifiants ayant été conservés à l'identique, il suffit de repointer la
--  contrainte : aucune ligne n'a besoin d'être réécrite.
do $$
declare
  v_contrainte text;
begin
  if to_regclass('public.patients_v1') is null then
    return;
  end if;

  foreach v_contrainte in array array['bilans', 'invoices']
  loop
    if to_regclass('public.' || v_contrainte) is null then
      continue;
    end if;

    execute format(
      'alter table public.%I drop constraint if exists %I',
      v_contrainte, v_contrainte || '_patient_id_fkey');
    execute format(
      'alter table public.%I add constraint %I
         foreign key (patient_id) references public.patients(id) on delete set null',
      v_contrainte, v_contrainte || '_patient_id_fkey');

    raise notice '0003 : % repointée sur la nouvelle table patients.', v_contrainte;
  end loop;
end
$$;
