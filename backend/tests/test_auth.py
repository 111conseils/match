"""Tests d'authentification : login, jetons, endpoints proteges."""
import pytest

from conftest import ADMIN_EMAIL, ADMIN_PASSWORD


def test_login_retourne_un_jeton_et_l_utilisateur(client, admin_user):
    resp = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"] == {"id": admin_user["id"], "email": ADMIN_EMAIL}


def test_login_ne_renvoie_jamais_le_hash(client, admin_user):
    body = client.post(
        "/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    ).json()
    assert "password_hash" not in body["user"]
    assert "password" not in body["user"]


def test_login_mauvais_mot_de_passe(client, admin_user):
    resp = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "mauvais"})
    assert resp.status_code == 401


def test_login_email_inconnu(client, admin_user):
    resp = client.post("/api/auth/login", json={"email": "personne@nulle.part", "password": "x"})
    assert resp.status_code == 401


def test_login_message_identique_pour_email_et_mot_de_passe(client, admin_user):
    """Ne pas reveler si l'email existe."""
    r1 = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "mauvais"})
    r2 = client.post("/api/auth/login", json={"email": "inconnu@x.fr", "password": "mauvais"})
    assert r1.json()["detail"] == r2.json()["detail"]


def test_login_champ_manquant(client):
    assert client.post("/api/auth/login", json={"email": ADMIN_EMAIL}).status_code == 422


def test_mot_de_passe_verifie_par_bcrypt(admin_user):
    import server

    assert server.verify_password(ADMIN_PASSWORD, admin_user["password_hash"])
    assert not server.verify_password("mauvais", admin_user["password_hash"])


def test_hash_different_a_chaque_fois():
    """Le sel bcrypt doit rendre deux hash du meme mot de passe differents."""
    import server

    assert server.hash_password("motdepasse") != server.hash_password("motdepasse")


# --------------------------------------------------------------------------- #
# Inscription desactivee (application privee, mono-administrateur)
# --------------------------------------------------------------------------- #
def test_inscription_toujours_refusee(client):
    resp = client.post("/api/auth/register", json={"email": "nouveau@x.fr", "password": "abc12345"})
    assert resp.status_code == 403


def test_inscription_refusee_meme_authentifie(client, auth):
    resp = client.post(
        "/api/auth/register", json={"email": "nouveau@x.fr", "password": "abc12345"}, headers=auth
    )
    assert resp.status_code == 403


def test_inscription_ne_cree_aucun_utilisateur(client, sync_db):
    avant = sync_db.users.count_documents({})
    client.post("/api/auth/register", json={"email": "nouveau@x.fr", "password": "abc12345"})
    assert sync_db.users.count_documents({}) == avant


# --------------------------------------------------------------------------- #
# /auth/me et validation des jetons
# --------------------------------------------------------------------------- #
def test_me_avec_jeton_valide(client, auth, admin_user):
    resp = client.get("/api/auth/me", headers=auth)
    assert resp.status_code == 200
    assert resp.json() == {"id": admin_user["id"], "email": ADMIN_EMAIL}


def test_me_sans_jeton(client):
    assert client.get("/api/auth/me").status_code == 403


def test_me_jeton_malforme(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer pas-un-jwt"})
    assert resp.status_code == 401


def test_me_jeton_expire(client, expired_token):
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    assert "expir" in resp.json()["detail"].lower()


def test_me_jeton_signe_avec_un_autre_secret(client, foreign_token):
    """Un jeton force avec l'ancien secret public doit etre rejete."""
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {foreign_token}"})
    assert resp.status_code == 401


def test_me_schema_authorization_invalide(client, token):
    resp = client.get("/api/auth/me", headers={"Authorization": f"Basic {token}"})
    assert resp.status_code == 403


# --------------------------------------------------------------------------- #
# Toutes les routes metier sont protegees
# --------------------------------------------------------------------------- #
ROUTES_PROTEGEES = [
    ("get", "/api/candidats"),
    ("get", "/api/candidats/quelconque"),
    ("post", "/api/candidats"),
    ("get", "/api/postes"),
    ("post", "/api/postes"),
    ("get", "/api/process"),
    ("post", "/api/process"),
    ("get", "/api/matching"),
    ("get", "/api/matching/quelconque"),
    ("get", "/api/matching/candidat/quelconque"),
    ("get", "/api/rejected-matches"),
    ("post", "/api/rejected-matches"),
    ("get", "/api/stats"),
    ("get", "/api/stats/sources"),
    ("get", "/api/export/candidats"),
    ("get", "/api/export/postes"),
    ("get", "/api/export/process"),
]


def _appel(client, methode, chemin, headers=None):
    kwargs = {"headers": headers} if headers else {}
    if methode == "post":
        kwargs["json"] = {}
    return client.request(methode.upper(), chemin, **kwargs)


@pytest.mark.parametrize("methode,chemin", ROUTES_PROTEGEES)
def test_route_refuse_l_anonyme(client, methode, chemin):
    resp = _appel(client, methode, chemin)
    assert resp.status_code in (401, 403), f"{methode.upper()} {chemin} accessible sans jeton"


@pytest.mark.parametrize("methode,chemin", ROUTES_PROTEGEES)
def test_route_refuse_un_jeton_invalide(client, methode, chemin):
    resp = _appel(client, methode, chemin, headers={"Authorization": "Bearer jeton-bidon"})
    assert resp.status_code in (401, 403)


def test_config_statuts_est_public(client):
    """Seule route volontairement ouverte : la liste des statuts."""
    resp = client.get("/api/config/statuts")
    assert resp.status_code == 200
    assert "statuts" in resp.json() and "sources" in resp.json()


def test_config_statuts_contient_tous_les_codes(client):
    codes = {s["code"] for s in client.get("/api/config/statuts").json()["statuts"]}
    import server

    assert codes == set(server.STATUTS_CANDIDAT)
