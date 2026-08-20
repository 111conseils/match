"""Tests du geocodage : cache memoire, cache negatif, cache persistant, preload.

L'API Adresse est simulee (fixture fake_geo) : aucun appel reseau reel.
"""
from datetime import datetime, timedelta, timezone

import pytest

import server

pytestmark = pytest.mark.anyio

VILLE_INCONNUE = "Zzzcommune-Inexistante"
AUTRE_INCONNUE = "Qqqbourg-Introuvable"


def _cle(ville, code_postal=None):
    return f"{ville.lower().strip()}_{code_postal or ''}"


# --------------------------------------------------------------------------- #
# Chemins de resolution
# --------------------------------------------------------------------------- #
async def test_liste_locale_ne_declenche_aucun_appel_api(fake_geo):
    coords = await server.get_city_coords_async("Paris")
    assert coords == server.FRENCH_CITIES["paris"]
    assert fake_geo.call_count() == 0


async def test_appel_api_pour_ville_hors_liste(fake_geo):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    coords = await server.get_city_coords_async(VILLE_INCONNUE)
    assert coords == (47.5, 1.5)
    assert fake_geo.call_count() == 1


async def test_inversion_longitude_latitude(fake_geo):
    """L'API Adresse renvoie [longitude, latitude] : le code doit inverser."""
    fake_geo.set_city(VILLE_INCONNUE, lat=48.1, lon=-1.68)
    lat, lon = await server.get_city_coords_async(VILLE_INCONNUE)
    assert lat == 48.1 and lon == -1.68
    assert 41 <= lat <= 52, "latitude et longitude ont ete inversees"


async def test_code_postal_transmis_a_l_api(fake_geo):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    await server.get_city_coords_async(VILLE_INCONNUE, "35000")
    assert "35000" in fake_geo.calls[0]


async def test_cache_memoire_evite_le_second_appel(fake_geo):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    await server.get_city_coords_async(VILLE_INCONNUE)
    await server.get_city_coords_async(VILLE_INCONNUE)
    await server.get_city_coords_async(VILLE_INCONNUE)
    assert fake_geo.call_count() == 1


async def test_meme_ville_codes_postaux_differents_sont_distinctes(fake_geo):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    await server.get_city_coords_async(VILLE_INCONNUE, "35000")
    await server.get_city_coords_async(VILLE_INCONNUE, "44000")
    assert fake_geo.call_count() == 2


# --------------------------------------------------------------------------- #
# Cas d'echec de l'API
# --------------------------------------------------------------------------- #
async def test_reponse_sans_resultat_renvoie_none(fake_geo):
    assert await server.get_city_coords_async(VILLE_INCONNUE) is None


async def test_reponse_http_non_200_renvoie_none(fake_geo):
    fake_geo.default = type(fake_geo.default)(status_code=503, payload={})
    assert await server.get_city_coords_async(VILLE_INCONNUE) is None


async def test_exception_reseau_renvoie_none_sans_planter(fake_geo):
    fake_geo.raise_on.add(VILLE_INCONNUE.lower())
    assert await server.get_city_coords_async(VILLE_INCONNUE) is None


# --------------------------------------------------------------------------- #
# Cache negatif — c'est ce qui evitait 800 appels pour une ville en erreur
# --------------------------------------------------------------------------- #
async def test_cache_negatif_une_seule_tentative(fake_geo):
    for _ in range(10):
        assert await server.get_city_coords_async(VILLE_INCONNUE) is None
    assert fake_geo.call_count() == 1, "l'API a ete rappelee malgre le cache negatif"


async def test_cache_negatif_enregistre_l_echec(fake_geo):
    await server.get_city_coords_async(VILLE_INCONNUE)
    assert _cle(VILLE_INCONNUE) in server._geo_failures


async def test_cache_negatif_expire_apres_le_ttl(fake_geo):
    await server.get_city_coords_async(VILLE_INCONNUE)
    assert fake_geo.call_count() == 1

    # On antidate l'echec au-dela du TTL
    vieux = datetime.now(timezone.utc) - timedelta(seconds=server.GEO_NEGATIVE_TTL_SECONDS + 60)
    server._geo_failures[_cle(VILLE_INCONNUE)] = vieux

    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    assert await server.get_city_coords_async(VILLE_INCONNUE) == (47.5, 1.5)
    assert fake_geo.call_count() == 2, "l'API aurait du etre reinterrogee apres expiration"


async def test_succes_efface_l_echec_precedent(fake_geo):
    await server.get_city_coords_async(VILLE_INCONNUE)
    server._geo_failures[_cle(VILLE_INCONNUE)] = (
        datetime.now(timezone.utc) - timedelta(seconds=server.GEO_NEGATIVE_TTL_SECONDS + 60)
    )
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    await server.get_city_coords_async(VILLE_INCONNUE)
    assert _cle(VILLE_INCONNUE) not in server._geo_failures
    assert _cle(VILLE_INCONNUE) in server.city_coords_cache


async def test_ttl_negatif_raisonnable():
    """Assez court pour qu'une panne se resorbe, assez long pour proteger l'API."""
    assert 60 <= server.GEO_NEGATIVE_TTL_SECONDS <= 3600


# --------------------------------------------------------------------------- #
# preload_city_coords — un appel par ville distincte, pas par paire
# --------------------------------------------------------------------------- #
async def test_preload_un_appel_par_ville_distincte(fake_geo, async_db):
    fake_geo.set_city("zzz", lat=47.5, lon=1.5)
    # 50 documents mais seulement 2 villes distinctes
    docs = [{"ville": VILLE_INCONNUE if i % 2 else AUTRE_INCONNUE} for i in range(50)]
    await server.preload_city_coords(docs)
    assert fake_geo.call_count() == 2, "le preload doit dedupliquer les villes"


async def test_preload_ignore_les_villes_deja_en_cache(fake_geo, async_db):
    server.city_coords_cache[_cle(VILLE_INCONNUE)] = (47.5, 1.5)
    await server.preload_city_coords([{"ville": VILLE_INCONNUE}])
    assert fake_geo.call_count() == 0


async def test_preload_ignore_les_villes_vides(fake_geo, async_db):
    await server.preload_city_coords([{"ville": ""}, {"ville": None}, {}, {"ville": "   "}])
    assert fake_geo.call_count() == 0


async def test_preload_accepte_plusieurs_collections(fake_geo, async_db):
    fake_geo.set_city("zzz", lat=47.5, lon=1.5)
    await server.preload_city_coords([{"ville": VILLE_INCONNUE}], [{"ville": AUTRE_INCONNUE}])
    assert fake_geo.call_count() == 2


async def test_preload_retourne_le_nombre_de_villes_non_resolues(fake_geo, async_db):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    non_resolues = await server.preload_city_coords(
        [{"ville": VILLE_INCONNUE}, {"ville": AUTRE_INCONNUE}]
    )
    assert non_resolues == 1


async def test_preload_retourne_zero_quand_tout_est_resolu(fake_geo, async_db):
    fake_geo.set_city("zzz", lat=47.5, lon=1.5)
    assert await server.preload_city_coords([{"ville": VILLE_INCONNUE}]) == 0


async def test_preload_remplit_le_cache_memoire(fake_geo, async_db):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    await server.preload_city_coords([{"ville": VILLE_INCONNUE}])
    assert server.city_coords_cache[_cle(VILLE_INCONNUE)] == (47.5, 1.5)


# --------------------------------------------------------------------------- #
# Cache persistant en base — survit au redemarrage
# --------------------------------------------------------------------------- #
async def test_preload_persiste_en_base(fake_geo, async_db):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    await server.preload_city_coords([{"ville": VILLE_INCONNUE}])

    doc = await async_db.geo_cache.find_one({"_id": _cle(VILLE_INCONNUE)})
    assert doc is not None
    assert (doc["lat"], doc["lon"]) == (47.5, 1.5)


async def test_preload_relit_la_base_sans_rappeler_l_api(fake_geo, async_db):
    """Simule un redemarrage : cache memoire vide, cache base rempli."""
    await async_db.geo_cache.insert_one({"_id": _cle(VILLE_INCONNUE), "lat": 47.5, "lon": 1.5})
    server.city_coords_cache.clear()

    await server.preload_city_coords([{"ville": VILLE_INCONNUE}])

    assert fake_geo.call_count() == 0, "le cache persistant n'a pas ete utilise"
    assert server.city_coords_cache[_cle(VILLE_INCONNUE)] == (47.5, 1.5)


async def test_preload_ne_persiste_pas_les_echecs(fake_geo, async_db):
    await server.preload_city_coords([{"ville": VILLE_INCONNUE}])
    assert await async_db.geo_cache.find_one({"_id": _cle(VILLE_INCONNUE)}) is None


async def test_preload_deux_fois_ne_duplique_pas_en_base(fake_geo, async_db):
    fake_geo.set_city(VILLE_INCONNUE, lat=47.5, lon=1.5)
    await server.preload_city_coords([{"ville": VILLE_INCONNUE}])
    server.city_coords_cache.clear()
    await server.preload_city_coords([{"ville": VILLE_INCONNUE}])

    assert await async_db.geo_cache.count_documents({"_id": _cle(VILLE_INCONNUE)}) == 1


# --------------------------------------------------------------------------- #
# Client HTTP partage
# --------------------------------------------------------------------------- #
async def test_client_http_reutilise():
    """Un seul client pour tout le geocodage, au lieu d'un par appel."""
    server._geo_http_client = None
    premier = await server.get_geo_http_client()
    second = await server.get_geo_http_client()
    try:
        assert premier is second
    finally:
        await premier.aclose()
        server._geo_http_client = None


async def test_client_http_recree_si_ferme():
    server._geo_http_client = None
    premier = await server.get_geo_http_client()
    await premier.aclose()
    second = await server.get_geo_http_client()
    try:
        assert second is not premier
        assert not second.is_closed
    finally:
        await second.aclose()
        server._geo_http_client = None


async def test_client_http_a_un_timeout():
    """Sans timeout, une API muette bloquerait la requete indefiniment."""
    server._geo_http_client = None
    http_client = await server.get_geo_http_client()
    try:
        assert http_client.timeout.read is not None
    finally:
        await http_client.aclose()
        server._geo_http_client = None
