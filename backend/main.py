from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request, BackgroundTasks
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json
import asyncio
import os
import functools
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests

from excel_reader import read_contacts
from whatsapp_sender import send_messages

from database import db
from models import Contact, MessageLog, User
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

# Track active campaigns to prevent per-user concurrency issues
active_campaigns = set()

@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
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
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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


def send_verification_email(email: str, token: str, base_url: str = None):
    from dotenv import load_dotenv
    load_dotenv()
    
    # Use dynamically generated request URL if BACKEND_URL is not set or is the placeholder
    backend_url = os.getenv("BACKEND_URL")
    if not backend_url or "your-huggingface-space-url" in backend_url:
        backend_url = base_url or "http://localhost:7860"
        
    verify_url = f"{backend_url}/verify-email/{token}"
    
    # --- MAILTRAP HTTP API (SANDBOX TESTING) ---
    mailtrap_token = os.getenv("MAILTRAP_TOKEN")
    mailtrap_inbox_id = os.getenv("MAILTRAP_INBOX_ID")
    
    if not mailtrap_token or not mailtrap_inbox_id:
        print("CRITICAL ERROR: MAILTRAP_TOKEN or MAILTRAP_INBOX_ID is missing! Please add them to your .env or HuggingFace Secrets.")
        return
        
    url = f"https://sandbox.api.mailtrap.io/api/send/{mailtrap_inbox_id}"
    
    payload = {
        "to": [{"email": email}],
        "from": {"email": "noreply@smartwhatsapp.com", "name": "Smart WhatsApp Sender"},
        "subject": "Please verify your email address",
        "html": f"""
        <html>
          <body>
            <h2>Welcome to Smart WhatsApp Sender!</h2>
            <p>Please click the link below to verify your email address:</p>
            <a href="{verify_url}">Verify Email</a>
            <br><br>
            <p>Or paste this link into your browser:</p>
            <p>{verify_url}</p>
          </body>
        </html>
        """
    }
    
    headers = {
        "Authorization": f"Bearer {mailtrap_token}",
        "Content-Type": "application/json"
    }
    
    try:
        # Port 443 (HTTPS) is NEVER blocked by HuggingFace!
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        if response.status_code in [200, 202]:
            print(f"✅ Verification email sent to {email} via Mailtrap Dashboard")
        else:
            print(f"❌ Failed to send email via Mailtrap. Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"❌ Network Error calling Mailtrap API: {e}")

# AUTH ROUTES
@app.post("/register")
async def register(
    request: Request,
    background_tasks: BackgroundTasks,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...)
):
    # Check if user exists
    user_exists = users_collection.find_one({"$or": [{"username": username}, {"email": email}]})
    if user_exists:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    token = secrets.token_urlsafe(32)
    new_user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(password),
        is_verified=False,
        verification_token=token
    )
    users_collection.insert_one(new_user.model_dump())
    
    # Dynamically capture the HuggingFace space URL to build the verification link
    base_url = str(request.base_url).rstrip("/")
    
    # Use background tasks so the frontend UI doesn't hang
    background_tasks.add_task(send_verification_email, email, token, base_url)
        
    return {"message": "Registration successful. Please check your email to verify your account."}

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
    
    # Treat existing users without the is_verified field as True (backward compatibility)
    if user.get("is_verified") is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified. Please check your inbox.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/verify-email/{token}", response_class=HTMLResponse)
async def verify_email(token: str):
    user = users_collection.find_one({"verification_token": token})
    if not user:
        return """
        <html><body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2 style="color:red;">Invalid or expired verification link.</h2>
        </body></html>
        """
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True, "verification_token": None}}
    )
    
    return """
    <html>
      <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2 style="color:green;">Email Verified Successfully! ✅</h2>
        <p>You can now return to the app and log in.</p>
        <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #25d366; color: white; border: none; border-radius: 5px;">Close Window</button>
      </body>
    </html>
    """


# WEBSOCKET CONNECTION MANAGER
class ConnectionManager:
    def __init__(self):
        # Map username -> list of active WebSockets
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        if username not in self.active_connections:
            self.active_connections[username] = []
        self.active_connections[username].append(websocket)

    def disconnect(self, websocket: WebSocket, username: str):
        if username in self.active_connections:
            if websocket in self.active_connections[username]:
                self.active_connections[username].remove(websocket)
            if not self.active_connections[username]:
                del self.active_connections[username]

    async def broadcast(self, message: dict, username: str = None):
        """Broadcasts to all connections if username is None, else only to that user."""
        if username:
            # Targeted broadcast
            connections = self.active_connections.get(username, [])
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass
        else:
            # Global broadcast
            for user_conns in self.active_connections.values():
                for connection in user_conns:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass

manager = ConnectionManager()


@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await websocket.accept()
    # Validate token
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            print(f"WS Error: No username in token")
            await websocket.close(code=1008)
            return
    except Exception as e:
        print(f"WS Auth Error: {e}")
        await websocket.close(code=1008)
        return

    # Once validated, manage the connection
    if username not in manager.active_connections:
        manager.active_connections[username] = []
    manager.active_connections[username].append(websocket)
    
    print(f"[{username}] WebSocket connected")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, username)


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

    messages = logs_collection.find({"username": current_user["username"]}).sort("created_at", -1)

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
    
    # Check subscription status
    is_subscribed = current_user.get("is_subscribed", False)
    subscription_plan = current_user.get("subscription_plan", None)
    subscription_expiry = current_user.get("subscription_expiry", None)
    
    # Auto check expiration
    if is_subscribed and subscription_expiry:
        expiry_dt = None
        if isinstance(subscription_expiry, str):
            try:
                expiry_dt = datetime.fromisoformat(subscription_expiry)
            except:
                pass
        elif isinstance(subscription_expiry, datetime):
            expiry_dt = subscription_expiry
            
        if expiry_dt:
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expiry_dt:
                is_subscribed = False
                users_collection.update_one(
                    {"username": current_user["username"]},
                    {"$set": {"is_subscribed": False}}
                )
                
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
    cache_key = f"sent_today_{current_user['username']}_{ist_now.strftime('%Y-%m-%d')}"
    sent_today = None
    
    if REDIS_AVAILABLE:
        try:
            sent_today = redis_client.get(cache_key)
        except:
            pass
    
    if sent_today is None:
        today_start = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
        sent_today = logs_collection.count_documents({
            "username": current_user["username"],
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
        "is_within_window": is_within_ist_window(10, 18),
        "is_subscribed": is_subscribed,
        "subscription_plan": subscription_plan,
        "subscription_expiry": str(subscription_expiry) if subscription_expiry else None
    }

# SUBSCRIBE API (PLAN ACTIVATION)
@app.post("/subscribe")
async def subscribe(request: Request, current_user: dict = Depends(get_current_user)):
    data = await request.json()
    plan = data.get("plan")
    
    if plan not in ["1_month", "3_months", "6_months"]:
        raise HTTPException(status_code=400, detail="Invalid subscription plan")
        
    days = 30
    if plan == "3_months":
        days = 90
    elif plan == "6_months":
        days = 180
        
    expiry = datetime.now(timezone.utc) + timedelta(days=days)
    
    users_collection.update_one(
        {"username": current_user["username"]},
        {
            "$set": {
                "is_subscribed": True,
                "subscription_plan": plan,
                "subscription_expiry": expiry
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Plan activated successfully!",
        "is_subscribed": True,
        "subscription_plan": plan,
        "subscription_expiry": str(expiry)
    }


# CLEAR ALL MESSAGE LOGS


# UPLOAD EXCEL + SEND WHATSAPP MESSAGES
@app.post("/upload")
@limiter.limit("5/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    message: str = Form(...),
    current_user: dict = Depends(get_current_user)
):

    # ENFORCE SUBSCRIPTION GATE
    if not current_user.get("is_subscribed", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active subscription required. Please choose a plan first."
        )

    # PREVENT CONCURRENT CAMPAIGNS FOR SAME USER
    username = current_user["username"]
    if username in active_campaigns:
        raise HTTPException(status_code=400, detail="A campaign is already running for your account. Please wait for it to finish.")

    try:
        # READ CONTACTS
        contacts = read_contacts(file.file)
        
        if not contacts:
            raise HTTPException(status_code=400, detail="No valid contacts found in the file.")

        print(f"[{username}] TOTAL CONTACTS:", len(contacts))

        # SAVE CONTACTS (Optional: Keep history of uploaded contacts)
        contacts_to_insert = []
        for contact in contacts:
            new_contact = Contact(
                username=username,
                name=contact["name"],
                number=str(contact["number"])
            )
            contacts_to_insert.append(new_contact.model_dump())

        if contacts_to_insert:
            contacts_collection.insert_many(contacts_to_insert)

        # Mark campaign as active
        active_campaigns.add(username)
        
        # Capture current event loop for thread-safe broadcasts
        main_loop = asyncio.get_running_loop()
        loop = asyncio.get_running_loop()

        # Run send_messages in background (don't await)
        async def run_campaign():
            try:
                # Define status callback for real-time updates
                def on_status_update(contact, status):
                    try:
                        log = MessageLog(
                            username=username,
                            name=contact["name"],
                            number=str(contact["number"]),
                            message=message.replace("{name}", contact["name"]),
                            status=status
                        )
                        result = logs_collection.insert_one(log.model_dump())
                        
                        log_data = {
                            "id": str(result.inserted_id),
                            "name": log.name,
                            "number": log.number,
                            "message": log.message,
                            "status": log.status,
                            "created_at": str(log.created_at)
                        }
                        
                        asyncio.run_coroutine_threadsafe(
                            manager.broadcast({"type": "LOG_UPDATE", "data": log_data}, username=username),
                            main_loop
                        )
                    except Exception as e:
                        print(f"[{username}] Error in status callback: {e}")

                # Define broadcast helper for the sender thread
                def broadcast_wrapper(msg):
                    if msg["type"] == "COOLDOWN_START":
                        seconds = msg["data"]["seconds"]
                        new_cooldown = datetime.now(timezone.utc) + timedelta(seconds=seconds)
                        set_cooldown_until(username, new_cooldown)
                    
                    asyncio.run_coroutine_threadsafe(
                        manager.broadcast(msg, username=username),
                        main_loop
                    )

                # Broadcast start
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({"type": "PROCESS_STARTED", "data": {}}, username=username),
                    main_loop
                )

                # Execute in executor
                await loop.run_in_executor(
                    None,
                    functools.partial(
                        send_messages,
                        contacts,
                        message,
                        username=username,
                        on_status=on_status_update,
                        logs_collection=logs_collection,
                        broadcast_func=broadcast_wrapper,
                        users_collection=users_collection
                    )
                )
            except Exception as e:
                print(f"[{username}] Campaign Error: {e}")
            finally:
                if username in active_campaigns:
                    active_campaigns.remove(username)
                print(f"[{username}] Campaign task finished and lock released.")

        # Fire and forget the task
        asyncio.create_task(run_campaign())

        return {
            "success": True,
            "message": "Campaign started in background. Please wait for the QR code to appear.",
            "contacts": len(contacts)
        }

    except Exception as e:

        print("ERROR:", e)

        return {
            "success": False,
            "contacts": 0,
            "message": str(e)
        }

# --- PRODUCTION STATIC FILE SERVING ---
# Resolve frontend build path - check local first, then production structure
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend_dist"))

if os.path.exists(frontend_dist):
    print(f"✅ Serving frontend from: {frontend_dist}")
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    
    @app.exception_handler(404)
    async def spa_handler(request, __):
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    print(f"⚠️ Warning: Frontend dist folder not found. UI will not be served.")