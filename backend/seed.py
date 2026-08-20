0#!/usr/bin/env python3
"""
Script de seed pour peupler la base de données RecruitHub avec des données de démonstration.
Usage: python3 seed.py
"""

import asyncio
import uuid
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "match_db")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def now():
    return datetime.now(timezone.utc)


def hashed(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ── Données ────────────────────────────────────────────────────────────────

USERS = [
    {"id": str(uuid.uuid4()), "email": "admin@recruithub.fr", "password_hash": hashed("admin123")},
    {"id": str(uuid.uuid4()), "email": "recruteur@recruithub.fr", "password_hash": hashed("recruteur123")},
]

CANDIDATS = [
    {"nom": "Dupont", "prenom": "Alice", "ville": "Paris", "code_postal": "75001", "rayon_km": 30, "titre_poste": "Développeur Python", "remuneration": "45000", "disponibilite": "Immédiate", "source": "LinkedIn", "is_archived": False},
    {"nom": "Martin", "prenom": "Bruno", "ville": "Lyon", "code_postal": "69001", "rayon_km": 40, "titre_poste": "Développeur React", "remuneration": "42000", "disponibilite": "1 mois", "source": "Indeed", "is_archived": False},
    {"nom": "Bernard", "prenom": "Clara", "ville": "Bordeaux", "code_postal": "33000", "rayon_km": 25, "titre_poste": "Chef de projet IT", "remuneration": "55000", "disponibilite": "2 mois", "source": "Cooptation", "is_archived": False},
    {"nom": "Petit", "prenom": "David", "ville": "Nantes", "code_postal": "44000", "rayon_km": 35, "titre_poste": "Développeur Python", "remuneration": "40000", "disponibilite": "Immédiate", "source": "Hellowork candidature", "is_archived": False},
    {"nom": "Robert", "prenom": "Emma", "ville": "Toulouse", "code_postal": "31000", "rayon_km": 30, "titre_poste": "DevOps Engineer", "remuneration": "50000", "disponibilite": "3 mois", "source": "LinkedIn", "is_archived": False},
    {"nom": "Leroy", "prenom": "François", "ville": "Marseille", "code_postal": "13001", "rayon_km": 20, "titre_poste": "Data Scientist", "remuneration": "48000", "disponibilite": "1 mois", "source": "Indeed", "is_archived": False},
    {"nom": "Moreau", "prenom": "Gabrielle", "ville": "Lille", "code_postal": "59000", "rayon_km": 50, "titre_poste": "Développeur React", "remuneration": "43000", "disponibilite": "Immédiate", "source": "Site 111 conseils", "is_archived": False},
    {"nom": "Simon", "prenom": "Hugo", "ville": "Strasbourg", "code_postal": "67000", "rayon_km": 30, "titre_poste": "Lead Developer", "remuneration": "60000", "disponibilite": "2 mois", "source": "Hellowork cvtech", "is_archived": False},
    {"nom": "Michel", "prenom": "Isabelle", "ville": "Paris", "code_postal": "75008", "rayon_km": 20, "titre_poste": "UX Designer", "remuneration": "44000", "disponibilite": "Immédiate", "source": "LinkedIn", "is_archived": True},
    {"nom": "Lefebvre", "prenom": "Julien", "ville": "Grenoble", "code_postal": "38000", "rayon_km": 40, "titre_poste": "Data Scientist", "remuneration": "52000", "disponibilite": "1 mois", "source": "Cooptation", "is_archived": False},
]

POSTES = [
    {"entreprise": "TechCorp", "titre_poste": "Développeur Python Senior", "ville": "Paris", "code_postal": "75002", "convention_signee": True, "contact": "Marie Durand", "email_contact": "m.durand@techcorp.fr"},
    {"entreprise": "WebAgency", "titre_poste": "Développeur React", "ville": "Lyon", "code_postal": "69002", "convention_signee": True, "contact": "Paul Legrand", "email_contact": "p.legrand@webagency.fr"},
    {"entreprise": "DataLab", "titre_poste": "Data Scientist", "ville": "Bordeaux", "code_postal": "33000", "convention_signee": False, "contact": "Sophie Blanc", "email_contact": "s.blanc@datalab.fr"},
    {"entreprise": "CloudSys", "titre_poste": "DevOps Engineer", "ville": "Toulouse", "code_postal": "31000", "convention_signee": True, "contact": "Alain Roux", "email_contact": "a.roux@cloudsys.fr"},
    {"entreprise": "InnoSoft", "titre_poste": "Lead Developer", "ville": "Nantes", "code_postal": "44000", "convention_signee": True, "contact": "Julie Martin", "email_contact": "j.martin@innosoft.fr"},
    {"entreprise": "StartupIA", "titre_poste": "Développeur Python", "ville": "Grenoble", "code_postal": "38000", "convention_signee": False, "contact": "Romain Pascal", "email_contact": "r.pascal@startupIA.fr"},
    {"entreprise": "DigitalFactory", "titre_poste": "Chef de projet IT", "ville": "Strasbourg", "code_postal": "67000", "convention_signee": True, "contact": "Nathalie Girard", "email_contact": "n.girard@digitalfactory.fr"},
    {"entreprise": "MediaGroup", "titre_poste": "UX Designer", "ville": "Paris", "code_postal": "75009", "convention_signee": True, "contact": "Thomas Faure", "email_contact": "t.faure@mediagroup.fr"},
]


async def seed():
    print("🌱 Démarrage du seed...")

    # Vider les collections existantes
    for col in ["users", "candidats", "postes", "process", "rejected_matches"]:
        await db[col].delete_many({})
    print("🧹 Collections vidées.")

    # Insérer les utilisateurs
    for u in USERS:
        u["created_at"] = now()
        await db["users"].insert_one(u)
    print(f"👤 {len(USERS)} utilisateurs créés.")
    print(f"   → admin@recruithub.fr / admin123")
    print(f"   → recruteur@recruithub.fr / recruteur123")

    # Insérer les candidats
    candidat_ids = []
    for c in CANDIDATS:
        c["id"] = str(uuid.uuid4())
        c["created_at"] = now()
        candidat_ids.append(c["id"])
        await db["candidats"].insert_one(c)
    print(f"👥 {len(CANDIDATS)} candidats créés.")

    # Insérer les postes
    poste_ids = []
    for p in POSTES:
        p["id"] = str(uuid.uuid4())
        p["created_at"] = now()
        poste_ids.append(p["id"])
        await db["postes"].insert_one(p)
    print(f"💼 {len(POSTES)} postes créés.")

    # Créer quelques process (suivi candidat-poste)
    STATUTS = ["ENCV", "ENTC", "PROPALE", "PCLT"]
    processes = [
        (candidat_ids[0], poste_ids[0], "ENCV", None, "Candidature reçue par LinkedIn"),
        (candidat_ids[1], poste_ids[1], "ENTC", None, "Entretien technique passé"),
        (candidat_ids[2], poste_ids[6], "PROPALE", 12000.0, "Proposition envoyée"),
        (candidat_ids[3], poste_ids[0], "PCLT", 15000.0, "Placement en cours"),
        (candidat_ids[5], poste_ids[2], "ENCV", None, "En cours d'étude"),
        (candidat_ids[9], poste_ids[5], "ENTC", None, "Entretien planifié"),
    ]
    for cid, pid, statut, honoraire, notes in processes:
        await db["process"].insert_one({
            "id": str(uuid.uuid4()),
            "candidat_id": cid,
            "poste_id": pid,
            "statut": statut,
            "honoraire": honoraire,
            "notes": notes,
            "created_at": now(),
            "updated_at": now(),
        })
    print(f"🔄 {len(processes)} process créés.")

    print("\n✅ Seed terminé avec succès !")
    print(f"   Base de données : {DB_NAME}")
    print(f"   URL MongoDB     : {MONGO_URL}")


if __name__ == "__main__":
    asyncio.run(seed())
