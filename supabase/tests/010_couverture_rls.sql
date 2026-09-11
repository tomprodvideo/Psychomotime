-- ============================================================================
--  010 — COUVERTURE RLS
--  Une table sans RLS, une RLS non forcée, une politique manquante ou une
--  fonction SECURITY DEFINER au search_path libre sont des fuites en attente.
--  Ce test refuse les cinq cas d'un coup. [C-02]
-- ============================================================================
\set ON_ERROR_STOP on

do $$
declare
  v_issues text;
  v_count integer;
begin
  select count(*), string_agg(issue, E'\n  · ')
    into v_count, v_issues
  from tests.check_rls_coverage();

  if v_count > 0 then
    raise exception E'ÉCHEC : % problème(s) de couverture RLS :\n  · %', v_count, v_issues
      using errcode = 'assert_failure';
  end if;
end
$$;

-- Le schéma `app` ne doit pas être exposé à PostgREST : ses fonctions internes
-- n'ont rien à faire dans la surface d'API.
do $$
begin
  perform tests.assert(
    not has_schema_privilege('anon', 'app', 'usage'),
    'Le schéma app ne doit pas être accessible à anon.'
  );
end
$$;
