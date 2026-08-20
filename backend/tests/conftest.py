"""Harnais de test du backend RecruitHub / 111MATCHING.

Un mongod ephemere est demarre pour la session sur un port libre, avec un dbpath
temporaire : la base de travail (/data/db, match_db) n'est jamais touchee.

Si mongod est introuvable, seuls les tests unitaires purs s'executent, les tests
qui ont besoin de la base sont marques skip.
"""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


MONGO_PORT = _free_port()
MONGO_URL = f"mongodb://127.0.0.1:{MONGO_PORT}"
DB_NAME = "recruithub_test_suite"

# Doit etre pose AVANT l'import de server : le module lit os.environ au chargement.
# Le JWT_SECRET est volontairement long et non devinable pour que
# _load_or_create_jwt_secret() n'aille jamais reecrire le vrai backend/.env.
os.environ["MONGO_URL"] = MONGO_URL
os.environ["DB_NAME"] = DB_NAME
os.environ["JWT_SECRET"] = "jwt-secret-de-test-suffisamment-long-pour-etre-accepte-0123456789"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

import server  # noqa: E402

MONGOD_BIN = shutil.which("mongod")
COLLECTIONS = ("users", "candidats", "postes", "process", "rejected_matches", "geo_cache")


# --------------------------------------------------------------------------- #
# Infrastructure
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def mongo_server():
    """Demarre un mongod jetable pour la session."""
    if MONGOD_BIN is None:
        pytest.skip("mongod introuvable : tests base de donnees ignores")

    dbpath = tempfile.mkdtemp(prefix="recruithub-tests-")
    logpath = os.path.join(dbpath, "mongod.log")
    proc = subprocess.Popen(
        [
            MONGOD_BIN,
            "--dbpath", dbpath,
            "--port", str(MONGO_PORT),
            "--nounixsocket",          # le chemin de socket depasse la limite systeme
            "--logpath", logpath,
            "--setParameter", "enableTestCommands=1",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    import pymongo

    deadline = time.time() + 40
    while time.time() < deadline:
        if proc.poll() is not None:
            shutil.rmtree(dbpath, ignore_errors=True)
            pytest.skip(f"mongod n'a pas demarre (code {proc.returncode})")
        try:
            pymongo.MongoClient(MONGO_URL, serverSelectionTimeoutMS=400).admin.command("ping")
            break
        except Exception:
            time.sleep(0.25)
    else:
        proc.kill()
        shutil.rmtree(dbpath, ignore_errors=True)
        pytest.skip("mongod n'a pas repondu dans le delai imparti")

    yield MONGO_URL

    proc.terminate()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        proc.kill()
    shutil.rmtree(dbpath, ignore_errors=True)


@pytest.fixture(scope="session")
def sync_db(mongo_server):
    """Acces synchrone a la base de test (fixtures et assertions directes)."""
    import pymongo

    client = pymongo.MongoClient(mongo_server)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def client(mongo_server):
    """TestClient unique pour la session.

    Portee session volontaire : le client motor de server.py se lie a la boucle
    d'evenements du TestClient. En recreer un par test lierait motor a une boucle
    morte. L'isolation entre tests est assuree par la fixture reset_db.
    """
    from fastapi.testclient import TestClient

    with TestClient(server.app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def reset_state(request):
    """Vide les collections et les caches memoire avant chaque test.

    delete_many plutot que drop : les index crees au demarrage sont conserves.
    """
    import asyncio

    server.city_coords_cache.clear()
    server._geo_failures.clear()
    # Un Semaphore/Lock asyncio se lie a la premiere boucle qui l'utilise. Les tests
    # async tournent dans une boucle differente de celle du TestClient : on repart
    # de primitives neuves a chaque test pour eviter "bound to a different loop".
    server._geo_semaphore = asyncio.Semaphore(10)
    server._geo_client_lock = asyncio.Lock()

    if "mongo_server" in request.fixturenames or "sync_db" in request.fixturenames \
            or "client" in request.fixturenames:
        try:
            db = request.getfixturevalue("sync_db")
        except Exception:
            return
        for name in COLLECTIONS:
            db[name].delete_many({})
    yield


# --------------------------------------------------------------------------- #
# Authentification
# --------------------------------------------------------------------------- #
ADMIN_EMAIL = "admin@recruithub.fr"
ADMIN_PASSWORD = "admin123"


@pytest.fixture
def admin_user(sync_db):
    """Cree l'utilisateur de test et retourne son document."""
    doc = {
        "id": str(uuid.uuid4()),
        "email": ADMIN_EMAIL,
        "password_hash": server.hash_password(ADMIN_PASSWORD),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    sync_db.users.insert_one(dict(doc))
    return doc


@pytest.fixture
def token(client, admin_user):
    resp = client.post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def auth(token):
    """En-tetes d'authentification prets a l'emploi."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def api(client, auth):
    """Petit wrapper : appels authentifies sans repeter les en-tetes."""

    class Api:
        def get(self, path, **kw):
            return client.get(path, headers=auth, **kw)

        def post(self, path, **kw):
            return client.post(path, headers=auth, **kw)

        def put(self, path, **kw):
            return client.put(path, headers=auth, **kw)

        def delete(self, path, **kw):
            return client.delete(path, headers=auth, **kw)

    return Api()


# --------------------------------------------------------------------------- #
# Fabriques de donnees
# --------------------------------------------------------------------------- #
@pytest.fixture
def make_candidat(api):
    """Cree un candidat via l'API et retourne le corps de reponse."""

    def _make(**overrides):
        payload = {
            "nom": "Dupont",
            "prenom": "Alice",
            "ville": "Paris",
            "titre_poste": "Developpeur Python",
            "rayon_km": 30,
        }
        payload.update(overrides)
        resp = api.post("/api/candidats", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    return _make


@pytest.fixture
def make_poste(api):
    """Cree un poste via l'API et retourne le corps de reponse."""

    def _make(**overrides):
        payload = {
            "entreprise": "TechCorp",
            "titre_poste": "Developpeur Python",
            "ville": "Paris",
            "convention_signee": True,
        }
        payload.update(overrides)
        resp = api.post("/api/postes", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    return _make


@pytest.fixture
def make_process(api):
    def _make(candidat_id, poste_id, **overrides):
        payload = {"candidat_id": candidat_id, "poste_id": poste_id}
        payload.update(overrides)
        resp = api.post("/api/process", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    return _make


@pytest.fixture
def expired_token(admin_user):
    """Token structurellement valide mais expire."""
    import jwt

    payload = {
        "user_id": admin_user["id"],
        "email": admin_user["email"],
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    return jwt.encode(payload, server.JWT_SECRET, algorithm=server.JWT_ALGORITHM)


@pytest.fixture
def foreign_token(admin_user):
    """Token signe avec un autre secret : doit etre rejete."""
    import jwt

    payload = {
        "user_id": admin_user["id"],
        "email": admin_user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, "un-autre-secret-totalement-different", algorithm="HS256")


# --------------------------------------------------------------------------- #
# Support asynchrone (plugin anyio, pas de pytest-asyncio requis)
# --------------------------------------------------------------------------- #
@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def async_db(mongo_server):
    """Client motor lie a la boucle du test en cours, injecte dans server.db.

    Les tests async tournent dans une autre boucle que le TestClient : reutiliser
    le client motor du module leverait une erreur de boucle.
    """
    from motor.motor_asyncio import AsyncIOMotorClient

    local_client = AsyncIOMotorClient(mongo_server)
    original = server.db
    server.db = local_client[DB_NAME]
    yield server.db
    server.db = original
    local_client.close()


class FakeGeoResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {"features": []}

    def json(self):
        return self._payload


class FakeGeoClient:
    """Remplace le client httpx partage : enregistre les appels, ne sort pas du process."""

    is_closed = False

    def __init__(self):
        self.calls = []
        self.responses = {}
        self.default = FakeGeoResponse(200, {"features": []})
        self.raise_on = set()

    def set_city(self, query_fragment, lat, lon):
        """Fait repondre l'API avec ces coordonnees quand la requete contient le fragment."""
        self.responses[query_fragment.lower()] = FakeGeoResponse(
            200,
            # L'API Adresse renvoie [longitude, latitude] : on teste l'inversion.
            {"features": [{"geometry": {"coordinates": [lon, lat]}}]},
        )

    async def get(self, url, params=None, **kwargs):
        query = (params or {}).get("q", "")
        self.calls.append(query)
        low = query.lower()
        for fragment in self.raise_on:
            if fragment in low:
                raise RuntimeError("panne simulee de l'API Adresse")
        for fragment, response in self.responses.items():
            if fragment in low:
                return response
        return self.default

    def call_count(self, fragment=None):
        if fragment is None:
            return len(self.calls)
        return sum(1 for c in self.calls if fragment.lower() in c.lower())


@pytest.fixture
def fake_geo(monkeypatch):
    """Installe un faux client de geocodage : aucun appel reseau reel en test."""
    fake = FakeGeoClient()
    monkeypatch.setattr(server, "_geo_http_client", fake)
    server.city_coords_cache.clear()
    server._geo_failures.clear()
    yield fake
    server.city_coords_cache.clear()
    server._geo_failures.clear()
