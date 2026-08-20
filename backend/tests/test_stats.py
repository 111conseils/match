"""Tests du dashboard.

Le point central : /stats doit annoncer exactement ce que les pages matching
affichent. C'etait faux avant (deux moteurs de score differents).
"""
import uuid
from datetime import datetime, timezone


def _matchs_100_dans_la_vue_globale(api):
    return sum(
        1
        for groupe in api.get("/api/matching").json()
        for match in groupe["matches"]
        if match["score"] >= 100
    )


# --------------------------------------------------------------------------- #
# Coherence dashboard / ecran
# --------------------------------------------------------------------------- #
def test_stats_vides(api):
    stats = api.get("/api/stats").json()
    assert stats["total_candidats"] == 0
    assert stats["total_postes"] == 0
    assert stats["total_matches"] == 0
    assert stats["total_process"] == 0


def test_total_matches_egale_les_matchs_affiches(api, make_candidat, make_poste):
    """Regression : /stats comptait les scores > 0 avec un autre moteur."""
    make_candidat(nom="Parfait", ville="Paris", titre_poste="Developpeur Python")
    make_candidat(nom="Partiel", ville="Lyon", rayon_km=10, titre_poste="Developpeur Python")
    make_candidat(nom="Aucun", ville="Lyon", rayon_km=10, titre_poste="Juriste")
    make_poste(ville="Paris", titre_poste="Developpeur Python")

    stats = api.get("/api/stats").json()
    assert stats["total_matches"] == _matchs_100_dans_la_vue_globale(api) == 1


def test_matchs_partiels_comptes_a_part(api, make_candidat, make_poste):
    make_candidat(nom="Parfait", ville="Paris", titre_poste="Developpeur Python")
    make_candidat(nom="TitreSeul", ville="Lyon", rayon_km=10, titre_poste="Developpeur Python")
    make_candidat(nom="ZoneSeule", ville="Paris", titre_poste="Juriste")
    make_poste(ville="Paris", titre_poste="Developpeur Python")

    stats = api.get("/api/stats").json()
    assert stats["total_matches"] == 1
    assert stats["partial_matches"] == 2


def test_high_score_egale_total_matches(api, make_candidat, make_poste):
    """Le score ne vaut que 0, 50 ou 100 : ">= 70" revient a "== 100"."""
    make_candidat(ville="Paris", titre_poste="Developpeur Python")
    make_poste(ville="Paris", titre_poste="Developpeur Python")

    stats = api.get("/api/stats").json()
    assert stats["high_score_matches"] == stats["total_matches"]


def test_archives_exclus_des_matchs_mais_comptes_dans_le_total(api, make_candidat, make_poste):
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    make_poste(ville="Paris", titre_poste="Developpeur Python")
    api.put(f"/api/candidats/{candidat['id']}", json={"is_archived": True})

    stats = api.get("/api/stats").json()
    assert stats["total_candidats"] == 1        # il existe toujours
    assert stats["total_candidats_actifs"] == 0  # mais il est archive
    assert stats["total_matches"] == 0           # et sort du matching


def test_rejets_exclus_des_stats(api, make_candidat, make_poste):
    """Regression : /stats ignorait les matchs rejetes."""
    candidat = make_candidat(ville="Paris", titre_poste="Developpeur Python")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")
    assert api.get("/api/stats").json()["total_matches"] == 1

    api.post("/api/rejected-matches",
             json={"candidat_id": candidat["id"], "poste_id": poste["id"]})
    assert api.get("/api/stats").json()["total_matches"] == 0


def test_coherence_sur_un_jeu_plus_large(api, sync_db):
    """Verification croisee sur 12 candidats x 6 postes, archives et rejets melanges."""
    now = datetime.now(timezone.utc).isoformat()
    villes = ["Paris", "Lyon", "Marseille"]
    titres = ["Developpeur Python", "Juriste"]

    candidats = [{
        "id": str(uuid.uuid4()), "nom": f"Nom{i}", "prenom": "P",
        "ville": villes[i % 3], "titre_poste": titres[i % 2], "rayon_km": 30,
        "is_archived": (i % 5 == 0), "created_at": now,
    } for i in range(12)]
    postes = [{
        "id": str(uuid.uuid4()), "entreprise": f"Ent{i}", "titre_poste": titres[i % 2],
        "ville": villes[i % 3], "convention_signee": False, "created_at": now,
    } for i in range(6)]
    sync_db.candidats.insert_many(candidats)
    sync_db.postes.insert_many(postes)

    actifs = [c for c in candidats if not c["is_archived"]]
    sync_db.rejected_matches.insert_one({
        "id": str(uuid.uuid4()), "candidat_id": actifs[0]["id"], "poste_id": postes[0]["id"],
        "created_at": now,
    })

    stats = api.get("/api/stats").json()
    assert stats["total_matches"] == _matchs_100_dans_la_vue_globale(api)
    assert stats["total_candidats"] == 12
    assert stats["total_candidats_actifs"] == len(actifs)


# --------------------------------------------------------------------------- #
# Statistiques issues des process
# --------------------------------------------------------------------------- #
def test_comptage_des_statuts(api, make_candidat, make_poste, make_process):
    c1, c2, c3 = (make_candidat(nom=f"C{i}") for i in range(3))
    poste = make_poste()
    make_process(c1["id"], poste["id"], statut="ENCV")
    make_process(c2["id"], poste["id"], statut="ENCV")
    make_process(c3["id"], poste["id"], statut="ENTC")

    stats = api.get("/api/stats").json()
    assert stats["statuts_count"] == {"ENCV": 2, "ENTC": 1}
    assert stats["total_process"] == 3


def test_honoraires_et_placements(api, make_candidat, make_poste, make_process):
    c1, c2, c3 = (make_candidat(nom=f"C{i}") for i in range(3))
    poste = make_poste()
    make_process(c1["id"], poste["id"], statut="PCLT", honoraire=8000.0)
    make_process(c2["id"], poste["id"], statut="PCLT", honoraire=5500.0)
    make_process(c3["id"], poste["id"], statut="ENCV", honoraire=9999.0)  # pas place

    stats = api.get("/api/stats").json()
    assert stats["candidats_places"] == 2
    assert stats["total_honoraires"] == 13500.0


def test_place_sans_honoraire(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    make_process(candidat["id"], poste["id"], statut="PCLT")

    stats = api.get("/api/stats").json()
    assert stats["candidats_places"] == 1
    assert stats["total_honoraires"] == 0


# --------------------------------------------------------------------------- #
# /stats/sources
# --------------------------------------------------------------------------- #
def test_sources_vide(api):
    assert api.get("/api/stats/sources").json() == []


def test_sources_agregation(api, make_candidat, make_poste, make_process):
    linkedin = make_candidat(nom="L1", source="LinkedIn")
    make_candidat(nom="L2", source="LinkedIn")
    indeed = make_candidat(nom="I1", source="Indeed")
    poste = make_poste()

    make_process(linkedin["id"], poste["id"], statut="PCLT", honoraire=7000.0)
    make_process(indeed["id"], poste["id"], statut="ENCV")

    par_source = {s["source"]: s for s in api.get("/api/stats/sources").json()}
    assert par_source["LinkedIn"]["total"] == 2
    assert par_source["LinkedIn"]["places"] == 1
    assert par_source["LinkedIn"]["honoraires"] == 7000.0
    assert par_source["Indeed"]["total"] == 1
    assert par_source["Indeed"]["places"] == 0


def test_sources_sans_source_regroupees(api, make_candidat):
    make_candidat(nom="Sans", source=None)
    par_source = {s["source"]: s for s in api.get("/api/stats/sources").json()}
    assert par_source["Non renseigné"]["total"] == 1


def test_sources_inconnue_regroupee_dans_non_renseigne(api, make_candidat):
    make_candidat(nom="Bizarre", source="Une source inventee")
    par_source = {s["source"]: s for s in api.get("/api/stats/sources").json()}
    assert par_source["Non renseigné"]["total"] == 1


def test_sources_triees_par_honoraires(api, make_candidat, make_poste, make_process):
    poste = make_poste()
    petit = make_candidat(nom="Petit", source="Indeed")
    gros = make_candidat(nom="Gros", source="LinkedIn")
    make_process(petit["id"], poste["id"], statut="PCLT", honoraire=1000.0)
    make_process(gros["id"], poste["id"], statut="PCLT", honoraire=9000.0)

    sources = api.get("/api/stats/sources").json()
    honoraires = [s["honoraires"] for s in sources]
    assert honoraires == sorted(honoraires, reverse=True)
    assert sources[0]["source"] == "LinkedIn"
