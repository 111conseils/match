"""Tests du suivi de candidature (process), jointures comprises."""
import uuid
from datetime import datetime, timezone


def test_liste_vide_au_depart(api):
    assert api.get("/api/process").json() == []


def test_creation(api, make_candidat, make_poste, make_process):
    candidat = make_candidat()
    poste = make_poste()
    proc = make_process(candidat["id"], poste["id"])

    assert proc["candidat_id"] == candidat["id"]
    assert proc["poste_id"] == poste["id"]
    assert proc["statut"] == "ENCV"       # statut par defaut
    assert proc["honoraire"] is None
    assert proc["created_at"] and proc["updated_at"]


def test_creation_avec_statut_et_honoraire(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    proc = make_process(candidat["id"], poste["id"], statut="PCLT", honoraire=8500.0,
                        notes="Place en janvier")
    assert proc["statut"] == "PCLT"
    assert proc["honoraire"] == 8500.0
    assert proc["notes"] == "Place en janvier"


def test_doublon_refuse(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    make_process(candidat["id"], poste["id"])

    resp = api.post("/api/process", json={"candidat_id": candidat["id"], "poste_id": poste["id"]})
    assert resp.status_code == 400
    assert "existe" in resp.json()["detail"].lower()


def test_doublon_refuse_aussi_au_niveau_base(sync_db, api, make_candidat, make_poste, make_process):
    """L'index unique doit empecher le doublon meme en contournant l'API."""
    import pymongo

    candidat, poste = make_candidat(), make_poste()
    make_process(candidat["id"], poste["id"])

    try:
        sync_db.process.insert_one({
            "id": str(uuid.uuid4()), "candidat_id": candidat["id"], "poste_id": poste["id"],
            "statut": "ENCV", "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        raise AssertionError("l'index unique (candidat_id, poste_id) n'a pas joue")
    except pymongo.errors.DuplicateKeyError:
        pass


def test_meme_candidat_sur_plusieurs_postes(api, make_candidat, make_poste, make_process):
    """Exigence metier : un candidat peut etre en process sur plusieurs postes."""
    candidat = make_candidat()
    p1, p2 = make_poste(entreprise="A"), make_poste(entreprise="B")

    make_process(candidat["id"], p1["id"], statut="ENCV")
    make_process(candidat["id"], p2["id"], statut="ENTC")

    process = api.get(f"/api/process/candidat/{candidat['id']}").json()
    assert len(process) == 2
    assert {p["statut"] for p in process} == {"ENCV", "ENTC"}


def test_creation_candidat_inconnu(api, make_poste):
    poste = make_poste()
    resp = api.post("/api/process", json={"candidat_id": "inconnu", "poste_id": poste["id"]})
    assert resp.status_code == 404


def test_creation_poste_inconnu(api, make_candidat):
    candidat = make_candidat()
    resp = api.post("/api/process", json={"candidat_id": candidat["id"], "poste_id": "inconnu"})
    assert resp.status_code == 404


def test_mise_a_jour_du_statut(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    proc = make_process(candidat["id"], poste["id"])

    modifie = api.put(f"/api/process/{proc['id']}", json={"statut": "PROPALE"}).json()
    assert modifie["statut"] == "PROPALE"
    assert modifie["candidat"]["id"] == candidat["id"]
    assert modifie["poste"]["id"] == poste["id"]


def test_mise_a_jour_change_updated_at(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    proc = make_process(candidat["id"], poste["id"])
    modifie = api.put(f"/api/process/{proc['id']}", json={"statut": "ENTC"}).json()
    assert modifie["updated_at"] >= proc["updated_at"]


def test_mise_a_jour_id_inconnu(api):
    assert api.put("/api/process/inconnu", json={"statut": "ENTC"}).status_code == 404


def test_suppression(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    proc = make_process(candidat["id"], poste["id"])

    assert api.delete(f"/api/process/{proc['id']}").status_code == 200
    assert api.get("/api/process").json() == []


def test_suppression_id_inconnu(api):
    assert api.delete("/api/process/inconnu").status_code == 404


def test_suppression_libere_le_couple(api, make_candidat, make_poste, make_process):
    """Apres suppression, on doit pouvoir recreer le meme couple."""
    candidat, poste = make_candidat(), make_poste()
    proc = make_process(candidat["id"], poste["id"])
    api.delete(f"/api/process/{proc['id']}")

    resp = api.post("/api/process", json={"candidat_id": candidat["id"], "poste_id": poste["id"]})
    assert resp.status_code == 200


# --------------------------------------------------------------------------- #
# Jointures — regression N+1
# --------------------------------------------------------------------------- #
def test_liste_jointe_avec_candidat_et_poste(api, make_candidat, make_poste, make_process):
    candidat = make_candidat(nom="Leroy", prenom="Francois")
    poste = make_poste(entreprise="DataLab")
    make_process(candidat["id"], poste["id"])

    proc = api.get("/api/process").json()[0]
    assert proc["candidat"]["nom"] == "Leroy"
    assert proc["poste"]["entreprise"] == "DataLab"


def test_jointures_completes_sur_gros_volume(api, sync_db, make_candidat, make_poste):
    """Le batch de jointure doit rendre exactement les memes resultats que le N+1."""
    now = datetime.now(timezone.utc).isoformat()
    candidats = [{
        "id": str(uuid.uuid4()), "nom": f"Nom{i}", "prenom": "P", "ville": "Paris",
        "titre_poste": "Dev", "rayon_km": 30, "is_archived": False, "created_at": now,
    } for i in range(60)]
    postes = [{
        "id": str(uuid.uuid4()), "entreprise": f"Ent{i}", "titre_poste": "Dev",
        "ville": "Paris", "convention_signee": False, "created_at": now,
    } for i in range(60)]
    sync_db.candidats.insert_many(candidats)
    sync_db.postes.insert_many(postes)
    sync_db.process.insert_many([{
        "id": str(uuid.uuid4()), "candidat_id": candidats[i]["id"], "poste_id": postes[i]["id"],
        "statut": "ENCV", "created_at": now, "updated_at": now,
    } for i in range(60)])

    resultats = api.get("/api/process").json()
    assert len(resultats) == 60
    for proc in resultats:
        assert proc["candidat"]["id"] == proc["candidat_id"]
        assert proc["poste"]["id"] == proc["poste_id"]


def test_process_orphelin_est_ignore_sans_planter(api, sync_db, make_candidat):
    """Un process qui reference un poste disparu ne doit pas casser la liste."""
    candidat = make_candidat()
    now = datetime.now(timezone.utc).isoformat()
    sync_db.process.insert_one({
        "id": str(uuid.uuid4()), "candidat_id": candidat["id"], "poste_id": "poste-disparu",
        "statut": "ENCV", "created_at": now, "updated_at": now,
    })

    resp = api.get("/api/process")
    assert resp.status_code == 200
    assert resp.json() == []


def test_process_par_candidat(api, make_candidat, make_poste, make_process):
    candidat, autre = make_candidat(nom="Cible"), make_candidat(nom="Autre")
    poste = make_poste()
    make_process(candidat["id"], poste["id"])
    make_process(autre["id"], poste["id"])

    resultats = api.get(f"/api/process/candidat/{candidat['id']}").json()
    assert len(resultats) == 1
    assert resultats[0]["poste"]["id"] == poste["id"]


def test_process_par_poste(api, make_candidat, make_poste, make_process):
    candidat = make_candidat()
    poste, autre = make_poste(entreprise="Cible"), make_poste(entreprise="Autre")
    make_process(candidat["id"], poste["id"])
    make_process(candidat["id"], autre["id"])

    resultats = api.get(f"/api/process/poste/{poste['id']}").json()
    assert len(resultats) == 1
    assert resultats[0]["candidat"]["id"] == candidat["id"]


def test_process_par_candidat_inexistant_retourne_liste_vide(api):
    assert api.get("/api/process/candidat/inconnu").json() == []


def test_process_par_poste_inexistant_retourne_liste_vide(api):
    assert api.get("/api/process/poste/inconnu").json() == []


def test_plus_de_100_process_pour_un_candidat(api, sync_db, make_candidat):
    """Regression : .to_list(100) plafonnait cette route."""
    candidat = make_candidat()
    now = datetime.now(timezone.utc).isoformat()
    postes = [{
        "id": str(uuid.uuid4()), "entreprise": f"Ent{i}", "titre_poste": "Dev",
        "ville": "Paris", "convention_signee": False, "created_at": now,
    } for i in range(130)]
    sync_db.postes.insert_many(postes)
    sync_db.process.insert_many([{
        "id": str(uuid.uuid4()), "candidat_id": candidat["id"], "poste_id": p["id"],
        "statut": "ENCV", "created_at": now, "updated_at": now,
    } for p in postes])

    assert len(api.get(f"/api/process/candidat/{candidat['id']}").json()) == 130
