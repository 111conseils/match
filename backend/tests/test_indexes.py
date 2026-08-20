"""Verifie que les index Mongo sont crees au demarrage.

Sans eux, chaque lecture fait un scan complet de collection : les recherches
portent sur le champ applicatif `id` (UUID), pas sur `_id`.
"""
import uuid
from datetime import datetime, timezone

import pymongo
import pytest

# (collection, cles indexees, unique attendu)
INDEX_ATTENDUS = [
    ("users", [("email", 1)], True),
    ("candidats", [("id", 1)], True),
    ("candidats", [("is_archived", 1), ("created_at", -1)], False),
    ("postes", [("id", 1)], True),
    ("postes", [("created_at", -1)], False),
    ("process", [("id", 1)], True),
    ("process", [("candidat_id", 1), ("poste_id", 1)], True),
    ("process", [("updated_at", -1)], False),
    ("rejected_matches", [("candidat_id", 1), ("poste_id", 1)], True),
    ("rejected_matches", [("poste_id", 1)], False),
]


def _index_de(db, collection):
    """{cles: unique} pour tous les index d'une collection, hors _id."""
    resultat = {}
    for info in db[collection].list_indexes():
        cles = tuple((champ, direction) for champ, direction in info["key"].items())
        if cles == (("_id", 1),):
            continue
        resultat[cles] = bool(info.get("unique", False))
    return resultat


@pytest.mark.parametrize("collection,cles,unique", INDEX_ATTENDUS)
def test_index_present(client, sync_db, collection, cles, unique):
    index = _index_de(sync_db, collection)
    attendu = tuple(cles)
    assert attendu in index, f"index {attendu} absent de {collection} (presents: {list(index)})"
    assert index[attendu] is unique, f"unicite incorrecte pour {attendu} sur {collection}"


def test_recherche_par_id_utilise_un_index(client, sync_db, api, make_candidat):
    """Le plan d'execution ne doit plus etre un scan complet (COLLSCAN)."""
    candidat = make_candidat()
    plan = sync_db.command("explain", {
        "find": "candidats", "filter": {"id": candidat["id"]}
    }, verbosity="queryPlanner")

    etape = plan["queryPlanner"]["winningPlan"]
    resume = str(etape)
    assert "IXSCAN" in resume, f"la recherche par id fait encore un COLLSCAN : {resume}"


def test_email_unique(client, sync_db, admin_user):
    with pytest.raises(pymongo.errors.DuplicateKeyError):
        sync_db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_user["email"],
            "password_hash": "peu importe",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


def test_id_candidat_unique(client, sync_db, api, make_candidat):
    candidat = make_candidat()
    with pytest.raises(pymongo.errors.DuplicateKeyError):
        sync_db.candidats.insert_one({
            "id": candidat["id"], "nom": "Doublon", "prenom": "P", "ville": "Paris",
            "titre_poste": "Dev", "rayon_km": 30, "is_archived": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


def test_id_poste_unique(client, sync_db, api, make_poste):
    poste = make_poste()
    with pytest.raises(pymongo.errors.DuplicateKeyError):
        sync_db.postes.insert_one({
            "id": poste["id"], "entreprise": "Doublon", "titre_poste": "Dev",
            "ville": "Paris", "convention_signee": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


def test_creation_index_idempotente(client, sync_db):
    """Relancer la creation ne doit pas echouer ni dupliquer d'index."""
    import asyncio

    avant = {c: len(_index_de(sync_db, c)) for c, _, _ in INDEX_ATTENDUS}
    asyncio.run(_recreer())
    apres = {c: len(_index_de(sync_db, c)) for c, _, _ in INDEX_ATTENDUS}
    assert avant == apres


async def _recreer():
    """Rejoue create_indexes avec un client motor lie a la boucle courante."""
    from motor.motor_asyncio import AsyncIOMotorClient

    import server
    from conftest import DB_NAME, MONGO_URL

    local = AsyncIOMotorClient(MONGO_URL)
    original = server.db
    server.db = local[DB_NAME]
    try:
        await server.create_indexes()
    finally:
        server.db = original
        local.close()


def test_demarrage_resiste_aux_doublons_existants(sync_db, client):
    """Un index unique impossible a creer ne doit pas empecher le demarrage.

    On insere deux rejets identiques en contournant l'index, puis on rejoue la
    creation : elle doit se terminer sans lever.
    """
    import asyncio

    sync_db.rejected_matches.drop_index("uniq_candidat_poste")
    now = datetime.now(timezone.utc).isoformat()
    sync_db.rejected_matches.insert_many([
        {"id": str(uuid.uuid4()), "candidat_id": "c1", "poste_id": "p1", "created_at": now},
        {"id": str(uuid.uuid4()), "candidat_id": "c1", "poste_id": "p1", "created_at": now},
    ])

    asyncio.run(_recreer())  # ne doit pas lever

    # On nettoie et on remet l'index en place pour les tests suivants
    sync_db.rejected_matches.delete_many({})
    asyncio.run(_recreer())
    assert (("candidat_id", 1), ("poste_id", 1)) in _index_de(sync_db, "rejected_matches")
