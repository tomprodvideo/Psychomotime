#!/usr/bin/env bash
set -euo pipefail

kit_root="${1:-.}"
agent_dir="${kit_root}/.claude/agents"
skill_dir="${kit_root}/.claude/skills"
expected_agents=24
expected_skills=8
status=0
names_file="$(mktemp)"
trap 'rm -f "${names_file}"' EXIT

required_paths=(
  "CLAUDE.md"
  "AGENTS.md"
  "README.md"
  "PROMPTS_CLAUDE.md"
  ".claude/settings.json"
  "docs/context/CURRENT_STATE.md"
  "docs/context/DECISIONS.md"
  "docs/security/DATA_CLASSIFICATION.md"
  "docs/security/THREAT_MODEL.md"
  "docs/clinical/CLINICAL_SAFETY.md"
  "docs/quality/RELEASE_CHECKLIST.md"
)

for relative_path in "${required_paths[@]}"; do
  if [[ ! -f "${kit_root}/${relative_path}" ]]; then
    echo "ERREUR fichier manquant: ${relative_path}" >&2
    status=1
  fi
done

if [[ ! -d "${agent_dir}" ]]; then
  echo "ERREUR dossier manquant: .claude/agents" >&2
  exit 1
fi

agent_count="$(find "${agent_dir}" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')"
if [[ "${agent_count}" -ne "${expected_agents}" ]]; then
  echo "ERREUR ${agent_count} agents trouvés, ${expected_agents} attendus" >&2
  status=1
fi

while IFS= read -r agent_file; do
  relative_file="${agent_file#${kit_root}/}"
  if [[ "$(head -n 1 "${agent_file}")" != "---" ]]; then
    echo "ERREUR frontmatter absent: ${relative_file}" >&2
    status=1
    continue
  fi

  agent_name="$(awk 'NR == 1 && $0 == "---" { frontmatter = 1; next } frontmatter && $0 == "---" { exit } frontmatter && /^name:/ { sub(/^name:[[:space:]]*/, ""); print; exit }' "${agent_file}")"
  description="$(awk 'NR == 1 && $0 == "---" { frontmatter = 1; next } frontmatter && $0 == "---" { exit } frontmatter && /^description:/ { sub(/^description:[[:space:]]*/, ""); print; exit }' "${agent_file}")"
  memory_scope="$(awk 'NR == 1 && $0 == "---" { frontmatter = 1; next } frontmatter && $0 == "---" { exit } frontmatter && /^memory:/ { sub(/^memory:[[:space:]]*/, ""); print; exit }' "${agent_file}")"

  if [[ -z "${agent_name}" ]] || [[ ! "${agent_name}" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    echo "ERREUR nom invalide: ${relative_file} (${agent_name:-absent})" >&2
    status=1
  else
    printf '%s\n' "${agent_name}" >> "${names_file}"
  fi

  if [[ -z "${description}" ]]; then
    echo "ERREUR description absente: ${relative_file}" >&2
    status=1
  fi

  if [[ "${memory_scope}" != "project" ]]; then
    echo "ERREUR mémoire projet absente: ${relative_file}" >&2
    status=1
  fi
done < <(find "${agent_dir}" -maxdepth 1 -type f -name '*.md' | sort)

duplicate_names="$(sort "${names_file}" | uniq -d)"
if [[ -n "${duplicate_names}" ]]; then
  echo "ERREUR noms d’agents dupliqués:" >&2
  echo "${duplicate_names}" >&2
  status=1
fi

while IFS= read -r agent_name; do
  if [[ ! -f "${kit_root}/.claude/agent-memory/${agent_name}/MEMORY.md" ]]; then
    echo "ERREUR mémoire initiale manquante: ${agent_name}" >&2
    status=1
  fi
done < "${names_file}"

if [[ ! -d "${skill_dir}" ]]; then
  echo "ERREUR dossier manquant: .claude/skills" >&2
  status=1
else
  skill_count="$(find "${skill_dir}" -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md' | wc -l | tr -d ' ')"
  if [[ "${skill_count}" -ne "${expected_skills}" ]]; then
    echo "ERREUR ${skill_count} skills trouvés, ${expected_skills} attendus" >&2
    status=1
  fi

  while IFS= read -r skill_file; do
    relative_file="${skill_file#${kit_root}/}"
    if [[ "$(head -n 1 "${skill_file}")" != "---" ]] || ! grep -q '^description:' "${skill_file}"; then
      echo "ERREUR frontmatter de skill incomplet: ${relative_file}" >&2
      status=1
    fi
  done < <(find "${skill_dir}" -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md' | sort)
fi

if [[ "${status}" -ne 0 ]]; then
  echo "Validation du kit échouée." >&2
  exit "${status}"
fi

echo "Kit valide: ${agent_count} agents, ${skill_count} skills, mémoires projet et fichiers essentiels présents."
