---
name: verification-commandes-psychomotime
description: Commandes de vérification fiables pour psychomotime — tsc, build, npm test, eslint ciblé — et recette pour exécuter réellement une migration SQL en local avant que l'utilisateur ne l'applique
metadata:
  type: reference
---

Depuis `/Users/tommarcon/Desktop/Manon SAAS/psychomotime` :

- `npx tsc --noEmit` — sortie vide, code 0 attendu.
- `npm run build` — Next.js 16.2.9 Turbopack, compile en ~2 s, code 0. Toutes les routes applicatives sont dynamiques (`ƒ`), seules `/login` et `/_not-found` sont statiques.
- `npm test` — **le dépôt a des tests depuis 2026-09-11** : lanceur intégré de Node, `node --import ./scripts/test-hooks.mjs --test "lib/**/*.test.mts"`. Le crochet `scripts/test-hooks.mjs` résout l'alias `@/` et les extensions manquantes ; aucune dépendance de test n'est installée. Convention : un `lib/<module>.test.mts` à côté du module, en français, données synthétiques.
- `npx eslint <fichiers>` — cibler les fichiers touchés plutôt que `npm run lint` : le lint global remonte des erreurs **préexistantes** dans `app/(app)/bilans/[id]/useDictation.ts` et `app/(app)/patients/PatientFormDialog.tsx`.

## Exécuter réellement une migration SQL avant de la livrer

PostgreSQL 16 est installé (`/opt/homebrew/bin/{initdb,pg_ctl,psql}`). Une migration peut donc être **prouvée par exécution** au lieu d'être relue, y compris ses contraintes CHECK et ses fonctions — précieux puisque l'utilisateur applique les migrations à la main en production.

Trois pièges rencontrés, tous bloquants :

1. Le socket Unix doit tenir en 103 octets : initialiser sous `/tmp/<court>`, jamais dans le scratchpad de session (chemin trop long).
2. `initdb` hérite de la locale française du poste et le postmaster refuse ensuite de démarrer (« le postmaster est devenu multithreadé »). Exporter `LC_ALL=C LANG=C LC_MESSAGES=C` **avant `initdb`**, et `--locale=C`.
3. Les rôles Supabase n'existent pas : `create role anon nologin; create role authenticated nologin;` avant tout `grant ... to anon`.

Puis reconstruire à la main les seules tables touchées (sans les FK vers `auth.users`), lancer le fichier avec `psql -v ON_ERROR_STOP=1 -f`, **le relancer une seconde fois** pour prouver qu'il est rejouable, et exercer chaque contrainte dans les deux sens. Voir [[feedback-preuve-execution]].
