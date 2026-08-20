"""Tests CRUD des postes."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest


def test_liste_vide_au_depart(api):
    assert api.get("/api/postes").json() == []


def test_creation_valeurs_par_defaut(api, make_poste):
    poste = make_poste(convention_signee=False)
    assert poste["convention_signee"] is False
    assert poste["contact"] is None
    assert poste["email_contact"] is None
    assert uuid.UUID(poste["id"])


def test_creation_conserve_tous_les_champs(api):
    payload = {
        "entreprise": "DataLab", "titre_poste": "Data Scientist", "ville": "Bordeaux",
        "code_postal": "33000", "convention_signee": True,
        "contact": "Sophie Blanc", "email_contact": "s.blanc@datalab.fr",
    }
    cree = api.post("/api/postes", json=payload).json()
    for cle, valeur in payload.items():
        assert cree[cle] == valeur


@pytest.mark.parametrize("champ", ["entreprise", "titre_poste", "ville"])
def test_creation_champ_obligatoire_manquant(api, champ):
    payload = {"entreprise": "X", "titre_poste": "Dev", "ville": "Paris"}
    del payload[champ]
    assert api.post("/api/postes", json=payload).status_code == 422


def test_lecture_par_id(api, make_poste):
    poste = make_poste(entreprise="Cible")
    assert api.get(f"/api/postes/{poste['id']}").json()["entreprise"] == "Cible"


def test_lecture_id_inconnu(api):
    assert api.get("/api/postes/inconnu").status_code == 404


def test_mise_a_jour_partielle(api, make_poste):
    poste = make_poste(entreprise="Avant", ville="Paris", contact="Marie")
    modifie = api.put(f"/api/postes/{poste['id']}", json={"entreprise": "Apres"}).json()

    assert modifie["entreprise"] == "Apres"
    assert modifie["ville"] == "Paris"
    assert modifie["contact"] == "Marie"


def test_convention_passee_a_false(api, make_poste):
    """Regression potentielle : False ne doit pas etre traite comme absent."""
    poste = make_poste(convention_signee=True)
    modifie = api.put(f"/api/postes/{poste['id']}", json={"convention_signee": False}).json()
    assert modifie["convention_signee"] is False


def test_mise_a_jour_id_inconnu(api):
    assert api.put("/api/postes/inconnu", json={"entreprise": "X"}).status_code == 404


def test_suppression(api, make_poste):
    poste = make_poste()
    assert api.delete(f"/api/postes/{poste['id']}").status_code == 200
    assert api.get(f"/api/postes/{poste['id']}").status_code == 404


def test_suppression_id_inconnu(api):
    assert api.delete("/api/postes/inconnu").status_code == 404


def test_liste_triee_du_plus_recent_au_plus_ancien(api, sync_db):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i, nom in enumerate(["Ancien", "Milieu", "Recent"]):
        sync_db.postes.insert_one({
            "id": str(uuid.uuid4()), "entreprise": nom, "titre_poste": "Dev",
            "ville": "Paris", "convention_signee": False,
            "created_at": (base + timedelta(days=i)).isoformat(),
        })
    entreprises = [p["entreprise"] for p in api.get("/api/postes").json()]
    assert entreprises == ["Recent", "Milieu", "Ancien"]


def test_plus_de_1000_postes_sont_tous_retournes(api, sync_db):
    """Regression : .to_list(1000) tronquait silencieusement."""
    docs = [{
        "id": str(uuid.uuid4()), "entreprise": f"Ent{i:05d}", "titre_poste": "Dev",
        "ville": "Paris", "convention_signee": False,
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat(),
    } for i in range(1050)]
    sync_db.postes.insert_many(docs)

    assert len(api.get("/api/postes").json()) == 1050


def test_suppression_poste_laisse_les_candidats_intacts(api, make_candidat, make_poste):
    candidat = make_candidat()
    poste = make_poste()
    api.delete(f"/api/postes/{poste['id']}")
    assert api.get(f"/api/candidats/{candidat['id']}").status_code == 200
