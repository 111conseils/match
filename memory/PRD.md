# RecruitHub - Application de Matching Recrutement

## Problème Initial
Application privée de recrutement pour faire du matching automatique entre candidats et postes, avec gestion multi-zones géographiques.

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT (email/mot de passe)

## User Personas
- Recruteur indépendant gérant plusieurs zones géographiques
- Besoin d'efficacité et de centralisation des données

## Core Requirements (Static)
- Gestion des candidats (nom, prénom, ville, rayon km, titre poste, rémunération, disponibilité)
- Gestion des postes (entreprise, titre poste, ville)
- Matching automatique basé sur titre de poste + zone géographique
- Accès sécurisé par authentification

## Implemented (12 Jan 2026)
- [x] Authentification complète (login/register/logout)
- [x] Dashboard avec statistiques temps réel
- [x] CRUD Candidats avec formulaire modal
- [x] CRUD Postes avec formulaire modal
- [x] Algorithme de matching (titre + proximité géographique)
- [x] Page Matching avec vue split (postes / candidats compatibles)
- [x] Score de compatibilité visuel (0-100%)
- [x] Navigation responsive
- [x] Interface en français
- [x] 50 villes françaises avec coordonnées GPS pour calcul distances

## Prioritized Backlog
### P0 (Critical) - Done
- Matching automatique ✓
- CRUD candidats/postes ✓

### P1 (Important) - À faire
- Export CSV des données
- Statuts de suivi (en cours, placé, refusé)
- Notes/commentaires sur candidats

### P2 (Nice to have)
- Notifications email nouveaux matchs
- Import en masse de candidats
- Historique des placements
