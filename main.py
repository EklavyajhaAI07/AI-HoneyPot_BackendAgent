import os
import re
import logging
import requests
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Configuration ---
# API Key to secure this backend
HONEYPOT_API_KEY = os.getenv("HONEYPOT_API_KEY", "YOUR_SECRET_API_KEY")

# LLM Configuration (OpenAI Compatible)
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-3.5-turbo")

# GUVI Callback URL
GUVI_CALLBACK_URL = "https://hackathon.guvi.in/api/updateHoneyPotFinalResult"

# Threshold to trigger callback (e.g. 10 messages = 5 turns)
CALLBACK_MESSAGE_THRESHOLD = 10

# Session Timeout (in seconds) - 30 minutes
SESSION_TIMEOUT_SECONDS = 1800

# Ngrok Configuration
USE_NGROK = os.getenv("USE_NGROK", "False").lower() == "true"

# Logging Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HoneyPot")

# --- Lifecycle Manager (for Ngrok) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Logic
    if USE_NGROK:
        try:
            from pyngrok import ngrok, conf
            # Set auth token if available in env, otherwise pyngrok looks in config
            ngrok_auth = os.getenv("NGROK_AUTHTOKEN")
            if ngrok_auth:
                conf.get_default().auth_token = ngrok_auth
            
            port = os.getenv("PORT", "8000")
            public_url = ngrok.connect(port).public_url
            logger.info(f"✅ NGROK TUNNEL LIVE: {public_url}")
            logger.info(f"📋 Submit this URL to GUVI: {public_url}/honeypot/message")
        except Exception as e:
            logger.error(f"Failed to start ngrok: {e}")
    
    yield
    # Shutdown Logic (optional cleanup)

app = FastAPI(title="Agentic Honey-Pot API", lifespan=lifespan)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-Memory State Management ---
# Stores session state: { sessionId: { history: [], intelligence: {}, last_active: datetime, callback_sent: bool, scam_detected: bool } }
session_store: Dict[str, Dict] = {}

# --- Pydantic Models ---
class MessageModel(BaseModel):
    sender: str
    text: str
    timestamp: str

class RequestBody(BaseModel):
    sessionId: str
    message: MessageModel
    conversationHistory: List[Dict] = []
    metadata: Dict = {}

class AgentResponse(BaseModel):
    status: str
    reply: str
    scam_detected: bool
    intelligence: Dict

# --- Intelligence Extraction Logic ---
KEYWORDS_SCAM = [
    "urgent", "blocked", "verify", "kyc", "upi", "pay", "bank", "account", 
    "suspended", "expire", "refund", "prize", "lottery", "password", "otp", 
    "click", "link", "credit card", "debit card", "pin", "cvv", "police", "cbi",
    "arrest", "customs", "fedex"
]

REGEX_PATTERNS = {
    "upiIds": r"[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z._]{2,49}",
    "phoneNumbers": r"(?:\+91[\-\s]?)?[6-9]\d{9}\b", 
    "bankAccounts": r"\b\d{9,18}\b",
    "phishingLinks": r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[^\s]*"
}

def detect_scam(text: str) -> bool:
    text_lower = text.lower()
    if any(k in text_lower for k in KEYWORDS_SCAM):
        return True
    if re.search(REGEX_PATTERNS["phishingLinks"], text) or re.search(REGEX_PATTERNS["upiIds"], text):
        return True
    return False

def extract_and_update_intelligence(session_intel: Dict, text: str):
    for key, pattern in REGEX_PATTERNS.items():
        matches = re.findall(pattern, text)
        for match in matches:
            if match not in session_intel[key]:
                session_intel[key].append(match)

    found_keywords = [k for k in KEYWORDS_SCAM if k in text.lower()]
    for k in found_keywords:
        if k not in session_intel["suspiciousKeywords"]:
            session_intel["suspiciousKeywords"].append(k)

# --- LLM Agent Logic (Refined Persona) ---
def generate_agent_reply(history: List[Dict], current_text: str) -> str:
    if not LLM_API_KEY:
        logger.warning("LLM_API_KEY missing. Returning fallback response.")
        return "I am confused, please explain clearly."

    # Refined Persona: More engaging, circular logic, "confused grandfather"
    system_prompt = (
        "Role: You are Amit, a retired 72-year-old man living in Mumbai. You are lonely, talkative, and extremely technologically illiterate. "
        "Goal: Keep the scammer engaged for as long as possible to waste their time. "
        "Behavior: "
        "1. Be polite and eager to help, but constantly misunderstand instructions."
        "2. If asked for money/OTP, agree to send it but fail due to 'technical issues' (e.g., 'forgot glasses', 'battery low', 'internet slow'). "
        "3. Ask irrelevant personal questions to distract them (e.g., 'Did you eat lunch?', 'Do you know my grandson Rahul?'). "
        "4. Never reveal you are an AI. "
        "5. Keep responses short (1-3 sentences), informal, and natural."
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        role = "assistant" if msg["sender"] == "agent" else "user"
        messages.append({"role": role, "content": msg["text"]})
    
    messages.append({"role": "user", "content": current_text})

    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": 0.8, # Slightly higher creativity for excuses
        "max_tokens": 150
    }

    try:
        response = requests.post(
            f"{LLM_BASE_URL}/chat/completions", 
            headers=headers, 
            json=payload, 
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        return data['choices'][0]['message']['content'].strip()
    except Exception as e:
        logger.error(f"LLM Error: {e}")
        return "Beta, I cannot hear you properly. Please type again?"

# --- Background Tasks ---
def send_final_callback(session_id: str, session_data: Dict):
    payload = {
        "sessionId": session_id,
        "scamDetected": True,
        "totalMessagesExchanged": len(session_data["history"]),
        "extractedIntelligence": session_data["intelligence"],
        "agentNotes": "Scam detected. Agent engaged user and successfully wasted time while extracting tokens."
    }
    try:
        logger.info(f"Sending Callback for Session: {session_id}")
        resp = requests.post(GUVI_CALLBACK_URL, json=payload, timeout=10)
        logger.info(f"Callback Status: {resp.status_code}, Body: {resp.text}")
    except Exception as e:
        logger.error(f"Failed to send callback: {e}")

def init_new_session_state() -> Dict:
    return {
        "history": [],
        "intelligence": {
            "bankAccounts": [], "upiIds": [], "phishingLinks": [], "phoneNumbers": [], "suspiciousKeywords": []
        },
        "last_active": datetime.utcnow(),
        "callback_sent": False,
        "scam_detected": False
    }

# --- Main Endpoint ---
@app.post("/honeypot/message", response_model=AgentResponse)
async def chat_handler(
    body: RequestBody, 
    background_tasks: BackgroundTasks,
    x_api_key: str = Header(...)
):
    # 1. Authentication
    if x_api_key != HONEYPOT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or Missing API Key")

    sid = body.sessionId
    now = datetime.utcnow()

    # 2. Session Management (Timeout Check)
    if sid in session_store:
        last_active = session_store[sid].get("last_active", now)
        if (now - last_active).total_seconds() > SESSION_TIMEOUT_SECONDS:
            logger.info(f"Session {sid} timed out. Resetting.")
            session_store[sid] = init_new_session_state()
    else:
        session_store[sid] = init_new_session_state()

    session = session_store[sid]
    session["last_active"] = now # Update activity timestamp
    
    incoming_text = body.message.text

    # 3. Detect Scam
    is_scam = detect_scam(incoming_text)
    if is_scam:
        session["scam_detected"] = True

    # 4. Extract Intelligence
    extract_and_update_intelligence(session["intelligence"], incoming_text)

    # 5. Agent Response Logic
    should_activate_agent = session["scam_detected"] or len(session["history"]) > 0

    reply_text = ""
    if should_activate_agent:
        reply_text = generate_agent_reply(session["history"], incoming_text)
        
        # Update History
        session["history"].append({"sender": "scammer", "text": incoming_text, "timestamp": body.message.timestamp})
        session["history"].append({"sender": "agent", "text": reply_text, "timestamp": now.isoformat() + "Z"})

        # 6. Callback Trigger
        if (session["scam_detected"] and 
            len(session["history"]) >= CALLBACK_MESSAGE_THRESHOLD and 
            not session["callback_sent"]):
            
            background_tasks.add_task(send_final_callback, sid, session)
            session["callback_sent"] = True
    else:
        # Default neutral response
        reply_text = "Who is this?"
        session["history"].append({"sender": "scammer", "text": incoming_text, "timestamp": body.message.timestamp})
        session["history"].append({"sender": "agent", "text": reply_text, "timestamp": now.isoformat() + "Z"})

    return {
        "status": "success",
        "reply": reply_text,
        "scam_detected": session["scam_detected"],
        "intelligence": session["intelligence"]
    }

@app.get("/")
def health_check():
    return {"status": "running", "msg": "Agentic Honey-Pot Backend is Active"}
