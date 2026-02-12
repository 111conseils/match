from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'recruithub-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============ MODELS ============

class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Statuts possibles pour un candidat
STATUTS_CANDIDAT = ["NOUVEAU", "ENCV", "ENTC", "PROPALE", "PCLT", "REFUS", "NOGO_DISPO"]
SOURCES_CANDIDAT = [
    "Hellowork candidature",
    "Hellowork cvtech", 
    "Indeed",
    "LinkedIn",
    "Site 111 conseils",
    "Cooptation"
]

# Candidat Models
class CandidatCreate(BaseModel):
    nom: str
    prenom: str
    ville: str
    rayon_km: int = 30
    titre_poste: str
    remuneration: Optional[str] = None
    disponibilite: Optional[str] = None
    statut: str = "NOUVEAU"
    honoraire: Optional[float] = None
    source: Optional[str] = None

class CandidatUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    ville: Optional[str] = None
    rayon_km: Optional[int] = None
    titre_poste: Optional[str] = None
    remuneration: Optional[str] = None
    disponibilite: Optional[str] = None
    statut: Optional[str] = None
    honoraire: Optional[float] = None
    source: Optional[str] = None

class Candidat(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    prenom: str
    ville: str
    rayon_km: int = 30
    titre_poste: str
    remuneration: Optional[str] = None
    disponibilite: Optional[str] = None
    statut: str = "NOUVEAU"
    honoraire: Optional[float] = None
    source: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Poste Models
class PosteCreate(BaseModel):
    entreprise: str
    titre_poste: str
    ville: str

class PosteUpdate(BaseModel):
    entreprise: Optional[str] = None
    titre_poste: Optional[str] = None
    ville: Optional[str] = None

class Poste(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entreprise: str
    titre_poste: str
    ville: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Match Model
class Match(BaseModel):
    candidat: Candidat
    poste_id: str
    score: int
    titre_match: bool
    zone_match: bool

# ============ FRENCH CITIES COORDINATES ============

FRENCH_CITIES = {
    "paris": (48.8566, 2.3522),
    "marseille": (43.2965, 5.3698),
    "lyon": (45.7640, 4.8357),
    "toulouse": (43.6047, 1.4442),
    "nice": (43.7102, 7.2620),
    "nantes": (47.2184, -1.5536),
    "strasbourg": (48.5734, 7.7521),
    "montpellier": (43.6108, 3.8767),
    "bordeaux": (44.8378, -0.5792),
    "lille": (50.6292, 3.0573),
    "rennes": (48.1173, -1.6778),
    "reims": (49.2583, 4.0317),
    "saint-etienne": (45.4397, 4.3872),
    "toulon": (43.1242, 5.9280),
    "le havre": (49.4944, 0.1079),
    "grenoble": (45.1885, 5.7245),
    "dijon": (47.3220, 5.0415),
    "angers": (47.4784, -0.5632),
    "nimes": (43.8367, 4.3601),
    "villeurbanne": (45.7676, 4.8798),
    "clermont-ferrand": (45.7772, 3.0870),
    "le mans": (48.0061, 0.1996),
    "aix-en-provence": (43.5297, 5.4474),
    "brest": (48.3904, -4.4861),
    "tours": (47.3941, 0.6848),
    "amiens": (49.8941, 2.2958),
    "limoges": (45.8336, 1.2611),
    "perpignan": (42.6986, 2.8954),
    "besancon": (47.2378, 6.0241),
    "orleans": (47.9029, 1.9093),
    "metz": (49.1193, 6.1757),
    "rouen": (49.4432, 1.0993),
    "mulhouse": (47.7508, 7.3359),
    "caen": (49.1829, -0.3707),
    "nancy": (48.6921, 6.1844),
    "argenteuil": (48.9472, 2.2467),
    "saint-denis": (48.9362, 2.3574),
    "roubaix": (50.6942, 3.1746),
    "tourcoing": (50.7262, 3.1612),
    "montreuil": (48.8638, 2.4483),
    "avignon": (43.9493, 4.8055),
    "dunkerque": (51.0343, 2.3768),
    "poitiers": (46.5802, 0.3404),
    "versailles": (48.8014, 2.1301),
    "courbevoie": (48.8966, 2.2526),
    "creteil": (48.7909, 2.4551),
    "pau": (43.2951, -0.3708),
    "la rochelle": (46.1603, -1.1511),
    "cannes": (43.5528, 7.0174),
    "antibes": (43.5808, 7.1238)
}

def get_city_coords(city_name: str) -> Optional[tuple]:
    """Get coordinates for a city name"""
    normalized = city_name.lower().strip()
    if normalized in FRENCH_CITIES:
        return FRENCH_CITIES[normalized]
    # Try partial match
    for city, coords in FRENCH_CITIES.items():
        if normalized in city or city in normalized:
            return coords
    return None

def calculate_distance_km(coord1: tuple, coord2: tuple) -> float:
    """Calculate distance between two coordinates using Haversine formula"""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def normalize_title(title: str) -> str:
    """Normalize job title for comparison"""
    return title.lower().strip()

def titles_match(title1: str, title2: str) -> bool:
    """Check if two job titles match (fuzzy)"""
    t1 = normalize_title(title1)
    t2 = normalize_title(title2)
    # Exact match or one contains the other
    return t1 == t2 or t1 in t2 or t2 in t1

def calculate_match_score(candidat: dict, poste: dict) -> dict:
    """Calculate matching score between a candidate and a job position"""
    score = 0
    titre_match = False
    zone_match = False
    
    # Title matching (50% weight)
    if titles_match(candidat['titre_poste'], poste['titre_poste']):
        score += 50
        titre_match = True
    
    # Geographic matching (50% weight)
    candidat_coords = get_city_coords(candidat['ville'])
    poste_coords = get_city_coords(poste['ville'])
    
    if candidat_coords and poste_coords:
        distance = calculate_distance_km(candidat_coords, poste_coords)
        rayon = candidat['rayon_km']
        
        if distance <= rayon:
            # Full score if within radius
            zone_match = True
            # Score decreases linearly with distance
            zone_score = max(0, 50 * (1 - distance / rayon))
            score += zone_score
    elif candidat['ville'].lower().strip() == poste['ville'].lower().strip():
        # Same city name
        score += 50
        zone_match = True
    
    return {
        'score': int(score),
        'titre_match': titre_match,
        'zone_match': zone_match
    }

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Token invalide")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user.email)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=user.email)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user: UserLogin):
    user_doc = await db.users.find_one({"email": user.email}, {"_id": 0})
    if not user_doc or not verify_password(user.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    token = create_token(user_doc['id'], user_doc['email'])
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_doc['id'], email=user_doc['email'])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(id=current_user['user_id'], email=current_user['email'])

# ============ CANDIDATS ROUTES ============

@api_router.get("/candidats", response_model=List[Candidat])
async def get_candidats(current_user: dict = Depends(get_current_user)):
    candidats = await db.candidats.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for c in candidats:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
    return candidats

@api_router.get("/candidats/{candidat_id}", response_model=Candidat)
async def get_candidat(candidat_id: str, current_user: dict = Depends(get_current_user)):
    candidat = await db.candidats.find_one({"id": candidat_id}, {"_id": 0})
    if not candidat:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    if isinstance(candidat.get('created_at'), str):
        candidat['created_at'] = datetime.fromisoformat(candidat['created_at'])
    return candidat

@api_router.post("/candidats", response_model=Candidat)
async def create_candidat(candidat: CandidatCreate, current_user: dict = Depends(get_current_user)):
    candidat_obj = Candidat(**candidat.model_dump())
    doc = candidat_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.candidats.insert_one(doc)
    return candidat_obj

@api_router.put("/candidats/{candidat_id}", response_model=Candidat)
async def update_candidat(candidat_id: str, candidat: CandidatUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.candidats.find_one({"id": candidat_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    
    update_data = {k: v for k, v in candidat.model_dump().items() if v is not None}
    if update_data:
        await db.candidats.update_one({"id": candidat_id}, {"$set": update_data})
    
    updated = await db.candidats.find_one({"id": candidat_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/candidats/{candidat_id}")
async def delete_candidat(candidat_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.candidats.delete_one({"id": candidat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Candidat non trouvé")
    return {"message": "Candidat supprimé"}

# ============ POSTES ROUTES ============

@api_router.get("/postes", response_model=List[Poste])
async def get_postes(current_user: dict = Depends(get_current_user)):
    postes = await db.postes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for p in postes:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return postes

@api_router.get("/postes/{poste_id}", response_model=Poste)
async def get_poste(poste_id: str, current_user: dict = Depends(get_current_user)):
    poste = await db.postes.find_one({"id": poste_id}, {"_id": 0})
    if not poste:
        raise HTTPException(status_code=404, detail="Poste non trouvé")
    if isinstance(poste.get('created_at'), str):
        poste['created_at'] = datetime.fromisoformat(poste['created_at'])
    return poste

@api_router.post("/postes", response_model=Poste)
async def create_poste(poste: PosteCreate, current_user: dict = Depends(get_current_user)):
    poste_obj = Poste(**poste.model_dump())
    doc = poste_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.postes.insert_one(doc)
    return poste_obj

@api_router.put("/postes/{poste_id}", response_model=Poste)
async def update_poste(poste_id: str, poste: PosteUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.postes.find_one({"id": poste_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Poste non trouvé")
    
    update_data = {k: v for k, v in poste.model_dump().items() if v is not None}
    if update_data:
        await db.postes.update_one({"id": poste_id}, {"$set": update_data})
    
    updated = await db.postes.find_one({"id": poste_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return updated

@api_router.delete("/postes/{poste_id}")
async def delete_poste(poste_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.postes.delete_one({"id": poste_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Poste non trouvé")
    return {"message": "Poste supprimé"}

# ============ MATCHING ROUTES ============

@api_router.get("/matching/{poste_id}", response_model=List[Match])
async def get_matches_for_poste(poste_id: str, current_user: dict = Depends(get_current_user)):
    poste = await db.postes.find_one({"id": poste_id}, {"_id": 0})
    if not poste:
        raise HTTPException(status_code=404, detail="Poste non trouvé")
    
    candidats = await db.candidats.find({}, {"_id": 0}).to_list(1000)
    matches = []
    
    for candidat in candidats:
        match_result = calculate_match_score(candidat, poste)
        if match_result['score'] > 0:
            if isinstance(candidat.get('created_at'), str):
                candidat['created_at'] = datetime.fromisoformat(candidat['created_at'])
            matches.append(Match(
                candidat=Candidat(**candidat),
                poste_id=poste_id,
                score=match_result['score'],
                titre_match=match_result['titre_match'],
                zone_match=match_result['zone_match']
            ))
    
    # Sort by score descending
    matches.sort(key=lambda x: x.score, reverse=True)
    return matches

@api_router.get("/matching", response_model=List[dict])
async def get_all_matches(current_user: dict = Depends(get_current_user)):
    """Get all matches grouped by poste"""
    postes = await db.postes.find({}, {"_id": 0}).to_list(1000)
    candidats = await db.candidats.find({}, {"_id": 0}).to_list(1000)
    
    all_matches = []
    for poste in postes:
        if isinstance(poste.get('created_at'), str):
            poste['created_at'] = datetime.fromisoformat(poste['created_at'])
        
        poste_matches = []
        for candidat in candidats:
            match_result = calculate_match_score(candidat, poste)
            if match_result['score'] > 0:
                if isinstance(candidat.get('created_at'), str):
                    candidat['created_at'] = datetime.fromisoformat(candidat['created_at'])
                poste_matches.append({
                    'candidat': candidat,
                    'score': match_result['score'],
                    'titre_match': match_result['titre_match'],
                    'zone_match': match_result['zone_match']
                })
        
        poste_matches.sort(key=lambda x: x['score'], reverse=True)
        all_matches.append({
            'poste': poste,
            'matches': poste_matches[:10],  # Top 10 matches per job
            'total_matches': len(poste_matches)
        })
    
    return all_matches

# ============ STATS ROUTES ============

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    total_candidats = await db.candidats.count_documents({})
    total_postes = await db.postes.count_documents({})
    
    # Calculate total matches
    postes = await db.postes.find({}, {"_id": 0}).to_list(1000)
    candidats = await db.candidats.find({}, {"_id": 0}).to_list(1000)
    
    total_matches = 0
    high_score_matches = 0
    for poste in postes:
        for candidat in candidats:
            match_result = calculate_match_score(candidat, poste)
            if match_result['score'] > 0:
                total_matches += 1
            if match_result['score'] >= 70:
                high_score_matches += 1
    
    # Stats par statut
    statuts_count = {}
    total_honoraires = 0
    for candidat in candidats:
        statut = candidat.get('statut', 'NOUVEAU')
        statuts_count[statut] = statuts_count.get(statut, 0) + 1
        if statut == 'PCLT' and candidat.get('honoraire'):
            total_honoraires += candidat['honoraire']
    
    return {
        "total_candidats": total_candidats,
        "total_postes": total_postes,
        "total_matches": total_matches,
        "high_score_matches": high_score_matches,
        "statuts_count": statuts_count,
        "total_honoraires": total_honoraires,
        "candidats_places": statuts_count.get('PCLT', 0)
    }

@api_router.get("/stats/sources")
async def get_sources_stats(current_user: dict = Depends(get_current_user)):
    """Statistiques par source de candidat"""
    candidats = await db.candidats.find({}, {"_id": 0}).to_list(1000)
    
    sources_stats = {}
    for source in SOURCES_CANDIDAT:
        sources_stats[source] = {
            "total": 0,
            "places": 0,
            "honoraires": 0
        }
    
    # Ajouter une catégorie "Non renseigné"
    sources_stats["Non renseigné"] = {"total": 0, "places": 0, "honoraires": 0}
    
    for candidat in candidats:
        source = candidat.get('source') or "Non renseigné"
        if source not in sources_stats:
            source = "Non renseigné"
        
        sources_stats[source]["total"] += 1
        if candidat.get('statut') == 'PCLT':
            sources_stats[source]["places"] += 1
            if candidat.get('honoraire'):
                sources_stats[source]["honoraires"] += candidat['honoraire']
    
    # Convertir en liste triée par honoraires
    result = [
        {"source": source, **stats}
        for source, stats in sources_stats.items()
        if stats["total"] > 0
    ]
    result.sort(key=lambda x: x["honoraires"], reverse=True)
    
    return result

@api_router.get("/config/statuts")
async def get_statuts():
    """Retourne la liste des statuts disponibles"""
    return {
        "statuts": [
            {"code": "NOUVEAU", "label": "Nouveau", "color": "gray"},
            {"code": "ENCV", "label": "Envoyé au client", "color": "blue"},
            {"code": "ENTC", "label": "Entretien client", "color": "purple"},
            {"code": "PROPALE", "label": "Sous proposition", "color": "orange"},
            {"code": "PCLT", "label": "Placé", "color": "green"},
            {"code": "REFUS", "label": "Refus propale", "color": "red"},
            {"code": "NOGO_DISPO", "label": "Plus disponible", "color": "gray"}
        ],
        "sources": SOURCES_CANDIDAT
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
