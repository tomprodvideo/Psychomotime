---
name: feedback-rigueur-audit
description: Standard de preuve exigé pour tout audit UX/accessibilité — séparer démontré par le code, citable, et vérifiable seulement en exécution
metadata:
  type: feedback
---

Dans un audit, séparer explicitement trois registres et ne jamais les mélanger :

1. **Démontré par le code** — avec fichier et ligne.
2. **Vérifiable seulement en exécution** — contraste réellement calculé sur le rendu, lecteur d'écran, navigation clavier réelle, géométrie des cibles à hauteur de ligne variable.
3. **Critère WCAG cité** (numéro + niveau + « nouveau en 2.2 » le cas échéant) contre **critère supposé**.

Si un point ne peut pas être tranché sans exécuter la page, **le dire** au lieu d'estimer.

**Why:** demande explicite de l'utilisateur au lot 8 — « Si tu ne peux pas trancher un point sans exécuter la page, dis-le au lieu d'estimer. » C'est cohérent avec la règle du dépôt : une rubrique inconnue ne se convertit pas en fait.

**How to apply:** vaut pour tout rapport d'audit, pas seulement l'accessibilité. Vérifier aussi qu'une exception du critère ne sauve pas le constat avant de conclure à un échec — par ex. l'exception d'espacement de 2.5.8 annule beaucoup de « cibles trop petites » apparentes. Terminer par un classement valeur/coût, du correctif d'une ligne au chantier réel. Voir [[projet-lot8-accessibilite]].
