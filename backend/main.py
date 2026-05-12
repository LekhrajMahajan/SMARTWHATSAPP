from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json
import asyncio
import os
import functools

from excel_reader import read_contacts
from whatsapp_sender import send_messages

from database import db
from models import Contact, MessageLog, User
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer

import redis
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from dotenv import load_dotenv

load_dotenv()

# REDIS CONFIG
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
try:
    redis_client = redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    redis_client.ping()
    REDIS_AVAILABLE = True
except Exception as e:
    print(f"⚠️ Redis connection failed: {e}. Fallbacks will be used.")
    REDIS_AVAILABLE = False
    redis_client = None

# CREATE FASTAPI APP
app = FastAPI()

# ENABLE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    if REDIS_AVAILABLE:
        FastAPICache.init(RedisBackend(redis_client), prefix="fastapi-cache")

# MONGO DB COLLECTIONS
users_collection = db.users
contacts_collection = db.contacts
logs_collection = db.message_logs

@app.get("/")
async def root():
    return {"status": "ok", "message": "Smart WhatsApp Sender API is running"}

# AUTHENTICATION CONFIG
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is not set")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

# Helper functions for Redis-based Cooldown (Per-user with DB fallback)
def get_cooldown_until(username: str):
    # 1. Try Redis first
    if REDIS_AVAILABLE:
        try:
            val = redis_client.get(f"cooldown:{username}")
            if val:
                return datetime.fromisoformat(val)
        except:
            pass
    
    # 2. Fallback to MongoDB
    user = users_collection.find_one({"username": username})
    if user and user.get("cooldown_until"):
        return user["cooldown_until"]
    
    return None

def set_cooldown_until(username: str, dt: datetime):
    # 1. Update MongoDB (Main persistence)
    print(f"💾 SAVING COOLDOWN for {username} until {dt}")
    users_collection.update_one(
        {"username": username},
        {"$set": {"cooldown_until": dt}}
    )

    # 2. Update Redis (Performance)
    if REDIS_AVAILABLE:
        try:
            if dt:
                # Calculate expiration for Redis key using timezone-aware UTC
                now = datetime.now(timezone.utc)
                ttl = int((dt - now).total_seconds())
                if ttl > 0:
                    redis_client.setex(f"cooldown:{username}", ttl, dt.isoformat())
                else:
                    redis_client.delete(f"cooldown:{username}")
            else:
                redis_client.delete(f"cooldown:{username}")
        except:
            pass

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = users_collection.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user




# AUTH ROUTES
@app.post("/register")
async def register(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...)
):
    # Check if user exists
    user_exists = users_collection.find_one({"$or": [{"username": username}, {"email": email}]})
    if user_exists:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    new_user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(password)
    )
    users_collection.insert_one(new_user.model_dump())
    return {"message": "User registered successfully"}

@app.post("/token")
async def login(
    username: str = Form(...), # OAuth2 uses 'username' field for login (which is our email in the frontend)
    password: str = Form(...)
):
    user = users_collection.find_one({"$or": [{"username": username}, {"email": username}]})
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}


# WEBSOCKET CONNECTION MANAGER
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()


@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    # Validate token
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# HOME API
@app.get("/health")
def home():

    return {
        "message": "Smart WhatsApp Sender Backend Running"
    }


# DOWNLOAD SAMPLE CSV
@app.get("/download-sample")
def download_sample():

    return FileResponse(
        path="sample/sample_contacts.csv",
        filename="sample_contacts.csv",
        media_type="text/csv"
    )


# GET MESSAGE HISTORY
@app.get("/messages")
def get_messages(current_user: dict = Depends(get_current_user)):

    messages = logs_collection.find().sort("created_at", -1)

    data = []

    for msg in messages:

        data.append({
            "id": str(msg["_id"]),
            "name": msg["name"],
            "number": msg["number"],
            "message": msg["message"],
            "status": msg["status"],
            "created_at": str(msg["created_at"])
        })

    return data


# STATUS API
@app.get("/status")
async def get_status(current_user: dict = Depends(get_current_user)):
    from models import is_within_ist_window, get_ist_time
    
    # Calculate remaining cooldown seconds using robust UTC comparison
    now = datetime.now(timezone.utc)
    remaining_cooldown = 0
    cooldown_until = get_cooldown_until(current_user["username"])
    
    if cooldown_until:
        # Convert to aware if naive
        if cooldown_until.tzinfo is None:
            cooldown_until = cooldown_until.replace(tzinfo=timezone.utc)
        
        if cooldown_until > now:
            remaining_cooldown = int((cooldown_until - now).total_seconds())
    
    # Get daily count (Cache this for 30 seconds to reduce DB load)
    # We use a custom cache key or just manual redis check
    ist_now = get_ist_time()
    cache_key = f"sent_today_{ist_now.strftime('%Y-%m-%d')}"
    sent_today = None
    
    if REDIS_AVAILABLE:
        try:
            sent_today = redis_client.get(cache_key)
        except:
            pass
    
    if sent_today is None:
        today_start = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
        sent_today = logs_collection.count_documents({
            "status": "Sent",
            "created_at": {"$gte": today_start}
        })
        if REDIS_AVAILABLE:
            try:
                redis_client.setex(cache_key, 30, str(sent_today))
            except:
                pass
    else:
        sent_today = int(sent_today)
    
    return {
        "remaining_cooldown": remaining_cooldown,
        "cooldown_until": str(cooldown_until) if cooldown_until else None,
        "sent_today": sent_today,
        "daily_limit": 800,
        "window_start": 10,
        "window_end": 18,
        "is_within_window": is_within_ist_window(10, 18)
    }


# CLEAR ALL MESSAGE LOGS


# UPLOAD EXCEL + SEND WHATSAPP MESSAGES
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    message: str = Form(...),
    current_user: dict = Depends(get_current_user)
):

    try:

        # READ CONTACTS
        contacts = read_contacts(file.file)

        print("TOTAL CONTACTS:", len(contacts))

        # SAVE CONTACTS
        contacts_to_insert = []
        for contact in contacts:

            new_contact = Contact(
                name=contact["name"],
                number=str(contact["number"])
            )

            contacts_to_insert.append(new_contact.model_dump())

        if contacts_to_insert:
            contacts_collection.insert_many(contacts_to_insert)

        # Capture the main event loop to use in the callback thread
        main_loop = asyncio.get_running_loop()

        # Define status callback for real-time updates
        def on_status_update(contact, status):
            
            try:
                log = MessageLog(
                    name=contact["name"],
                    number=str(contact["number"]),
                    message=message.replace(
                        "{name}",
                        contact["name"]
                    ),
                    status=status
                )
                
                # PyMongo is thread-safe, so we can use the main connection directly
                result = logs_collection.insert_one(log.model_dump())
                
                # Prepare data for WebSocket
                log_data = {
                    "id": str(result.inserted_id),
                    "name": log.name,
                    "number": log.number,
                    "message": log.message,
                    "status": log.status,
                    "created_at": str(log.created_at)
                }
                
                # Broadcast via the main event loop
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({"type": "LOG_UPDATE", "data": log_data}),
                    main_loop
                )
            except Exception as e:
                print(f"Error in status callback: {e}")

        # Run blocking send_messages in a separate thread
        loop = asyncio.get_running_loop()
        # Define broadcast helper for the sender thread
        def broadcast_wrapper(message):
            if message["type"] == "COOLDOWN_START":
                seconds = message["data"]["seconds"]
                new_cooldown = datetime.now(timezone.utc) + timedelta(seconds=seconds)
                set_cooldown_until(current_user["username"], new_cooldown)
            
            asyncio.run_coroutine_threadsafe(
                manager.broadcast(message),
                main_loop
            )

        # Broadcast that the process has started
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "PROCESS_STARTED", "data": {}}),
            main_loop
        )

        # Run blocking send_messages in a separate thread
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None, 
            functools.partial(
                send_messages,
                contacts,
                message,
                on_status=on_status_update,
                logs_collection=logs_collection,
                broadcast_func=broadcast_wrapper
            )
        )

        status_msg = "Campaign processed"
        if results["status"] == "login_failed":
            status_msg = "WhatsApp login failed or timed out"
        elif results["status"] == "daily_limit_reached":
            status_msg = "Daily limit of 800 reached"
        elif results["status"] == "window_closed":
            status_msg = "Process paused: window closed"

        return {
            "success": results["status"] == "completed",
            "contacts": results["sent_count"],
            "failed": results["failed_count"],
            "total": results["total_attempted"],
            "status": results["status"],
            "message": status_msg
        }

    except Exception as e:

        print("ERROR:", e)

        return {
            "success": False,
            "contacts": 0,
            "message": str(e)
        }

# --- PRODUCTION STATIC FILE SERVING ---
# Resolve frontend build path
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
    # API routes are already defined above, so "/" mount will catch everything else
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    
    # Catch-all for React Router navigation (404s in static files)
    @app.exception_handler(404)
    async def spa_handler(request, __):
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    print(f"⚠️ Warning: Frontend dist folder not found at {frontend_dist}. UI will not be served.")