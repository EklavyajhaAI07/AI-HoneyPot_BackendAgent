# Agentic Honey-Pot Backend

This is a production-ready FastAPI backend for the Scam Detection & Intelligence Extraction hackathon track.

## 🚀 Features
- **Scam Detection**: Regex and keyword-based detection.
- **Agentic AI**: "Amit" - A refined persona of a confused elderly man designed to waste scammer time.
- **Intelligence Extraction**: Harvests UPI IDs, Phone Numbers, and URLs.
- **Session Timeout**: Automatically resets sessions after 30 minutes of inactivity.
- **Auto-Tunneling**: Built-in ngrok support for public URLs.

## 🛠 Prerequisites
- Python 3.9+
- An OpenAI API Key (or compatible provider like Together/Groq)

## ⚙️ Setup & Run

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set Environment Variables**
   Create a `.env` file:
   ```bash
   HONEYPOT_API_KEY="YOUR_SECRET_API_KEY"
   LLM_API_KEY="sk-..." 
   USE_NGROK="True"  # Set to True to get a public URL automatically
   # NGROK_AUTHTOKEN="your_token" # Optional: if you have a paid ngrok account
   ```

3. **Run Server**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Get Public URL**
   Check your terminal logs. You will see:
   `✅ NGROK TUNNEL LIVE: https://xxxx-xx-xx.ngrok-free.app`

## 🔗 Submission Details for GUVI

**Header Key**: 
`x-api-key`

**Header Value**: 
`YOUR_SECRET_API_KEY` (or the value from your .env)

**Endpoint URL**:
`https://[YOUR-NGROK-URL]/honeypot/message`

## 🧪 Testing
Use Postman or cURL:
```bash
curl -X POST https://[YOUR-URL]/honeypot/message \
-H "x-api-key: YOUR_SECRET_API_KEY" \
-H "Content-Type: application/json" \
-d '{
    "sessionId": "test-1",
    "message": {
        "sender": "scammer", 
        "text": "Sir your account blocked. Click http://scam.com", 
        "timestamp": "2024-01-01T12:00:00Z"
    }
}'
```
