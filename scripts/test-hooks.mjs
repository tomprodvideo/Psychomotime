/**
 * Résolution des imports pour le lanceur de tests intégré de Node.
 *
 * Aucune dépendance ajoutée : Node 22+/24 exécute le TypeScript en retirant les
 * types, mais il ne connaît ni l'alias « @/ » du tsconfig, ni l'omission de
 * l'extension de fichier. Ce crochet comble exactement ces deux manques, et
 * rien d'autre.
 *
 * Usage : node --import ./scripts/test-hooks.mjs --test "lib/**\/*.test.mts"
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Racine du dépôt, déduite de l'emplacement de ce fichier : le test ne dépend
// donc pas du répertoire courant.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = [".ts", ".tsx", ".mts"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isAlias = specifier.startsWith("@/");
    const isRelative = specifier.startsWith(".");
    if (!isAlias && !isRelative) return nextResolve(specifier, context);

    const target = isAlias
      ? path.join(ROOT, specifier.slice(2))
      : fileURLToPath(new URL(specifier, context.parentURL));

    if (!existsSync(target)) {
      for (const ext of EXTENSIONS) {
        if (existsSync(target + ext)) {
          return nextResolve(pathToFileURL(target + ext).href, context);
        }
      }
    }
    // Le fichier existe tel quel : on délègue le specifier D'ORIGINE. Le
    // convertir en URL « file: » casserait la résolution CommonJS, dont les
    // requires relatifs internes passent aussi par ce crochet.
    return nextResolve(specifier, context);
  },
});
