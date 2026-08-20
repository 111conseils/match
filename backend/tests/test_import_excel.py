"""Tests d'import Excel : deduplication, tolerance sur les en-tetes, erreurs remontees."""
import io

import pytest
from openpyxl import Workbook


def _xlsx(lignes, entetes):
    """Construit un classeur en memoire, pret a etre envoye."""
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


ENTETES_CANDIDATS = ["Prénom", "Nom", "Poste recherché", "Ville", "Code postal",
                     "Rayon", "Rémunération", "Disponibilité", "Source"]
LIGNE_ALICE = ["Alice", "Dupont", "Développeur Python", "Rennes", "35000", "40", "45000",
               "Immédiate", "LinkedIn"]
LIGNE_BOB = ["Bob", "Martin", "Data Scientist", "Nantes", "44000", "25", "50000",
             "1 mois", "Indeed"]

ENTETES_POSTES = ["Entreprise", "Poste", "Ville", "Code postal", "Convention",
                  "Contact", "Email"]
LIGNE_TECHCORP = ["TechCorp", "Développeur Python", "Paris", "75002", "Oui",
                  "Marie Durand", "m.durand@techcorp.fr"]


# --------------------------------------------------------------------------- #
# Import de candidats
# --------------------------------------------------------------------------- #
def test_import_basique(api):
    resp = _envoyer(api, "/api/import/candidats",
                    _xlsx([LIGNE_ALICE, LIGNE_BOB], ENTETES_CANDIDATS))
    assert resp.status_code == 200
    corps = resp.json()
    assert corps["success"] is True
    assert corps["imported"] == 2
    assert corps["updated"] == 0
    assert len(api.get("/api/candidats").json()) == 2


def test_import_renseigne_les_champs(api):
    _envoyer(api, "/api/import/candidats", _xlsx([LIGNE_ALICE], ENTETES_CANDIDATS))
    candidat = api.get("/api/candidats").json()[0]

    assert candidat["prenom"] == "Alice"
    assert candidat["nom"] == "Dupont"
    assert candidat["titre_poste"] == "Développeur Python"
    assert candidat["ville"] == "Rennes"
    assert candidat["code_postal"] == "35000"
    assert candidat["rayon_km"] == 40
    assert candidat["source"] == "LinkedIn"


def test_import_pose_is_archived(api):
    """Regression : les candidats importes n'avaient pas le champ is_archived."""
    _envoyer(api, "/api/import/candidats", _xlsx([LIGNE_ALICE], ENTETES_CANDIDATS))
    assert api.get("/api/candidats").json()[0]["is_archived"] is False


def test_reimport_du_meme_fichier_ne_duplique_pas(api):
    """Regression : reimporter le meme fichier doublait toute la base."""
    contenu = _xlsx([LIGNE_ALICE, LIGNE_BOB], ENTETES_CANDIDATS)

    premier = _envoyer(api, "/api/import/candidats", contenu).json()
    second = _envoyer(api, "/api/import/candidats", contenu).json()

    assert premier["imported"] == 2 and premier["updated"] == 0
    assert second["imported"] == 0 and second["updated"] == 2
    assert len(api.get("/api/candidats").json()) == 2


def test_reimport_met_a_jour_les_champs_modifies(api):
    _envoyer(api, "/api/import/candidats", _xlsx([LIGNE_ALICE], ENTETES_CANDIDATS))

    corrigee = list(LIGNE_ALICE)
    corrigee[3] = "Brest"      # la ville est corrigee dans le fichier source
    corrigee[6] = "48000"      # la remuneration aussi
    _envoyer(api, "/api/import/candidats", _xlsx([corrigee], ENTETES_CANDIDATS))

    candidats = api.get("/api/candidats").json()
    assert len(candidats) == 1
    assert candidats[0]["ville"] == "Brest"
    assert candidats[0]["remuneration"] == "48000"


def test_dedup_insensible_aux_accents_et_a_la_casse(api):
    _envoyer(api, "/api/import/candidats",
             _xlsx([["Frédéric", "Leroy"] + LIGNE_ALICE[2:]], ENTETES_CANDIDATS))
    resp = _envoyer(api, "/api/import/candidats",
                    _xlsx([["FREDERIC", "LEROY"] + LIGNE_ALICE[2:]], ENTETES_CANDIDATS)).json()

    assert resp["imported"] == 0
    assert resp["updated"] == 1
    assert len(api.get("/api/candidats").json()) == 1


def test_dedup_a_l_interieur_du_meme_fichier(api):
    """Deux lignes identiques dans un meme classeur ne creent qu'un candidat."""
    resp = _envoyer(api, "/api/import/candidats",
                    _xlsx([LIGNE_ALICE, LIGNE_ALICE], ENTETES_CANDIDATS)).json()
    assert resp["imported"] == 1
    assert resp["updated"] == 1
    assert len(api.get("/api/candidats").json()) == 1


def test_homonymes_ne_sont_pas_fusionnes_si_prenom_different(api):
    ligne2 = list(LIGNE_ALICE)
    ligne2[0] = "Bernard"
    resp = _envoyer(api, "/api/import/candidats",
                    _xlsx([LIGNE_ALICE, ligne2], ENTETES_CANDIDATS)).json()
    assert resp["imported"] == 2


def test_rayon_illisible_remonte_une_erreur_et_applique_30(api):
    """Regression : le "except:" nu avalait l'erreur en silence."""
    ligne = list(LIGNE_ALICE)
    ligne[5] = "beaucoup de km"

    resp = _envoyer(api, "/api/import/candidats", _xlsx([ligne], ENTETES_CANDIDATS)).json()

    assert resp["imported"] == 1
    assert resp["errors"], "l'erreur de rayon aurait du etre remontee"
    assert "rayon" in resp["errors"][0].lower()
    assert api.get("/api/candidats").json()[0]["rayon_km"] == 30


def test_rayon_avec_suffixe_km(api):
    ligne = list(LIGNE_ALICE)
    ligne[5] = "45 km"
    _envoyer(api, "/api/import/candidats", _xlsx([ligne], ENTETES_CANDIDATS))
    assert api.get("/api/candidats").json()[0]["rayon_km"] == 45


def test_rayon_decimal(api):
    ligne = list(LIGNE_ALICE)
    ligne[5] = "42.7"
    _envoyer(api, "/api/import/candidats", _xlsx([ligne], ENTETES_CANDIDATS))
    assert api.get("/api/candidats").json()[0]["rayon_km"] == 42


def test_lignes_vides_ignorees(api):
    contenu = _xlsx([LIGNE_ALICE, [None] * 9, ["", ""] + [None] * 7, LIGNE_BOB],
                    ENTETES_CANDIDATS)
    resp = _envoyer(api, "/api/import/candidats", contenu).json()
    assert resp["imported"] == 2


def test_colonne_nom_complet(api):
    """En-tete "Candidats" contenant "Prenom Nom" en une seule cellule."""
    contenu = _xlsx([["Alice Dupont", "Développeur Python", "Rennes"]],
                    ["Candidats", "Poste recherché", "Ville"])
    resp = _envoyer(api, "/api/import/candidats", contenu).json()
    assert resp["imported"] == 1

    candidat = api.get("/api/candidats").json()[0]
    assert candidat["prenom"] == "Alice"
    assert candidat["nom"] == "Dupont"


def test_colonne_nom_complet_sans_espace(api):
    contenu = _xlsx([["Cher", "Développeur Python", "Rennes"]],
                    ["Candidats", "Poste recherché", "Ville"])
    _envoyer(api, "/api/import/candidats", contenu)
    candidat = api.get("/api/candidats").json()[0]
    assert candidat["nom"] == "Cher"
    assert candidat["prenom"] == "-"


def test_departement_utilise_a_defaut_de_ville(api):
    contenu = _xlsx([["Alice", "Dupont", "Développeur Python", "Ille-et-Vilaine"]],
                    ["Prénom", "Nom", "Poste recherché", "Département"])
    _envoyer(api, "/api/import/candidats", contenu)
    assert api.get("/api/candidats").json()[0]["ville"] == "Ille-et-Vilaine"


def test_champs_absents_prennent_non_renseigne(api):
    contenu = _xlsx([["Alice", "Dupont"]], ["Prénom", "Nom"])
    _envoyer(api, "/api/import/candidats", contenu)
    candidat = api.get("/api/candidats").json()[0]
    assert candidat["titre_poste"] == "Non renseigné"
    assert candidat["ville"] == "Non renseigné"


def test_fichier_non_excel_refuse(api):
    resp = api.post("/api/import/candidats",
                    files={"file": ("donnees.csv", b"a,b,c", "text/csv")})
    assert resp.status_code == 400


def test_fichier_corrompu_refuse_proprement(api):
    resp = _envoyer(api, "/api/import/candidats", b"ceci n'est pas un classeur")
    assert resp.status_code == 400
    assert "detail" in resp.json()


def test_import_sans_authentification(client):
    resp = client.post("/api/import/candidats",
                       files={"file": ("x.xlsx", b"x", "application/vnd.ms-excel")})
    assert resp.status_code in (401, 403)


def test_candidats_importes_participent_au_matching(api, make_poste):
    _envoyer(api, "/api/import/candidats",
             _xlsx([["Alice", "Dupont", "Développeur Python", "Paris"]],
                   ["Prénom", "Nom", "Poste recherché", "Ville"]))
    poste = make_poste(ville="Paris", titre_poste="Développeur Python")

    matches = api.get(f"/api/matching/{poste['id']}").json()
    assert len(matches) == 1
    assert matches[0]["score"] == 100


# --------------------------------------------------------------------------- #
# Import de postes
# --------------------------------------------------------------------------- #
def test_import_postes_basique(api):
    resp = _envoyer(api, "/api/import/postes",
                    _xlsx([LIGNE_TECHCORP], ENTETES_POSTES)).json()
    assert resp["imported"] == 1
    assert resp["updated"] == 0

    poste = api.get("/api/postes").json()[0]
    assert poste["entreprise"] == "TechCorp"
    assert poste["titre_poste"] == "Développeur Python"
    assert poste["convention_signee"] is True
    assert poste["contact"] == "Marie Durand"
    assert poste["email_contact"] == "m.durand@techcorp.fr"


def test_reimport_postes_ne_duplique_pas(api):
    contenu = _xlsx([LIGNE_TECHCORP], ENTETES_POSTES)
    _envoyer(api, "/api/import/postes", contenu)
    second = _envoyer(api, "/api/import/postes", contenu).json()

    assert second["imported"] == 0
    assert second["updated"] == 1
    assert len(api.get("/api/postes").json()) == 1


def test_postes_meme_entreprise_titres_differents_non_fusionnes(api):
    autre = list(LIGNE_TECHCORP)
    autre[1] = "Data Scientist"
    resp = _envoyer(api, "/api/import/postes",
                    _xlsx([LIGNE_TECHCORP, autre], ENTETES_POSTES)).json()
    assert resp["imported"] == 2


def test_postes_meme_poste_villes_differentes_non_fusionnes(api):
    autre = list(LIGNE_TECHCORP)
    autre[2] = "Lyon"
    resp = _envoyer(api, "/api/import/postes",
                    _xlsx([LIGNE_TECHCORP, autre], ENTETES_POSTES)).json()
    assert resp["imported"] == 2


@pytest.mark.parametrize("valeur,attendu", [
    ("Oui", True), ("oui", True), ("OUI", True), ("true", True), ("1", True),
    ("signée", True), ("Non", False), ("", False), ("peut-etre", False),
])
def test_convention_signee_interpretee(api, valeur, attendu):
    ligne = list(LIGNE_TECHCORP)
    ligne[4] = valeur
    _envoyer(api, "/api/import/postes", _xlsx([ligne], ENTETES_POSTES))
    assert api.get("/api/postes").json()[0]["convention_signee"] is attendu


def test_postes_ligne_sans_entreprise_ignoree(api):
    vide = ["", "Développeur Python", "Paris", "", "", "", ""]
    resp = _envoyer(api, "/api/import/postes",
                    _xlsx([LIGNE_TECHCORP, vide], ENTETES_POSTES)).json()
    assert resp["imported"] == 1


def test_import_postes_fichier_non_excel(api):
    resp = api.post("/api/import/postes", files={"file": ("x.txt", b"abc", "text/plain")})
    assert resp.status_code == 400
