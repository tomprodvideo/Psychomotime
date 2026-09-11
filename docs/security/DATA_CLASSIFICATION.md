# Classification des données

Cette classification sert à la conception technique. Elle doit être rapprochée des traitements réels et validée par les responsables compétents.

| Niveau | Exemples | Règles minimales |
|---|---|---|
| Très sensible | Notes cliniques, bilans, comptes rendus, documents de santé, contenu de séance | Accès au besoin, chiffrement, traçabilité, aucune donnée dans logs/tests/prompts non approuvés |
| Sensible | Identité, coordonnées, date de naissance, responsables légaux, rendez-vous, facturation | Minimisation, autorisation serveur, rétention définie, masquage dans diagnostics |
| Interne | Configuration cabinet, modèles internes, statistiques agrégées non anonymes | Accès authentifié, isolation organisation, partage contrôlé |
| Public | Documentation marketing publiée, informations destinées au public | Vérification avant publication |

## Règles de manipulation

- Utiliser des données synthétiques pour le développement et les démonstrations.
- Documenter chaque export, destinataire, sous-traitant et durée de conservation.
- Ne pas considérer une pseudonymisation comme une anonymisation sans analyse.
- Éviter les identifiants sensibles dans les URL et noms de fichiers.
- Appliquer la classe la plus élevée lorsqu’un objet mélange plusieurs catégories.

