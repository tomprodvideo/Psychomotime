-- ============================================================================
--  0021 — UNE NOTE DE SÉANCE APPARTIENT À LA SÉANCE QU'ELLE RACONTE
-- ============================================================================
--  LE FIL ÉTAIT POSÉ ET N'ÉTAIT BRANCHÉ NULLE PART. La migration 0005 a ajouté
--  `patient_notes.appointment_id`, avec son index partiel, et a écrit son
--  intention : « une note de séance est une note clinique comme une autre :
--  même table, même auteur, même date, même marquage d'information de tiers.
--  Seul le rattachement change. »
--
--  Rien ne l'a jamais renseignée. Conséquence : on ne peut pas répondre à
--  « qu'est-ce qu'on a travaillé sur les douze dernières séances » — qui est
--  le geste préparatoire de la synthèse, du renouvellement, du courrier au
--  médecin et de la restitution.
--
--  Troisième module trouvé dans cet état en deux jours, après `lib/age.ts` et
--  `lib/scales.ts`. Le modèle correct existe ; ce qui manque, c'est le fil.
--
--  ── CE QUE CETTE MIGRATION AJOUTE ─────────────────────────────────────────
--
--  Une garde, et rien d'autre. La colonne n'a AUCUNE vérification de
--  cohérence : la clé étrangère dit que le rendez-vous existe, elle ne dit ni
--  qu'il appartient au même cabinet, ni qu'il concerne le même patient.
--
--  Rattacher une note au rendez-vous d'un AUTRE patient attribuerait un
--  contenu clinique au mauvais dossier. C'est le premier risque listé par la
--  sécurité clinique, et jusqu'ici seule l'interface l'empêchait — c'est-à-dire
--  rien, puisque la clé anonyme est publique et qu'un titulaire de session
--  écrit directement dans l'API.
--
--  ── ET UN DÉFAUT TROUVÉ EN CHERCHANT À FALSIFIER CELUI-CI ─────────────────
--
--  En vérifiant que la garde du cabinet servait à quelque chose, j'ai constaté
--  qu'elle était couverte par celle du dossier — et, en cherchant pourquoi,
--  que `patient_notes` NE VÉRIFIAIT PAS que son patient appartient à son
--  cabinet. Démontré en exécution : un praticien du cabinet A écrit une note
--  clinique nommant un dossier du cabinet B.
--
--  Rien ne fuit vers B — la note reste lisible du seul cabinet A — mais un
--  contenu clinique se trouve attaché à l'identifiant d'un dossier qui n'est
--  pas le sien. Toute lecture qui joint par `patient_id` la fera ressortir
--  dans le mauvais dossier.
--
--  `patient_notes` était la seule table de sa famille sans cette garde :
--  `appointments`, `billing_documents` et `attestations` l'ont toutes.
-- ============================================================================

create or replace function app.guard_patient_note_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
  v_patient uuid;
begin
  /* LE DOSSIER APPARTIENT AU CABINET. Vérifié d'abord, et pour toute note —
   * avec ou sans rendez-vous. La politique d'écriture garantit que l'auteur
   * appartient au cabinet de la note ; elle ne dit rien du dossier nommé. */
  if not exists (
    select 1 from public.patients p
     where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le dossier n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  /* Le parcours, de même, quand il est désigné. */
  if new.pathway_id is not null and not exists (
    select 1 from public.care_pathways c
     where c.id = new.pathway_id
       and c.practice_id = new.practice_id
       and c.patient_id = new.patient_id
  ) then
    raise exception 'Ce parcours n''est pas celui de ce dossier.'
      using errcode = 'check_violation';
  end if;

  if new.appointment_id is null then
    return new;
  end if;

  select practice_id, patient_id into v_practice, v_patient
    from public.appointments
   where id = new.appointment_id;

  /* CE CONTRÔLE NE PEUT PAS REFUSER SEUL, ET IL RESTE POUR UNE AUTRE RAISON.
   *
   * Vérifié par mutation : le désarmer ne fait échouer aucun contrôle. C'est
   * logique — `appointments_guard` garantit déjà que le patient d'un
   * rendez-vous appartient au cabinet de ce rendez-vous, et le contrôle
   * suivant exige que ce patient soit celui de la note, dont le dossier
   * appartient au cabinet de la note. Les deux cabinets coïncident donc
   * nécessairement.
   *
   * Ce qu'il apporte quand même : un rendez-vous INEXISTANT laisse les deux
   * variables nulles, et serait sinon refusé par le contrôle du dossier, avec
   * un message qui parlerait de dossier là où le problème est l'identifiant.
   * Un refus juste avec un motif faux se paie plus tard, quand quelqu'un
   * cherche la mauvaise cause.
   *
   * Introuvable et appartenant à un autre cabinet rendent la MÊME réponse :
   * distinguer apprendrait à qui tâtonne qu'un identifiant existe, et pour
   * quel cabinet. */
  if v_practice is null or v_practice <> new.practice_id then
    raise exception 'Ce rendez-vous n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  /* LE RENDEZ-VOUS DOIT CONCERNER LE MÊME DOSSIER.
   *
   * Sans cela, une note se range sous le rendez-vous d'un autre patient : le
   * contenu clinique reste dans le bon dossier, mais l'historique de séances
   * de l'autre l'affiche. Un rendez-vous sans patient — une réunion, un
   * créneau administratif — n'est pas une séance : il ne porte pas de note
   * clinique. */
  if v_patient is null or v_patient <> new.patient_id then
    raise exception
      'Ce rendez-vous ne concerne pas ce dossier : une note de séance se range sous la séance qu''elle raconte.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger patient_notes_coherence
  before insert or update on public.patient_notes
  for each row execute function app.guard_patient_note_coherence();
