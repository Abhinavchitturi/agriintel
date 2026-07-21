# AgriIntel — AI-Powered Agricultural Assistant

**Live:** [https://agriintel-phi.vercel.app](https://agriintel-phi.vercel.app)  
**Backend API:** [https://agriintel-production-935f.up.railway.app](https://agriintel-production-935f.up.railway.app)

An AI chat assistant for Indian farmers, powered by Groq (Llama 3.3 70B) with weather integration and multi-language support.

## Features

- Fast AI responses via Groq LPU inference
- Real-time weather data (OpenWeatherMap)
- RAG-enhanced answers for Pro users
- 8 Indian languages (English + Hindi free, 6 regional languages on Pro)
- Free and Pro tiers with usage tracking
- Auth and data via Supabase

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Supabase JS
- **Backend**: FastAPI, Python 3.10+, Groq SDK
- **Database**: Supabase (Postgres + Auth + RLS)

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key

### Setup

1. **Clone and install frontend**
   ```bash
   npm install
   ```

2. **Create `.env.local`** in the project root:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   BACKEND_URL=http://localhost:8000
   ```

3. **Set up the database** — run `supabase/schema.sql` in your Supabase SQL editor.

4. **Install backend**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   ```

5. **Create `backend/.env`** (copy from `.env.example` pattern in docs):
   ```
   GROQ_API_KEY=your-groq-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SECRET_KEY=generate-with-python-secrets-token-hex-32
   ```

6. **Run both services**
   ```bash
   # Terminal 1 — backend
   cd backend && uvicorn app.main:app --reload

   # Terminal 2 — frontend
   npm run dev
   ```

### Tests

```bash
# Frontend
npm test

# Backend
cd backend && python -m pytest tests/ -v
```

## Deployment

- **Frontend** → [Vercel](https://vercel.com) (import GitHub repo, add env vars)
- **Backend** → [Railway](https://railway.app) (connect repo, set root to `backend/`, add env vars)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/` | Main chat (RAG + weather) |
| GET | `/api/health` | Health check |
| GET | `/api/weather/current` | Current weather |
| GET | `/api/rag/stats` | RAG index stats |
