# AgriIntel — AI-Powered Agricultural Assistant

**Live:** [https://agriintel-phi.vercel.app](https://agriintel-phi.vercel.app)
**Backend API:** [https://agriintel-production-935f.up.railway.app](https://agriintel-production-935f.up.railway.app)

An AI chat assistant for Indian farmers, powered by Groq-hosted LLMs (Llama 3.x and DeepSeek-R1) with real-time weather integration, RAG-backed agronomy answers, and 8-language support.

## Features

- Fast AI responses via Groq LPU inference
- Three selectable Pro model personas with different speed/reasoning trade-offs (see [Models](#models) below)
- Real-time weather data (OpenWeatherMap) woven into responses
- RAG-enhanced answers grounded in an ICAR-style crop knowledge base (Pro users)
- 8 Indian languages — English + Hindi free, 6 regional languages on Pro
- Free and Pro tiers with per-model usage limits and reset windows
- Simulated in-app card payment flow to upgrade to Pro (demo — no real payment gateway wired in)
- Auth, profiles, and usage tracking via Supabase (Postgres + Auth + RLS)

## Models

All chat models are served through the [Groq](https://groq.com) API. AgriIntel wraps each Groq model in a farmer-facing persona with its own name, tagline, and rate limit, configurable via `backend/app/config.py` (`GROQ_MODEL_*` settings) and mirrored in `lib/models.ts`.

| Tier | Persona | Groq model | Purpose | Requests | Reset |
|------|---------|-----------|---------|----------|-------|
| Free | **AgriIntel Kisan** ("farmer") | `llama-3.1-8b-instant` | Essential, low-latency farming assistant; short plain-text answers | 20 | 6h |
| Pro — Standard | **AgriIntel Fasal** ("harvest") | `llama-3.3-70b-versatile` | Fast and accurate for everyday queries | 200 | 3h |
| Pro — Advanced | **AgriIntel Vriddhi** ("growth") | `openai/gpt-oss-120b` | Deep reasoning for complex crop and soil analysis | 60 | 3h |
| Pro — Elite | **AgriIntel Samriddhi** ("prosperity") | `qwen/qwen3.6-27b` | Multimodal — send a photo of an affected crop for visual diagnosis | 30 | 3h |

Each tier adds a capability rather than just parameter count: speed -> accuracy ->
reasoning -> vision.

Additional models used outside the chat endpoint:

| Purpose | Model | Where |
|---------|-------|-------|
| RAG embeddings (semantic search over the crop knowledge base) | `sentence-transformers/all-MiniLM-L6-v2` | `backend/app/services/rag_service.py` — indexed with FAISS (`IndexFlatIP`, cosine similarity) |

Free-tier responses are short plain text (max ~200 tokens, temperature 0.3). Pro responses are structured Markdown (headings, tables, checklists) up to 1500 tokens, optionally grounded with RAG context and full 7-day weather forecasts. If `GROQ_API_KEY` is not set, the backend falls back to deterministic mock responses so the app still runs end-to-end for local development.

## Tech Stack

- **Frontend**: Next.js 16, React 18, TypeScript, Tailwind CSS, Framer Motion, Radix UI, react-markdown, Supabase JS
- **Backend**: FastAPI, Python 3.10+, Groq SDK, Sentence-Transformers, FAISS, pandas/numpy
- **Database**: Supabase (Postgres + Auth + Row-Level Security)
- **Weather**: OpenWeatherMap API
- **Deployment**: Vercel (frontend), Railway (backend), Docker Compose (local full-stack)
- **Testing**: Jest + ts-jest (frontend), pytest + pytest-asyncio (backend)

## Project Structure

```
app/                  Next.js app router pages (chat, login, signup, auth confirmation)
components/           React components (chat UI, PaymentModal, shared ui/ primitives)
lib/                  Client-side services: auth, Supabase client, model config, usage tracking
hooks/                React hooks
backend/
  app/api/            FastAPI routes — chat, weather, rag, health
  app/services/        groq_service.py, rag_service.py, weather_service.py
  app/config.py        All environment-driven settings (models, keys, RAG params)
  data/                Generated FAISS index + chunk/metadata files
supabase/schema.sql    Database schema (users, profiles, usage, sessions)
__tests__/             Jest test suite
```

## Features Detail

### Language Support
English and Hindi are available on the Free tier. Telugu, Tamil, Kannada, Marathi, Punjabi, and Odia are Pro-only; non-English responses cost 2 requests against the plan's quota due to the extra translation step.

### Payments
The in-app "Upgrade to Pro" flow (`components/PaymentModal.tsx`) is a self-contained card-entry UI (Luhn validation, card-brand detection for Visa/Mastercard/RuPay/Amex) that upgrades the user's plan directly via Supabase — it is a demo flow and is **not** connected to a real payment processor (no Stripe/Razorpay integration).

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.10+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key
- (Optional) An [OpenWeatherMap](https://openweathermap.org/api) API key for live weather

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

5. **Create `backend/.env`**:
   ```
   GROQ_API_KEY=your-groq-key
   GROQ_MODEL_FREE=llama-3.1-8b-instant
   GROQ_MODEL_PRO=llama-3.3-70b-versatile
   GROQ_MODEL_FASAL=llama-3.3-70b-versatile
   GROQ_MODEL_VRIDDHI=deepseek-r1-distill-llama-70b
   GROQ_MODEL_SAMRIDDHI=llama-3.1-70b-versatile
   WEATHER_API_KEY=your-openweathermap-key
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

   Or run everything at once with `npm run dev:all`, or via Docker with `docker-compose up`.

### Tests

```bash
# Frontend
npm test

# Backend
cd backend && python -m pytest tests/ -v
```

## Engineering Decisions

### Model IDs live in config, not in the service layer
Groq deprecates models aggressively — two of the four models this project originally shipped
with (`deepseek-r1-distill-llama-70b` and `llama-3.1-70b-versatile`) were removed within a year.
Because every model ID is resolved from `config.py` via environment variables, migrating was an
env-var change and a redeploy rather than a code change. The backend also verifies its configured
models against Groq's `/v1/models` endpoint at startup and logs an error if one has disappeared,
so a removed model surfaces in logs instead of as a user-facing failure.

### Tiers are differentiated by capability, not parameter count
Ranking tiers purely by model size produces odd results — a newer 27B model can outperform an
older 70B one, and users cannot tell what they are paying for. Each tier now adds a distinct
capability: Kisan optimises for latency, Fasal for general accuracy, Vriddhi for multi-step
reasoning, and Samriddhi for image input, letting a farmer photograph an affected crop.

### Quotas are enforced server-side
Per-model request limits and reset windows are checked in the FastAPI layer against the Supabase
`usage` table, not in the client. A client-side limit is a suggestion; anyone can open DevTools
and bypass it. The same reasoning applies to tier gating — the backend re-reads the user's plan
from Postgres on every request rather than trusting a flag sent by the frontend.

### Row-level security instead of application-level checks
User data isolation is enforced by Postgres RLS policies rather than `WHERE user_id = ?` filters
in application code. An application-level check fails open if a query is written incorrectly; an
RLS policy fails closed, and the guarantee holds even for requests that bypass the API entirely.

### Free and Pro responses are shaped differently on purpose
Free responses are capped near 200 tokens of plain text at temperature 0.3 — a farmer on a slow
connection wants a short, direct answer. Pro responses run to 1500 tokens of structured Markdown
with RAG grounding and full weather context, where the added latency buys real depth.

## Deployment

- **Frontend** → [Vercel](https://vercel.com) (import GitHub repo, add env vars)
- **Backend** → [Railway](https://railway.app) (connect repo, set root to `backend/`, add env vars)
- A GitHub Actions workflow (`.github/workflows/keep-alive.yml`) runs twice weekly. It queries
  Supabase to stop the free-tier project being paused after 7 days of database inactivity, and
  pings the Railway backend to keep it warm.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat/` | Main chat (RAG + weather, model selection via `model_id`) |
| GET | `/api/health` | Health check |
| GET | `/api/weather/current` | Current weather |
| GET | `/api/rag/stats` | RAG index stats |
