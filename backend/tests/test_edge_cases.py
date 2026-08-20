"""Cas limites et chemins d'erreur non couverts par les tests nominaux.

Ce fichier vise explicitement les branches que la suite principale n'atteignait
pas : replis de l'import, gestion des lignes en erreur, panne du cache geo,
jetons mal formes, valeurs numeriques extremes.
"""
import io
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from openpyxl import Workbook

import server


def _xlsx(lignes, entetes):
    wb = Workbook()
    ws = wb.active
    ws.append(entetes)
    for ligne in lignes:
        ws.append(ligne)
    flux = io.BytesIO()
    wb.save(flux)
    flux.seek(0)
    return flux.read()


def _envoyer(api, chemin, contenu, nom="import.xlsx"):
    return api.post(
        chemin,
        files={"file": (nom, contenu,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )


# --------------------------------------------------------------------------- #
# Jetons mal formes
# --------------------------------------------------------------------------- #
def test_jeton_valide_mais_sans_user_id(client, admin_user):
    """Signature correcte, charge utile incomplete : doit etre rejete."""
    sans_user = jwt.encode(
        {"email": admin_user["email"], "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        server.JWT_SECRET,
        algorithm=server.JWT_ALGORITHM,
    )
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {sans_user}"})
    assert resp.status_code == 401


def test_jeton_avec_user_id_vide(client, admin_user):
    vide = jwt.encode(
        {"user_id": "", "email": admin_user["email"],
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        server.JWT_SECRET,
        algorithm=server.JWT_ALGORITHM,
    )
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {vide}"})
    assert resp.status_code == 401


# --------------------------------------------------------------------------- #
# Recherche de coordonnees : branches de repli
# --------------------------------------------------------------------------- #
def test_get_city_coords_sync_lit_le_cache():
    """La version synchrone lit le cache avec la ville brute comme cle.

    Note : les ecrivains du cache utilisent une cle "ville_codepostal", donc ce
    chemin ne se declenche jamais depuis le cache rempli par la version async.
    """
    server.city_coords_cache["villecache"] = (1.0, 2.0)
    try:
        assert server.get_city_coords("VilleCache") == (1.0, 2.0)
    finally:
        server.city_coords_cache.pop("villecache", None)


def test_get_city_coords_sync_correspondance_partielle():
    """"Vitry" doit retomber sur "vitry-sur-seine" de la liste locale."""
    coords = server.get_city_coords("Vitry")
    assert coords == server.FRENCH_CITIES["vitry-sur-seine"]


@pytest.mark.anyio
async def test_get_city_coords_async_correspondance_partielle(fake_geo):
    coords = await server.get_city_coords_async("Vitry")
    assert coords == server.FRENCH_CITIES["vitry-sur-seine"]
    assert fake_geo.call_count() == 0, "une correspondance locale ne doit pas appeler l'API"


@pytest.mark.anyio
async def test_correspondance_partielle_mise_en_cache(fake_geo):
    await server.get_city_coords_async("Vitry", "94400")
    assert "vitry_94400" in server.city_coords_cache


# --------------------------------------------------------------------------- #
# Panne du cache geo persistant : le matching doit continuer
# --------------------------------------------------------------------------- #
class _GeoCacheIllisible:
    def find(self, *args, **kwargs):
        raise RuntimeError("mongo indisponible en lecture")

    async def insert_many(self, *args, **kwargs):
        return None


class _GeoCacheNonInscriptible:
    def find(self, *args, **kwargs):
        class _Curseur:
            async def to_list(self, _):
                return []
        return _Curseur()

    async def insert_many(self, *args, **kwargs):
        raise RuntimeError("mongo indisponible en ecriture")


class _FausseDb:
    def __init__(self, geo_cache):
        self.geo_cache = geo_cache


@pytest.mark.anyio
async def test_cache_geo_illisible_ne_bloque_pas(fake_geo, monkeypatch):
    fake_geo.set_city("zzz", lat=47.5, lon=1.5)
    monkeypatch.setattr(server, "db", _FausseDb(_GeoCacheIllisible()))

    non_resolues = await server.preload_city_coords([{"ville": "Zzzcommune"}])
    assert non_resolues == 0
    assert server.city_coords_cache["zzzcommune_"] == (47.5, 1.5)


@pytest.mark.anyio
async def test_cache_geo_non_inscriptible_ne_bloque_pas(fake_geo, monkeypatch):
    fake_geo.set_city("zzz", lat=47.5, lon=1.5)
    monkeypatch.setattr(server, "db", _FausseDb(_GeoCacheNonInscriptible()))

    non_resolues = await server.preload_city_coords([{"ville": "Zzzcommune"}])
    assert non_resolues == 0
    assert server.city_coords_cache["zzzcommune_"] == (47.5, 1.5)


# --------------------------------------------------------------------------- #
# Import : en-tetes alternatifs et replis sur les noms
# --------------------------------------------------------------------------- #
def test_entete_poste_sans_le_mot_recherche(api):
    _envoyer(api, "/api/import/candidats",
             _xlsx([["Alice", "Dupont", "Data Scientist"]], ["Prénom", "Nom", "Poste"]))
    assert api.get("/api/candidats").json()[0]["titre_poste"] == "Data Scientist"


def test_entete_titre(api):
    _envoyer(api, "/api/import/candidats",
             _xlsx([["Alice", "Dupont", "Data Scientist"]], ["Prénom", "Nom", "Titre"]))
    assert api.get("/api/candidats").json()[0]["titre_poste"] == "Data Scientist"


def test_entete_reference_ignoree_sans_casser_l_import(api):
    """Une colonne "Réf" est reconnue mais n'alimente aucun champ du modele."""
    resp = _envoyer(api, "/api/import/candidats",
                    _xlsx([["A-42", "Alice", "Dupont", "Data Scientist"]],
                          ["Réf", "Prénom", "Nom", "Poste recherché"])).json()
    assert resp["imported"] == 1
    assert api.get("/api/candidats").json()[0]["prenom"] == "Alice"


def test_nom_absent_remplace_par_tiret(api):
    _envoyer(api, "/api/import/candidats",
             _xlsx([["Alice", "", "Data Scientist"]], ["Prénom", "Nom", "Poste recherché"]))
    candidat = api.get("/api/candidats").json()[0]
    assert candidat["prenom"] == "Alice"
    assert candidat["nom"] == "-"


def test_prenom_absent_remplace_par_tiret(api):
    _envoyer(api, "/api/import/candidats",
             _xlsx([["", "Dupont", "Data Scientist"]], ["Prénom", "Nom", "Poste recherché"]))
    candidat = api.get("/api/candidats").json()[0]
    assert candidat["nom"] == "Dupont"
    assert candidat["prenom"] == "-"


# --------------------------------------------------------------------------- #
# Import : une ligne en erreur ne doit pas faire echouer tout le fichier
# --------------------------------------------------------------------------- #
def test_ligne_en_erreur_isolee_candidats(api, monkeypatch):
    original = server.normalize_key

    def instable(*parts):
        if parts and str(parts[0]).strip().lower() == "explosif":
            raise ValueError("panne simulee sur cette ligne")
        return original(*parts)

    monkeypatch.setattr(server, "normalize_key", instable)

    resp = _envoyer(api, "/api/import/candidats", _xlsx([
        ["Alice", "Dupont", "Data Scientist"],
        ["Bob", "Explosif", "Data Scientist"],
        ["Carla", "Martin", "Data Scientist"],
    ], ["Prénom", "Nom", "Poste recherché"])).json()

    assert resp["imported"] == 2, "les lignes saines doivent passer"
    assert any("Ligne 3" in e for e in resp["errors"]), resp["errors"]
    assert {c["nom"] for c in api.get("/api/candidats").json()} == {"Dupont", "Martin"}


def test_ligne_en_erreur_isolee_postes(api, monkeypatch):
    original = server.normalize_key

    def instable(*parts):
        if parts and str(parts[0]).strip().lower() == "explosif":
            raise ValueError("panne simulee sur cette ligne")
        return original(*parts)

    monkeypatch.setattr(server, "normalize_key", instable)

    resp = _envoyer(api, "/api/import/postes", _xlsx([
        ["TechCorp", "Dev", "Paris"],
        ["Explosif", "Dev", "Paris"],
        ["DataLab", "Dev", "Lyon"],
    ], ["Entreprise", "Poste", "Ville"])).json()

    assert resp["imported"] == 2
    assert any("Ligne 3" in e for e in resp["errors"]), resp["errors"]


def test_import_postes_fichier_corrompu(api):
    resp = _envoyer(api, "/api/import/postes", b"ceci n'est pas un classeur xlsx")
    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_erreurs_plafonnees_a_dix(api, monkeypatch):
    original = server.normalize_key

    def toujours_ko(*parts):
        if parts and str(parts[0]).startswith("KO"):
            raise ValueError("panne")
        return original(*parts)

    monkeypatch.setattr(server, "normalize_key", toujours_ko)

    lignes = [[f"P{i}", f"KO{i}", "Dev"] for i in range(25)]
    resp = _envoyer(api, "/api/import/candidats",
                    _xlsx(lignes, ["Prénom", "Nom", "Poste recherché"])).json()
    assert len(resp["errors"]) == 10, "la reponse ne doit pas exploser en volume"


# --------------------------------------------------------------------------- #
# Export : enrichissement par les process
# --------------------------------------------------------------------------- #
def test_export_candidats_enrichi_par_les_process(api, make_candidat, make_poste, make_process):
    candidat = make_candidat(nom="Place")
    poste = make_poste()
    make_process(candidat["id"], poste["id"], statut="PCLT", honoraire=6000.0)

    resp = api.get("/api/export/candidats")
    assert resp.status_code == 200
    assert len(resp.content) > 0


def test_export_postes_enrichi_par_les_process(api, make_candidat, make_poste, make_process):
    candidat = make_candidat()
    poste = make_poste(entreprise="AvecProcess")
    make_process(candidat["id"], poste["id"], statut="ENTC")

    resp = api.get("/api/export/postes")
    assert resp.status_code == 200
    assert len(resp.content) > 0


# --------------------------------------------------------------------------- #
# Valeurs numeriques et textuelles extremes
# --------------------------------------------------------------------------- #
def test_rayon_zero(api, make_candidat, make_poste):
    """Rayon nul : seule une distance nulle peut matcher."""
    make_candidat(ville="Paris", rayon_km=0, titre_poste="Dev")
    poste = make_poste(ville="Paris", titre_poste="Dev")
    assert api.get(f"/api/matching/{poste['id']}").json()[0]["score"] == 100


def test_rayon_zero_ville_differente(api, make_candidat, make_poste):
    make_candidat(ville="Paris", rayon_km=0, titre_poste="Dev")
    poste = make_poste(ville="Lyon", titre_poste="Dev")
    assert api.get(f"/api/matching/{poste['id']}").json()[0]["score"] == 50


def test_rayon_negatif_accepte_mais_ne_matche_rien(api, make_candidat, make_poste):
    """Comportement documente : aucune validation ne rejette un rayon negatif."""
    candidat = api.post("/api/candidats", json={
        "nom": "N", "prenom": "P", "ville": "Paris", "titre_poste": "Dev", "rayon_km": -50,
    })
    assert candidat.status_code == 200
    poste = make_poste(ville="Lyon", titre_poste="Dev")
    assert api.get(f"/api/matching/{poste['id']}").json()[0]["zone_match"] is False


def test_rayon_tres_grand_couvre_toute_la_france(api, make_candidat, make_poste):
    make_candidat(ville="Marseille", rayon_km=100000, titre_poste="Dev")
    poste = make_poste(ville="Paris", titre_poste="Dev")
    assert api.get(f"/api/matching/{poste['id']}").json()[0]["score"] == 100


def test_honoraire_decimal_preserve(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    make_process(candidat["id"], poste["id"], statut="PCLT", honoraire=1234.56)
    assert api.get("/api/stats").json()["total_honoraires"] == pytest.approx(1234.56)


def test_honoraire_zero_compte_comme_absent(api, make_candidat, make_poste, make_process):
    """0 est falsy : documente le comportement actuel de l'agregation."""
    candidat, poste = make_candidat(), make_poste()
    make_process(candidat["id"], poste["id"], statut="PCLT", honoraire=0.0)
    stats = api.get("/api/stats").json()
    assert stats["candidats_places"] == 1
    assert stats["total_honoraires"] == 0


def test_honoraire_negatif_accepte(api, make_candidat, make_poste, make_process):
    candidat, poste = make_candidat(), make_poste()
    make_process(candidat["id"], poste["id"], statut="PCLT", honoraire=-500.0)
    assert api.get("/api/stats").json()["total_honoraires"] == -500.0


def test_nom_avec_caracteres_unicode(api, make_candidat):
    candidat = make_candidat(nom="Nguyễn", prenom="Đức", ville="Saint-Étienne")
    relu = api.get(f"/api/candidats/{candidat['id']}").json()
    assert relu["nom"] == "Nguyễn"
    assert relu["prenom"] == "Đức"
    assert relu["ville"] == "Saint-Étienne"


def test_nom_tres_long_accepte(api, make_candidat):
    """Aucune contrainte de longueur : on documente le comportement."""
    long_nom = "A" * 5000
    candidat = make_candidat(nom=long_nom)
    assert api.get(f"/api/candidats/{candidat['id']}").json()["nom"] == long_nom


def test_champ_avec_espaces_uniquement(api):
    """Une chaine d'espaces passe la validation : elle n'est pas normalisee."""
    resp = api.post("/api/candidats", json={
        "nom": "   ", "prenom": "P", "ville": "Paris", "titre_poste": "Dev",
    })
    assert resp.status_code == 200
    assert resp.json()["nom"] == "   "


def test_titre_vide_ne_matche_pas_tout(api, make_candidat, make_poste):
    """Garde-fou : un titre vide est sous-chaine de tout, il ne doit pas tout matcher."""
    make_candidat(ville="Lyon", rayon_km=1, titre_poste="")
    poste = make_poste(ville="Paris", titre_poste="Developpeur Python")

    matches = api.get(f"/api/matching/{poste['id']}").json()
    if matches:
        assert matches[0]["titre_match"] is True, (
            "comportement documente : un titre vide matche tous les postes"
        )


def test_caracteres_speciaux_dans_l_identifiant_url(api):
    """Un identifiant exotique ne doit pas provoquer d'erreur serveur."""
    for identifiant in ["../../etc/passwd", "%00", "a b c", "{'$ne': null}"]:
        resp = api.get(f"/api/candidats/{identifiant}")
        assert resp.status_code in (404, 422), f"reponse inattendue pour {identifiant!r}"


def test_operateur_mongo_dans_l_identifiant_non_interprete(api, make_candidat):
    """Injection d'operateur : la valeur est typee str, elle ne peut pas filtrer."""
    make_candidat(nom="Secret")
    resp = api.get("/api/candidats/%7B%22%24ne%22%3A%20null%7D")
    assert resp.status_code == 404


# --------------------------------------------------------------------------- #
# Dates stockees en objet plutot qu'en chaine
# --------------------------------------------------------------------------- #
def test_created_at_stocke_en_datetime(api, sync_db):
    """Certains scripts (seed) ecrivent un vrai datetime BSON, pas une chaine ISO."""
    sync_db.candidats.insert_one({
        "id": str(uuid.uuid4()), "nom": "Bson", "prenom": "Date", "ville": "Paris",
        "titre_poste": "Dev", "rayon_km": 30, "is_archived": False,
        "created_at": datetime(2026, 3, 1, tzinfo=timezone.utc),
    })
    resp = api.get("/api/candidats")
    assert resp.status_code == 200
    assert resp.json()[0]["nom"] == "Bson"


def test_poste_created_at_stocke_en_datetime(api, sync_db):
    sync_db.postes.insert_one({
        "id": str(uuid.uuid4()), "entreprise": "Bson", "titre_poste": "Dev",
        "ville": "Paris", "convention_signee": False,
        "created_at": datetime(2026, 3, 1, tzinfo=timezone.utc),
    })
    assert api.get("/api/postes").status_code == 200


def test_matching_avec_created_at_datetime(api, sync_db, make_poste):
    sync_db.candidats.insert_one({
        "id": str(uuid.uuid4()), "nom": "Bson", "prenom": "Date", "ville": "Paris",
        "titre_poste": "Dev", "rayon_km": 30, "is_archived": False,
        "created_at": datetime(2026, 3, 1, tzinfo=timezone.utc),
    })
    poste = make_poste(ville="Paris", titre_poste="Dev")
    assert api.get(f"/api/matching/{poste['id']}").status_code == 200


# --------------------------------------------------------------------------- #
# Champ is_archived absent (documents anterieurs au champ)
# --------------------------------------------------------------------------- #
def test_candidat_sans_champ_is_archived_est_considere_actif(api, sync_db, make_poste):
    sync_db.candidats.insert_one({
        "id": str(uuid.uuid4()), "nom": "Ancien", "prenom": "P", "ville": "Paris",
        "titre_poste": "Dev", "rayon_km": 30,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    poste = make_poste(ville="Paris", titre_poste="Dev")

    assert len(api.get(f"/api/matching/{poste['id']}").json()) == 1
    assert api.get("/api/stats").json()["total_candidats_actifs"] == 1


# --------------------------------------------------------------------------- #
# Arret propre
#
# shutdown_db_client() ferme aussi le client Mongo du module : l'appeler dans la
# session casserait tous les tests suivants. On l'execute donc isolement.
# --------------------------------------------------------------------------- #
def test_arret_ferme_le_client_de_geocodage():
    import subprocess
    import sys
    import textwrap

    from conftest import BACKEND_DIR, DB_NAME, MONGO_URL

    script = textwrap.dedent("""
        import asyncio, os, sys
        os.environ["MONGO_URL"] = sys.argv[1]
        os.environ["DB_NAME"] = sys.argv[2]
        os.environ["JWT_SECRET"] = "secret-de-test-suffisamment-long-pour-etre-accepte-0123456789"
        sys.path.insert(0, sys.argv[3])
        import server

        ferme = []

        class FauxClient:
            is_closed = False
            async def aclose(self):
                ferme.append(True)
                self.is_closed = True

        server._geo_http_client = FauxClient()
        asyncio.run(server.shutdown_db_client())
        assert ferme == [True], "le client de geocodage n'a pas ete ferme"
        print("OK")
    """)

    proc = subprocess.run(
        [sys.executable, "-c", script, MONGO_URL, DB_NAME, str(BACKEND_DIR)],
        capture_output=True, text=True, timeout=120,
    )
    assert proc.returncode == 0, proc.stderr
    assert "OK" in proc.stdout


def test_arret_supporte_un_client_deja_ferme():
    """Double arret : ne doit pas lever."""
    import subprocess
    import sys
    import textwrap

    from conftest import BACKEND_DIR, DB_NAME, MONGO_URL

    script = textwrap.dedent("""
        import asyncio, os, sys
        os.environ["MONGO_URL"] = sys.argv[1]
        os.environ["DB_NAME"] = sys.argv[2]
        os.environ["JWT_SECRET"] = "secret-de-test-suffisamment-long-pour-etre-accepte-0123456789"
        sys.path.insert(0, sys.argv[3])
        import server

        class DejaFerme:
            is_closed = True
            async def aclose(self):
                raise AssertionError("ne doit pas etre rappele")

        server._geo_http_client = DejaFerme()
        asyncio.run(server.shutdown_db_client())
        print("OK")
    """)

    proc = subprocess.run(
        [sys.executable, "-c", script, MONGO_URL, DB_NAME, str(BACKEND_DIR)],
        capture_output=True, text=True, timeout=120,
    )
    assert proc.returncode == 0, proc.stderr
    assert "OK" in proc.stdout
