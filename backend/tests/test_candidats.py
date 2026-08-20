"""Tests CRUD des candidats, y compris les regressions corrigees."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest


def test_liste_vide_au_depart(api):
    assert api.get("/api/candidats").json() == []


def test_creation_retourne_les_valeurs_par_defaut(api, make_candidat):
    candidat = make_candidat()
    assert candidat["rayon_km"] == 30
    assert candidat["is_archived"] is False
    assert candidat["code_postal"] is None
    assert uuid.UUID(candidat["id"])  # identifiant bien forme
    assert candidat["created_at"]


def test_creation_conserve_tous_les_champs(api):
    payload = {
        "nom": "Martin", "prenom": "Claude", "ville": "Nantes", "code_postal": "44000",
        "rayon_km": 75, "titre_poste": "Data Scientist", "remuneration": "52000",
        "disponibilite": "Immediate", "source": "LinkedIn", "is_archived": False,
    }
    cree = api.post("/api/candidats", json=payload).json()
    for cle, valeur in payload.items():
        assert cree[cle] == valeur


@pytest.mark.parametrize("champ", ["nom", "prenom", "ville", "titre_poste"])
def test_creation_champ_obligatoire_manquant(api, champ):
    payload = {"nom": "X", "prenom": "Y", "ville": "Paris", "titre_poste": "Dev"}
    del payload[champ]
    assert api.post("/api/candidats", json=payload).status_code == 422


def test_creation_rayon_non_numerique_refuse(api):
    payload = {"nom": "X", "prenom": "Y", "ville": "Paris", "titre_poste": "Dev",
               "rayon_km": "beaucoup"}
    assert api.post("/api/candidats", json=payload).status_code == 422


def test_lecture_par_id(api, make_candidat):
    candidat = make_candidat(nom="Cherchable")
    resp = api.get(f"/api/candidats/{candidat['id']}")
    assert resp.status_code == 200
    assert resp.json()["nom"] == "Cherchable"


def test_lecture_id_inconnu(api):
    assert api.get("/api/candidats/id-qui-nexiste-pas").status_code == 404


def test_mise_a_jour_partielle_preserve_les_autres_champs(api, make_candidat):
    candidat = make_candidat(nom="Avant", ville="Paris", rayon_km=42, source="Indeed")
    modifie = api.put(f"/api/candidats/{candidat['id']}", json={"nom": "Apres"}).json()

    assert modifie["nom"] == "Apres"
    assert modifie["ville"] == "Paris"
    assert modifie["rayon_km"] == 42
    assert modifie["source"] == "Indeed"
    assert modifie["id"] == candidat["id"]


def test_mise_a_jour_conserve_la_date_de_creation(api, make_candidat):
    candidat = make_candidat()
    modifie = api.put(f"/api/candidats/{candidat['id']}", json={"nom": "Autre"}).json()
    assert modifie["created_at"] == candidat["created_at"]


def test_archivage_puis_desarchivage(api, make_candidat):
    """False ne doit pas etre confondu avec "champ absent" lors de la mise a jour."""
    candidat = make_candidat()

    archive = api.put(f"/api/candidats/{candidat['id']}", json={"is_archived": True}).json()
    assert archive["is_archived"] is True

    restaure = api.put(f"/api/candidats/{candidat['id']}", json={"is_archived": False}).json()
    assert restaure["is_archived"] is False


def test_mise_a_jour_id_inconnu(api):
    assert api.put("/api/candidats/inconnu", json={"nom": "X"}).status_code == 404


def test_mise_a_jour_vide_ne_casse_rien(api, make_candidat):
    candidat = make_candidat(nom="Intact")
    resp = api.put(f"/api/candidats/{candidat['id']}", json={})
    assert resp.status_code == 200
    assert resp.json()["nom"] == "Intact"


def test_suppression(api, make_candidat):
    candidat = make_candidat()
    assert api.delete(f"/api/candidats/{candidat['id']}").status_code == 200
    assert api.get(f"/api/candidats/{candidat['id']}").status_code == 404


def test_suppression_id_inconnu(api):
    assert api.delete("/api/candidats/inconnu").status_code == 404


def test_suppression_deux_fois(api, make_candidat):
    candidat = make_candidat()
    api.delete(f"/api/candidats/{candidat['id']}")
    assert api.delete(f"/api/candidats/{candidat['id']}").status_code == 404


def test_suppression_supprime_les_process_associes(api, make_candidat, make_poste, make_process):
    candidat = make_candidat()
    poste = make_poste()
    make_process(candidat["id"], poste["id"])
    assert len(api.get("/api/process").json()) == 1

    api.delete(f"/api/candidats/{candidat['id']}")
    assert api.get("/api/process").json() == []


def test_suppression_ne_touche_pas_les_autres_candidats(api, make_candidat):
    garde = make_candidat(nom="Garde")
    supprime = make_candidat(nom="Supprime")
    api.delete(f"/api/candidats/{supprime['id']}")

    restants = api.get("/api/candidats").json()
    assert [c["nom"] for c in restants] == ["Garde"]
    assert restants[0]["id"] == garde["id"]


def test_liste_triee_du_plus_recent_au_plus_ancien(api, sync_db):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i, nom in enumerate(["Ancien", "Milieu", "Recent"]):
        sync_db.candidats.insert_one({
            "id": str(uuid.uuid4()), "nom": nom, "prenom": "P", "ville": "Paris",
            "titre_poste": "Dev", "rayon_km": 30, "is_archived": False,
            "created_at": (base + timedelta(days=i)).isoformat(),
        })
    assert [c["nom"] for c in api.get("/api/candidats").json()] == ["Recent", "Milieu", "Ancien"]


def test_liste_inclut_les_archives(api, make_candidat):
    """La liste renvoie tout : c'est le front qui filtre actifs/archives."""
    make_candidat(nom="Actif")
    archive = make_candidat(nom="Archive")
    api.put(f"/api/candidats/{archive['id']}", json={"is_archived": True})

    noms = {c["nom"] for c in api.get("/api/candidats").json()}
    assert noms == {"Actif", "Archive"}


def test_plus_de_1000_candidats_sont_tous_retournes(api, sync_db):
    """Regression : .to_list(1000) tronquait silencieusement au-dela de 1000."""
    docs = [{
        "id": str(uuid.uuid4()), "nom": f"Nom{i:05d}", "prenom": "P", "ville": "Paris",
        "titre_poste": "Dev", "rayon_km": 30, "is_archived": False,
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
    } for i in range(1050)]
    sync_db.candidats.insert_many(docs)

    assert len(api.get("/api/candidats").json()) == 1050


def test_identifiants_uniques(api, make_candidat):
    ids = {make_candidat(nom=f"N{i}")["id"] for i in range(10)}
    assert len(ids) == 10
