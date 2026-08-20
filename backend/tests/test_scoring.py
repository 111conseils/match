"""Tests unitaires du moteur de score : distances, normalisation, correspondance.

Aucune base de donnees ni reseau : ces tests tournent partout.
"""
import pytest

import server


# --------------------------------------------------------------------------- #
# Distance (formule de Haversine)
# --------------------------------------------------------------------------- #
PARIS = (48.8566, 2.3522)
LYON = (45.7640, 4.8357)
MARSEILLE = (43.2965, 5.3698)


def test_distance_nulle_pour_le_meme_point():
    assert server.calculate_distance_km(PARIS, PARIS) == pytest.approx(0, abs=1e-9)


def test_distance_paris_lyon():
    # Distance orthodromique de reference : ~392 km
    assert server.calculate_distance_km(PARIS, LYON) == pytest.approx(392, abs=10)


def test_distance_paris_marseille():
    # ~660 km a vol d'oiseau
    assert server.calculate_distance_km(PARIS, MARSEILLE) == pytest.approx(660, abs=15)


def test_distance_symetrique():
    assert server.calculate_distance_km(PARIS, LYON) == pytest.approx(
        server.calculate_distance_km(LYON, PARIS)
    )


def test_distance_un_degre_de_latitude():
    """Un degre de latitude vaut ~111 km partout sur le globe."""
    assert server.calculate_distance_km((0.0, 0.0), (1.0, 0.0)) == pytest.approx(111, abs=1)


def test_distance_inegalite_triangulaire():
    directe = server.calculate_distance_km(PARIS, MARSEILLE)
    via_lyon = (server.calculate_distance_km(PARIS, LYON)
                + server.calculate_distance_km(LYON, MARSEILLE))
    assert directe <= via_lyon


# --------------------------------------------------------------------------- #
# Normalisation des intitules
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("brut,attendu", [
    ("Developpeur", "developpeur"),
    ("  Developpeur  ", "developpeur"),
    ("DEVELOPPEUR", "developpeur"),
    ("DeVeLoPpEuR", "developpeur"),
])
def test_normalize_title(brut, attendu):
    assert server.normalize_title(brut) == attendu


# --------------------------------------------------------------------------- #
# Correspondance des intitules
#
# Le matching par sous-chaine est VOULU : un candidat "Commercial" doit remonter
# sur un poste "Directeur Commercial". Ces tests verrouillent ce comportement.
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("a,b", [
    ("Developpeur Python", "Developpeur Python"),      # identique
    ("developpeur python", "DEVELOPPEUR PYTHON"),      # casse ignoree
    ("  Developpeur  ", "Developpeur"),                # espaces ignores
    ("Commercial", "Directeur Commercial"),            # sous-chaine : voulu
    ("Directeur Commercial", "Commercial"),            # dans l'autre sens aussi
    ("Assistant", "Assistant de direction"),
    ("Chef de projet", "Chef de projet IT"),
])
def test_titres_correspondent(a, b):
    assert server.titles_match(a, b) is True


@pytest.mark.parametrize("a,b", [
    ("Developpeur Python", "Developpeur Java"),
    ("Data Scientist", "UX Designer"),
    ("Comptable", "Juriste"),
])
def test_titres_ne_correspondent_pas(a, b):
    assert server.titles_match(a, b) is False


def test_titres_correspondance_symetrique():
    assert server.titles_match("Commercial", "Directeur Commercial") == \
           server.titles_match("Directeur Commercial", "Commercial")


# --------------------------------------------------------------------------- #
# Cle de deduplication (import Excel)
# --------------------------------------------------------------------------- #
def test_normalize_key_ignore_accents_et_casse():
    assert server.normalize_key("Frédéric", "LEROY") == server.normalize_key("frederic", "leroy")


def test_normalize_key_ignore_espaces_multiples():
    assert server.normalize_key("Jean   Pierre") == server.normalize_key("Jean Pierre")


def test_normalize_key_gere_none():
    assert server.normalize_key(None, "Dupont") == "|dupont"


def test_normalize_key_distingue_des_valeurs_differentes():
    assert server.normalize_key("Dupont", "Alice") != server.normalize_key("Dupont", "Bob")


def test_normalize_key_ne_confond_pas_les_frontieres_de_champs():
    """("ab", "c") ne doit pas donner la meme cle que ("a", "bc")."""
    assert server.normalize_key("ab", "c") != server.normalize_key("a", "bc")


def test_normalize_key_gere_les_nombres():
    assert server.normalize_key(75001) == "75001"


# --------------------------------------------------------------------------- #
# Score de matching (version synchrone)
# --------------------------------------------------------------------------- #
def _candidat(**kw):
    base = {"titre_poste": "Developpeur Python", "ville": "Paris", "rayon_km": 30}
    base.update(kw)
    return base


def _poste(**kw):
    base = {"titre_poste": "Developpeur Python", "ville": "Paris"}
    base.update(kw)
    return base


def test_score_100_titre_et_zone():
    res = server.calculate_match_score(_candidat(), _poste())
    assert res == {"score": 100, "titre_match": True, "zone_match": True}


def test_score_50_titre_seul():
    """Meme metier, mais Lyon est hors du rayon de 30 km autour de Paris."""
    res = server.calculate_match_score(_candidat(ville="Paris", rayon_km=30), _poste(ville="Lyon"))
    assert res["score"] == 50
    assert res["titre_match"] is True
    assert res["zone_match"] is False


def test_score_50_zone_seule():
    res = server.calculate_match_score(_candidat(), _poste(titre_poste="Juriste"))
    assert res["score"] == 50
    assert res["titre_match"] is False
    assert res["zone_match"] is True


def test_score_0_aucune_correspondance():
    res = server.calculate_match_score(
        _candidat(ville="Paris", rayon_km=30), _poste(titre_poste="Juriste", ville="Lyon")
    )
    assert res == {"score": 0, "titre_match": False, "zone_match": False}


def test_score_rayon_large_couvre_lyon():
    distance = server.calculate_distance_km(PARIS, LYON)
    res = server.calculate_match_score(
        _candidat(rayon_km=int(distance) + 10), _poste(ville="Lyon")
    )
    assert res["zone_match"] is True
    assert res["score"] == 100


def test_score_rayon_juste_insuffisant():
    distance = server.calculate_distance_km(PARIS, LYON)
    res = server.calculate_match_score(
        _candidat(rayon_km=int(distance) - 10), _poste(ville="Lyon")
    )
    assert res["zone_match"] is False


def test_score_rayon_exactement_egal_a_la_distance():
    """La comparaison est <= : une distance egale au rayon doit matcher."""
    distance = server.calculate_distance_km(PARIS, LYON)
    res = server.calculate_match_score(
        _candidat(rayon_km=int(distance) + 1), _poste(ville="Lyon")
    )
    assert res["zone_match"] is True


def test_score_repli_sur_nom_de_ville_identique():
    """Ville inconnue au geocodage : le nom identique vaut quand meme la zone."""
    ville = "Zzzcommune-Inexistante"
    assert server.get_city_coords(ville) is None
    res = server.calculate_match_score(_candidat(ville=ville), _poste(ville=ville))
    assert res["zone_match"] is True
    assert res["score"] == 100


def test_score_villes_inconnues_differentes():
    res = server.calculate_match_score(
        _candidat(ville="Zzzcommune-A"), _poste(ville="Qqqcommune-B")
    )
    assert res["zone_match"] is False
    assert res["score"] == 50  # le titre matche toujours


def test_score_rayon_par_defaut_si_absent():
    """rayon_km absent du document : 30 km doivent etre appliques."""
    candidat = {"titre_poste": "Developpeur Python", "ville": "Paris"}
    res = server.calculate_match_score(candidat, _poste(ville="Lyon"))
    assert res["zone_match"] is False  # 30 km ne suffisent pas pour Lyon


@pytest.mark.parametrize("titre_ok", [True, False])
@pytest.mark.parametrize("zone_ok", [True, False])
def test_score_ne_vaut_que_0_50_ou_100(titre_ok, zone_ok):
    """Propriete structurante : le score est toujours 0, 50 ou 100.

    C'est ce qui rend le seuil ">= 70" du dashboard equivalent a "== 100".
    """
    res = server.calculate_match_score(
        _candidat(rayon_km=30),
        _poste(titre_poste="Developpeur Python" if titre_ok else "Juriste",
               ville="Paris" if zone_ok else "Lyon"),
    )
    assert res["score"] in (0, 50, 100)
    assert res["score"] == 50 * (int(res["titre_match"]) + int(res["zone_match"]))


# --------------------------------------------------------------------------- #
# Recherche de coordonnees dans la liste locale
# --------------------------------------------------------------------------- #
def test_get_city_coords_exact():
    assert server.get_city_coords("Paris") == PARIS


def test_get_city_coords_insensible_a_la_casse_et_aux_espaces():
    assert server.get_city_coords("  PARIS  ") == PARIS


def test_get_city_coords_ville_inconnue():
    assert server.get_city_coords("Zzzcommune-Inexistante") is None


def test_liste_locale_non_vide():
    assert len(server.FRENCH_CITIES) > 100


def test_coordonnees_locales_dans_les_bornes_francaises():
    """Garde-fou contre une inversion latitude/longitude dans la liste en dur."""
    for ville, (lat, lon) in server.FRENCH_CITIES.items():
        assert 41 <= lat <= 52, f"latitude hors de France pour {ville}"
        assert -6 <= lon <= 10, f"longitude hors de France pour {ville}"
