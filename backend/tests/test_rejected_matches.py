"""Tests du systeme de rejet/restauration de match (interaction "Tinder")."""


def test_liste_vide_au_depart(api):
    assert api.get("/api/rejected-matches").json() == []


def test_rejet(api, make_candidat, make_poste):
    candidat, poste = make_candidat(), make_poste()
    resp = api.post("/api/rejected-matches",
                    json={"candidat_id": candidat["id"], "poste_id": poste["id"]})
    assert resp.status_code == 200
    assert resp.json()["id"]

    rejets = api.get("/api/rejected-matches").json()
    assert len(rejets) == 1
    assert rejets[0]["candidat_id"] == candidat["id"]
    assert rejets[0]["poste_id"] == poste["id"]


def test_rejet_idempotent(api, make_candidat, make_poste):
    """Un double-clic ne doit pas creer deux enregistrements."""
    candidat, poste = make_candidat(), make_poste()
    payload = {"candidat_id": candidat["id"], "poste_id": poste["id"]}

    premier = api.post("/api/rejected-matches", json=payload).json()
    second = api.post("/api/rejected-matches", json=payload)

    assert second.status_code == 200
    assert "déjà" in second.json()["message"].lower()
    assert second.json()["id"] == premier["id"]
    assert len(api.get("/api/rejected-matches").json()) == 1


def test_rejet_candidat_inconnu(api, make_poste):
    poste = make_poste()
    resp = api.post("/api/rejected-matches",
                    json={"candidat_id": "inconnu", "poste_id": poste["id"]})
    assert resp.status_code == 404


def test_rejet_poste_inconnu(api, make_candidat):
    candidat = make_candidat()
    resp = api.post("/api/rejected-matches",
                    json={"candidat_id": candidat["id"], "poste_id": "inconnu"})
    assert resp.status_code == 404


def test_rejet_champs_manquants(api):
    assert api.post("/api/rejected-matches", json={"candidat_id": "x"}).status_code == 422


def test_restauration(api, make_candidat, make_poste):
    candidat, poste = make_candidat(), make_poste()
    api.post("/api/rejected-matches",
             json={"candidat_id": candidat["id"], "poste_id": poste["id"]})

    resp = api.delete(f"/api/rejected-matches/{candidat['id']}/{poste['id']}")
    assert resp.status_code == 200
    assert api.get("/api/rejected-matches").json() == []


def test_restauration_de_ce_qui_n_est_pas_rejete(api, make_candidat, make_poste):
    candidat, poste = make_candidat(), make_poste()
    resp = api.delete(f"/api/rejected-matches/{candidat['id']}/{poste['id']}")
    assert resp.status_code == 404


def test_cycle_complet_rejet_restauration(api, make_candidat, make_poste):
    """Le match doit disparaitre des trois vues puis y revenir."""
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")
    payload = {"candidat_id": candidat["id"], "poste_id": poste["id"]}

    def visible():
        return (
            len(api.get(f"/api/matching/{poste['id']}").json()),
            len(api.get(f"/api/matching/candidat/{candidat['id']}").json()),
            api.get("/api/matching").json()[0]["total_matches"],
            api.get("/api/stats").json()["total_matches"],
        )

    assert visible() == (1, 1, 1, 1)

    api.post("/api/rejected-matches", json=payload)
    assert visible() == (0, 0, 0, 0)

    api.delete(f"/api/rejected-matches/{candidat['id']}/{poste['id']}")
    assert visible() == (1, 1, 1, 1)


def test_rejets_multiples_independants(api, make_candidat, make_poste):
    c1, c2 = make_candidat(nom="Un"), make_candidat(nom="Deux")
    poste = make_poste()

    api.post("/api/rejected-matches", json={"candidat_id": c1["id"], "poste_id": poste["id"]})
    api.post("/api/rejected-matches", json={"candidat_id": c2["id"], "poste_id": poste["id"]})
    assert len(api.get("/api/rejected-matches").json()) == 2

    api.delete(f"/api/rejected-matches/{c1['id']}/{poste['id']}")
    restants = api.get("/api/rejected-matches").json()
    assert len(restants) == 1
    assert restants[0]["candidat_id"] == c2["id"]


def test_index_unique_empeche_le_doublon_en_base(sync_db, api, make_candidat, make_poste):
    import uuid
    from datetime import datetime, timezone

    import pymongo

    candidat, poste = make_candidat(), make_poste()
    api.post("/api/rejected-matches",
             json={"candidat_id": candidat["id"], "poste_id": poste["id"]})

    try:
        sync_db.rejected_matches.insert_one({
            "id": str(uuid.uuid4()), "candidat_id": candidat["id"], "poste_id": poste["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        raise AssertionError("l'index unique (candidat_id, poste_id) n'a pas joue")
    except pymongo.errors.DuplicateKeyError:
        pass
