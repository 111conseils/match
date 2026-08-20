"""Tests de securite : gestion du secret JWT."""
import jwt
import pytest

import server


def test_secret_actif_non_devinable():
    assert server.JWT_SECRET not in server.INSECURE_JWT_SECRETS
    assert len(server.JWT_SECRET) >= 32


def test_ancien_secret_public_reference_comme_interdit():
    """Le secret livre par defaut ne doit plus jamais etre accepte."""
    assert "recruithub-secret-key-change-in-production" in server.INSECURE_JWT_SECRETS


def _charger(monkeypatch, tmp_path, valeur):
    """Execute _load_or_create_jwt_secret dans un repertoire isole."""
    monkeypatch.setattr(server, "ROOT_DIR", tmp_path)
    if valeur is None:
        monkeypatch.delenv("JWT_SECRET", raising=False)
    else:
        monkeypatch.setenv("JWT_SECRET", valeur)
    return server._load_or_create_jwt_secret()


def test_secret_fort_existant_conserve(monkeypatch, tmp_path):
    fort = "un-secret-vraiment-long-et-aleatoire-0123456789abcdef"
    assert _charger(monkeypatch, tmp_path, fort) == fort
    assert not (tmp_path / ".env").exists(), "le .env ne doit pas etre reecrit inutilement"


@pytest.mark.parametrize("faible", [
    "recruithub-secret-key-change-in-production",
    "changeme",
    "secret",
    "trop-court",
    "",
])
def test_secret_faible_remplace(monkeypatch, tmp_path, faible):
    genere = _charger(monkeypatch, tmp_path, faible)
    assert genere != faible
    assert len(genere) >= 32
    assert genere not in server.INSECURE_JWT_SECRETS


def test_secret_absent_genere(monkeypatch, tmp_path):
    genere = _charger(monkeypatch, tmp_path, None)
    assert len(genere) >= 32


def test_secret_genere_ecrit_dans_env(monkeypatch, tmp_path):
    genere = _charger(monkeypatch, tmp_path, "changeme")
    contenu = (tmp_path / ".env").read_text()
    assert f"JWT_SECRET={genere}" in contenu


def test_secret_genere_remplace_l_ancienne_ligne(monkeypatch, tmp_path):
    """Une seule ligne JWT_SECRET doit subsister dans le .env."""
    (tmp_path / ".env").write_text(
        "MONGO_URL=mongodb://localhost:27017\n"
        "JWT_SECRET=changeme\n"
        "DB_NAME=match_db\n"
    )
    genere = _charger(monkeypatch, tmp_path, "changeme")

    lignes = (tmp_path / ".env").read_text().splitlines()
    secrets_ecrits = [ligne for ligne in lignes if ligne.startswith("JWT_SECRET=")]
    assert secrets_ecrits == [f"JWT_SECRET={genere}"]
    # les autres variables sont preservees
    assert "MONGO_URL=mongodb://localhost:27017" in lignes
    assert "DB_NAME=match_db" in lignes


def test_deux_generations_donnent_des_secrets_differents(monkeypatch, tmp_path):
    a = _charger(monkeypatch, tmp_path, "changeme")
    b = _charger(monkeypatch, tmp_path / "autre", "changeme")
    assert a != b


def test_env_non_ecrivable_ne_plante_pas(monkeypatch, tmp_path):
    """Si le .env ne peut pas etre ecrit, on continue avec un secret en memoire."""
    inexistant = tmp_path / "repertoire" / "absent"
    genere = _charger(monkeypatch, inexistant, "changeme")
    assert len(genere) >= 32


# --------------------------------------------------------------------------- #
# Consequences sur les jetons
# --------------------------------------------------------------------------- #
def test_jeton_force_avec_l_ancien_secret_rejete(client, admin_user):
    from datetime import datetime, timedelta, timezone

    forge = jwt.encode(
        {
            "user_id": admin_user["id"],
            "email": admin_user["email"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        "recruithub-secret-key-change-in-production",
        algorithm="HS256",
    )
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {forge}"})
    assert resp.status_code == 401


def test_jeton_sans_signature_rejete(client, admin_user):
    """Attaque classique alg=none."""
    from datetime import datetime, timedelta, timezone

    non_signe = jwt.encode(
        {
            "user_id": admin_user["id"],
            "email": admin_user["email"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        key="",
        algorithm="none",
    )
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {non_signe}"})
    assert resp.status_code == 401


def test_jeton_altere_rejete(client, token):
    """Modifier la charge utile invalide la signature."""
    tete, charge, signature = token.split(".")
    altere = f"{tete}.{charge[:-4]}AAAA.{signature}"
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {altere}"})
    assert resp.status_code == 401


def test_jeton_contient_une_expiration(token):
    charge = jwt.decode(token, server.JWT_SECRET, algorithms=[server.JWT_ALGORITHM])
    assert "exp" in charge
    assert charge["user_id"] and charge["email"]


def test_duree_de_vie_du_jeton_bornee():
    assert 0 < server.JWT_EXPIRATION_HOURS <= 24 * 7


def test_algorithme_symetrique_explicite():
    """L'algorithme est fixe : pas de negociation depuis le jeton."""
    assert server.JWT_ALGORITHM == "HS256"
