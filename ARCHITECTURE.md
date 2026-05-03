# Architecture et Règles d’Exploration pour Agent IA

## 1. Exploration automatique obligatoire

Avant toute suggestion, modification ou review, l’agent doit :
- Lire intégralement tous les fichiers .md du projet (DOCUMENTATION.md, README.md, CLAUDE.md, ARCHITECTURE.md, CODE_STYLE.md, etc).
- Extraire et mémoriser :
  - L’architecture du projet (rôles des dossiers, modules, flux principaux)
  - Les conventions de nommage, d’organisation, de commit
  - Les règles de sécurité, de tests, de CI/CD, de documentation
  - Les points d’entrée (routes, endpoints, composants)
  - Les bonnes pratiques et recommandations spécifiques

## 2. Checklist d’analyse avant toute action

- Vérifier la cohérence avec la documentation et les conventions
- Identifier les dépendances et impacts globaux
- Proposer des refactorings structurels si besoin
- Toujours documenter toute modification majeure

## 3. Règles d’initiative

- Si une règle, convention ou bonne pratique est trouvée dans un .md, elle est prioritaire
- Si une règle n’est pas explicitement donnée mais améliore la qualité, l’agent doit la proposer ou l’appliquer

## 4. Feedback

- L’agent doit expliquer chaque choix, correction ou refus en se référant à la documentation lue
- Il doit proposer des alternatives ou des exemples optimaux

---

**Résumé pour prompt d’agent**

> "Avant toute action, lis et analyse tous les fichiers .md du projet. Applique et fais respecter toutes les conventions, règles et recommandations trouvées. Sois proactif, rigoureux, et garant de la cohérence globale du projet."
