# RecruitHub - Application de Matching Recrutement

## Problème Initial
Application privée de recrutement pour faire du matching automatique entre candidats et postes, avec gestion multi-zones géographiques.

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn UI + Recharts
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
### Phase 1 - MVP
- [x] Authentification complète (login/register/logout)
- [x] Dashboard avec statistiques temps réel
- [x] CRUD Candidats avec formulaire modal
- [x] CRUD Postes avec formulaire modal
- [x] Algorithme de matching (titre + proximité géographique)
- [x] Page Matching avec vue split (postes / candidats compatibles)
- [x] Score de compatibilité visuel (0-100%)
- [x] 50 villes françaises avec coordonnées GPS

### Phase 2 - Suivi & Analytics
- [x] Statuts de suivi candidats (NOUVEAU, ENCV, ENTC, PROPALE, PCLT, REFUS, NOGO_DISPO)
- [x] Champ honoraire pour les candidats placés (PCLT)
- [x] Source du candidat (Hellowork candidature/cvtech, Indeed, LinkedIn, Site 111 conseils, Cooptation)
- [x] Page Sources avec analytics (graphique honoraires, taux de conversion)
- [x] Filtre par statut sur la liste candidats
- [x] Changement de statut rapide via dropdown

## Prioritized Backlog
### P1 (Important)
- Export CSV des données
- Notes/commentaires sur candidats
- Historique des changements de statut

### P2 (Nice to have)
- Notifications email nouveaux matchs
- Import en masse de candidats
- Dashboard avec évolution mensuelle des placements
