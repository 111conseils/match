"""Tests du moteur de matching expose par l'API.

Les villes utilisees (Paris, Lyon, Marseille) figurent dans la liste locale :
aucun appel reseau n'est declenche, sauf dans les tests qui le veulent.
"""
import uuid
from datetime import datetime, timezone

import pytest

import server


def _scores(matches):
    return [m["score"] for m in matches]


# --------------------------------------------------------------------------- #
# /matching/{poste_id}
# --------------------------------------------------------------------------- #
def test_poste_inconnu(api):
    assert api.get("/api/matching/inconnu").status_code == 404


def test_match_parfait(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    matches = api.get(f"/api/matching/{poste['id']}").json()
    assert len(matches) == 1
    assert matches[0]["score"] == 100
    assert matches[0]["titre_match"] is True
    assert matches[0]["zone_match"] is True
    assert matches[0]["candidat"]["id"] == candidat["id"]


def test_metier_different_et_ville_differente_exclu(api, make_candidat, make_poste):
    make_candidat(ville="Paris", titre_poste="Juriste", rayon_km=30)
    poste = make_poste(ville="Lyon", titre_poste="Developpeur Python")
    assert api.get(f"/api/matching/{poste['id']}").json() == []


def test_hors_rayon_donne_50(api, make_candidat, make_poste):
    make_candidat(ville="Paris", rayon_km=30, titre_poste="Developpeur Python")
    poste = make_poste(ville="Lyon", titre_poste="Developpeur Python")

    matches = api.get(f"/api/matching/{poste['id']}").json()
    assert _scores(matches) == [50]
    assert matches[0]["zone_match"] is False


def test_rayon_large_donne_100(api, make_candidat, make_poste):
    make_candidat(ville="Paris", rayon_km=500, titre_poste="Developpeur Python")
    poste = make_poste(ville="Lyon", titre_poste="Developpeur Python")
    assert _scores(api.get(f"/api/matching/{poste['id']}").json()) == [100]


def test_tri_par_score_decroissant(api, make_candidat, make_poste):
    make_candidat(nom="Partiel", ville="Lyon", rayon_km=10, titre_poste="Developpeur Python")
    make_candidat(nom="Parfait", ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    matches = api.get(f"/api/matching/{poste['id']}").json()
    assert _scores(matches) == sorted(_scores(matches), reverse=True)
    assert matches[0]["candidat"]["nom"] == "Parfait"


def test_candidat_archive_exclu(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")
    api.put(f"/api/candidats/{candidat['id']}", json={"is_archived": True})

    assert api.get(f"/api/matching/{poste['id']}").json() == []


def test_candidat_rejete_exclu(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")
    api.post("/api/rejected-matches",
             json={"candidat_id": candidat["id"], "poste_id": poste["id"]})

    assert api.get(f"/api/matching/{poste['id']}").json() == []


def test_rejet_sur_un_autre_poste_n_affecte_pas_celui_ci(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")
    autre = make_poste(entreprise="Autre", ville="Paris", titre_poste="Developpeur Python")

    api.post("/api/rejected-matches",
             json={"candidat_id": candidat["id"], "poste_id": autre["id"]})

    assert len(api.get(f"/api/matching/{poste['id']}").json()) == 1


# --------------------------------------------------------------------------- #
# /matching/candidat/{candidat_id}
# --------------------------------------------------------------------------- #
def test_candidat_inconnu(api):
    assert api.get("/api/matching/candidat/inconnu").status_code == 404


def test_matching_inverse_symetrique(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    depuis_poste = api.get(f"/api/matching/{poste['id']}").json()
    depuis_candidat = api.get(f"/api/matching/candidat/{candidat['id']}").json()

    assert len(depuis_poste) == len(depuis_candidat) == 1
    assert depuis_poste[0]["score"] == depuis_candidat[0]["score"] == 100
    assert depuis_candidat[0]["poste"]["id"] == poste["id"]


def test_matching_inverse_exclut_les_rejets(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")
    api.post("/api/rejected-matches",
             json={"candidat_id": candidat["id"], "poste_id": poste["id"]})

    assert api.get(f"/api/matching/candidat/{candidat['id']}").json() == []


def test_matching_inverse_trie_par_score(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", rayon_km=30, titre_poste="Developpeur Python")
    make_poste(entreprise="Loin", ville="Lyon", titre_poste="Developpeur Python")
    make_poste(entreprise="Pres", ville="Paris", titre_poste="Developpeur Python")

    matches = api.get(f"/api/matching/candidat/{candidat['id']}").json()
    assert _scores(matches) == [100, 50]
    assert matches[0]["poste"]["entreprise"] == "Pres"


# --------------------------------------------------------------------------- #
# /matching (vue globale) — regressions corrigees
# --------------------------------------------------------------------------- #
def test_vue_globale_groupee_par_poste(api, make_candidat, make_poste):
    make_candidat(ville="Paris", titre_poste="Developpeur Python")
    make_poste(ville="Paris", titre_poste="Developpeur Python")
    make_poste(entreprise="Second", ville="Paris", titre_poste="Developpeur Python")

    groupes = api.get("/api/matching").json()
    assert len(groupes) == 2
    for groupe in groupes:
        assert "poste" in groupe and "matches" in groupe and "total_matches" in groupe


def test_vue_globale_exclut_les_archives(api, make_candidat, make_poste):
    """Regression : la vue globale ignorait le filtre is_archived."""
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    make_poste(ville="Paris", titre_poste="Developpeur Python")
    api.put(f"/api/candidats/{candidat['id']}", json={"is_archived": True})

    groupes = api.get("/api/matching").json()
    assert groupes[0]["matches"] == []
    assert groupes[0]["total_matches"] == 0


def test_vue_globale_exclut_les_rejets(api, make_candidat, make_poste):
    """Regression : un match rejete reapparaissait sur la vue globale."""
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")
    assert api.get("/api/matching").json()[0]["total_matches"] == 1

    api.post("/api/rejected-matches",
             json={"candidat_id": candidat["id"], "poste_id": poste["id"]})

    assert api.get("/api/matching").json()[0]["total_matches"] == 0


def test_vue_globale_rejet_cible_le_bon_couple(api, make_candidat, make_poste):
    """Rejeter (A, poste) ne doit pas masquer (B, poste)."""
    a = make_candidat(nom="A", ville="Paris", titre_poste="Developpeur Python")
    make_candidat(nom="B", ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    api.post("/api/rejected-matches", json={"candidat_id": a["id"], "poste_id": poste["id"]})

    groupe = api.get("/api/matching").json()[0]
    assert groupe["total_matches"] == 1
    assert groupe["matches"][0]["candidat"]["nom"] == "B"


def test_vue_globale_limite_a_10_mais_compte_tout(api, sync_db, make_poste):
    now = datetime.now(timezone.utc).isoformat()
    sync_db.candidats.insert_many([{
        "id": str(uuid.uuid4()), "nom": f"Nom{i}", "prenom": "P", "ville": "Paris",
        "titre_poste": "Developpeur Python", "rayon_km": 30, "is_archived": False,
        "created_at": now,
    } for i in range(25)])
    make_poste(ville="Paris", titre_poste="Developpeur Python")

    groupe = api.get("/api/matching").json()[0]
    assert len(groupe["matches"]) == 10, "la vue globale doit plafonner l'affichage a 10"
    assert groupe["total_matches"] == 25, "mais annoncer le total reel"


def test_vue_globale_sans_donnees(api):
    assert api.get("/api/matching").json() == []


def test_vue_globale_poste_sans_match(api, make_candidat, make_poste):
    make_candidat(ville="Paris", titre_poste="Juriste", rayon_km=10)
    make_poste(ville="Lyon", titre_poste="Developpeur Python")

    groupe = api.get("/api/matching").json()[0]
    assert groupe["matches"] == []
    assert groupe["total_matches"] == 0


# --------------------------------------------------------------------------- #
# Geocodage via l'API pour les villes hors liste locale
# --------------------------------------------------------------------------- #
def test_ville_hors_liste_est_geocodee(api, make_candidat, make_poste, fake_geo):
    fake_geo.set_city("zzzcommune", lat=48.8566, lon=2.3522)  # memes coords que Paris
    make_candidat(ville="Zzzcommune-Test", titre_poste="Developpeur Python", rayon_km=30)
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    matches = api.get(f"/api/matching/{poste['id']}").json()
    assert _scores(matches) == [100]
    assert fake_geo.call_count() >= 1


def test_geocodage_appele_une_fois_par_ville_pas_par_paire(api, sync_db, make_poste, fake_geo):
    """Regression de performance : 20 candidats d'une meme ville = 1 appel, pas 20."""
    fake_geo.set_city("zzzcommune", lat=48.85, lon=2.35)
    now = datetime.now(timezone.utc).isoformat()
    sync_db.candidats.insert_many([{
        "id": str(uuid.uuid4()), "nom": f"Nom{i}", "prenom": "P", "ville": "Zzzcommune-Test",
        "titre_poste": "Developpeur Python", "rayon_km": 30, "is_archived": False,
        "created_at": now,
    } for i in range(20)])
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    api.get(f"/api/matching/{poste['id']}")
    assert fake_geo.call_count() == 1, f"{fake_geo.call_count()} appels pour une seule ville"


def test_ville_ingeocodable_ne_plante_pas(api, make_candidat, make_poste, fake_geo):
    """Geocodage impossible : le match tombe a 50 (titre seul) sans erreur 500."""
    make_candidat(ville="Zzzville-Introuvable", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    resp = api.get(f"/api/matching/{poste['id']}")
    assert resp.status_code == 200
    assert _scores(resp.json()) == [50]


def test_ville_ingeocodable_interrogee_une_seule_fois(api, sync_db, make_poste, fake_geo):
    """Le cache negatif evite de rappeler l'API pour chaque paire."""
    now = datetime.now(timezone.utc).isoformat()
    sync_db.candidats.insert_many([{
        "id": str(uuid.uuid4()), "nom": f"Nom{i}", "prenom": "P", "ville": "Zzzville-Introuvable",
        "titre_poste": "Developpeur Python", "rayon_km": 30, "is_archived": False,
        "created_at": now,
    } for i in range(15)])
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    api.get(f"/api/matching/{poste['id']}")
    assert fake_geo.call_count() == 1


def test_villes_identiques_non_geocodables_matchent_quand_meme(api, make_candidat, make_poste,
                                                              fake_geo):
    """Repli documente : meme nom de ville = zone validee, meme sans coordonnees."""
    make_candidat(ville="Zzzville-Introuvable", titre_poste="Developpeur Python")
    poste = make_poste(ville="Zzzville-Introuvable", titre_poste="Developpeur Python")
    assert _scores(api.get(f"/api/matching/{poste['id']}").json()) == [100]
