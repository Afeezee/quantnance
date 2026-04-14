# Quantnance

**AI-Powered Investment Intelligence Platform**

Quantnance lets users search for any stock or crypto in natural language, receive AI-generated investment briefs, compare assets side-by-side, and get personalized recommendations — all backed by real-time market data, news sentiment analysis, and prediction market crowd intelligence.

![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

| Feature | Description |
|---|---|
| **Natural-Language Search** | Type "How is Apple doing?" — AI resolves it to AAPL and generates a full brief |
| **AI Investment Briefs** | Executive summary, financial metrics, sentiment, risk assessment, macro context, plain-language verdict |
| **News Sentiment Analysis** | AI-scored Bullish/Bearish/Neutral with key themes, risk flags, and opportunity signals |
| **Prediction Market Odds** | Bayse Markets crowd intelligence with visual probability bars |
| **Stock Comparison** | Side-by-side AI comparison of 2–4 stocks |
| **AI Recommendations** | Suggest stocks based on user criteria (e.g. "dividend stocks", "Nigerian banks") |
| **Conversational AI Chat** | Ask follow-up questions about any generated analysis |
| **Live FX & Crypto Ticker** | Real-time BTC, ETH, SOL prices and 9 currency pairs vs NGN via CoinGecko |
| **Multi-Currency FX View** | Dropdown selector for USD, EUR, GBP, CAD, CHF, CNY, JPY, AED, ZAR vs NGN |
| **Search History** | Persistent sidebar of recent queries (localStorage) |
| **Dark / Light Theme** | One-click toggle |
| **Clerk Authentication** | Secure sign-in/sign-up with JWT-protected API endpoints |

---

## Tech Stack

### Frontend

- **React 19** with TypeScript & Vite 8
- **Tailwind CSS v4** for styling
- **Recharts** for interactive price charts
- **Framer Motion** for animations
- **Lucide React** for icons
- **@clerk/clerk-react** for authentication UI

### Backend

- **FastAPI** (Python 3.11) with Uvicorn ASGI server
- **Groq API** — LLama 3.3 70B model for all AI analysis
- **Yahoo Finance** — real-time quotes, company data, price history
- **NewsAPI.org** — financial news articles
- **Bayse Markets** — prediction market crowd data
- **Clerk** — JWT-based authentication (RS256 + JWKS)

### Deployment

- **Google Cloud Run** — serverless containers for both frontend and backend
- **Nginx** reverse proxy on the frontend container, proxying `/api/*` to the backend
- **Docker** multi-stage builds (Node 22 → Nginx Alpine for frontend, Python 3.11-slim for backend)

---

## Project Structure

```
Quantnance/
├── client/                        # React frontend
│   ├── src/
│   │   ├── main.tsx               # Entry point (ClerkProvider + ThemeProvider)
│   │   ├── App.tsx                # Main app — search, mode routing, layout
│   │   ├── hooks/
│   │   │   ├── useBrief.ts        # Core data hook (classify → analyze/compare/recommend)
│   │   │   ├── useBayseSocket.ts  # CoinGecko polling for crypto + FX rates
│   │   │   ├── useSearch.ts       # Ticker search hook
│   │   │   ├── useSearchHistory.ts# LocalStorage search history
│   │   │   ├── useTheme.ts        # Dark/light theme toggle
│   │   │   └── useCountUp.ts      # Animated counter
│   │   └── components/
│   │       ├── brief/             # Analysis display cards
│   │       │   ├── PlainLanguageSummary.tsx
│   │       │   ├── AssetOverviewCard.tsx
│   │       │   ├── PriceChart.tsx
│   │       │   ├── NewsSentimentSection.tsx
│   │       │   ├── SentimentGauge.tsx
│   │       │   ├── BayseSection.tsx
│   │       │   ├── FinancialMetricsPanel.tsx
│   │       │   ├── RiskAssessmentCard.tsx
│   │       │   ├── MacroContextCard.tsx
│   │       │   ├── ChatInterface.tsx
│   │       │   ├── ComparisonView.tsx
│   │       │   └── RecommendationView.tsx
│   │       ├── layout/            # Navbar, Background
│   │       ├── search/            # SearchBar, ExchangeSelector
│   │       └── shared/            # GlassCard, AnimatedNumber, loaders, badges
│   ├── Dockerfile                 # Multi-stage: Node build → Nginx serve
│   ├── nginx.conf                 # Reverse proxy + SPA config
│   └── package.json
│
├── server/                        # FastAPI backend
│   ├── main.py                    # App entry, CORS, router mount, health check
│   ├── auth.py                    # Clerk JWT verification (RS256 + JWKS)
│   ├── routes/
│   │   └── brief.py               # All API endpoints (/api/*)
│   ├── services/
│   │   ├── ai_analysis.py         # Groq LLM calls (briefs, sentiment, chat, etc.)
│   │   ├── stocks.py              # Yahoo Finance data fetching
│   │   ├── news.py                # NewsAPI integration
│   │   └── bayse.py               # Bayse prediction market integration
│   ├── cache/                     # Server-side file cache
│   ├── Dockerfile                 # Python 3.11-slim + Uvicorn
│   ├── requirements.txt
│   └── cloudrun-env.yaml          # Cloud Run environment variables
│
└── deploy.ps1                     # PowerShell deployment script (GCP Cloud Run)
```

---

## API Endpoints

All `/api/*` endpoints require a valid Clerk JWT in the `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search?q=` | Search for stock tickers (Yahoo Finance). Supports natural language. |
| `GET` | `/api/classify?prompt=` | AI classifies intent as `analyze`, `compare`, or `recommend` and extracts symbols. |
| `GET` | `/api/analyze?prompt=` | Full AI investment brief — resolves query to a stock, fetches data in parallel, generates analysis. |
| `GET` | `/api/brief?symbol=` | Same as analyze but takes a known ticker symbol directly. |
| `GET` | `/api/compare?prompt=&symbols=` | AI side-by-side comparison of 2–4 stocks. |
| `GET` | `/api/recommend?prompt=` | AI generates 4–6 stock suggestions matching user criteria. |
| `POST` | `/api/chat` | Conversational Q&A about a previously generated brief (up to 8 turns). |
| `GET` | `/health` | Health check (no auth required). |

### Caching

The server uses in-memory + file-based caching with configurable TTLs:

- **Brief**: 30 minutes
- **Quote**: 60 seconds
- **Company overview**: 24 hours
- **Search results**: 1 hour
- **News**: 30 minutes
- **Bayse events**: 60 seconds

---

## Authentication Flow

1. `ClerkProvider` wraps the React app with the publishable key
2. Unauthenticated users see the homepage; signing in is required to run analysis
3. On each API call, the client fetches a fresh Clerk JWT via `useAuth().getToken()`
4. The JWT is sent as `Authorization: Bearer <token>` on every request
5. The FastAPI backend verifies the JWT signature against Clerk's JWKS endpoint (RS256)
6. JWKS keys are cached in memory for 1 hour and auto-refresh on key ID mismatch

---

## Getting Started

### Prerequisites

- **Node.js 22+** and npm
- **Python 3.11+**
- API keys for: [Groq](https://console.groq.com/), [NewsAPI](https://newsapi.org/), [Bayse Markets](https://bayse.markets/), [Clerk](https://clerk.com/)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/quantnance.git
cd quantnance
```

### 2. Backend setup

```bash
cd server
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in `server/`:

```env
GROQ_API_KEY=your_groq_api_key
NEWS_API_KEY=your_newsapi_key
BAYSE_PUBLIC_KEY=your_bayse_key
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd client
npm install
```

Create a `.env` file in `client/`:

```env
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
```

Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Deployment (Google Cloud Run)

### Automated

Run the included deployment script:

```powershell
.\deploy.ps1
```

This will build and deploy both containers, wire up environment variables, and configure CORS.

### Manual

**Backend:**

```bash
cd server
gcloud run deploy quantnance-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 120 \
  --set-env-vars "GROQ_API_KEY=...,NEWS_API_KEY=...,BAYSE_PUBLIC_KEY=...,CLERK_JWKS_URL=..."
```

**Frontend:**

```bash
cd client
gcloud run deploy quantnance-frontend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 120 \
  --set-env-vars "BACKEND_URL=https://your-backend-url.run.app"
```

---

## Environment Variables

### Backend (`server/`)

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for LLama 3.3 70B |
| `NEWS_API_KEY` | Yes | NewsAPI.org API key |
| `BAYSE_PUBLIC_KEY` | Yes | Bayse Markets public key |
| `CLERK_JWKS_URL` | Yes | Clerk JWKS endpoint for JWT verification |
| `FRONTEND_URL` | No | Frontend origin for CORS (defaults to `*` in dev) |
| `PORT` | No | Server port (default: 8080 on Cloud Run) |

### Frontend (`client/`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `BACKEND_URL` | Prod only | Backend URL for Nginx reverse proxy (Cloud Run) |

---

## How It Works

```
User types: "How is NVIDIA doing?"
         │
         ▼
┌─────────────────┐     ┌──────────────────────┐
│  React Frontend │────▶│  GET /api/classify    │
│  (Clerk JWT)    │     │  → intent: "analyze"  │
└─────────────────┘     │  → symbol: "NVDA"     │
         │              └──────────────────────┘
         ▼
┌──────────────────────────────────────────────────┐
│  GET /api/analyze?prompt=How+is+NVIDIA+doing     │
│                                                   │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │Yahoo Finance│  │ NewsAPI  │  │Bayse Markets│ │
│  │ Quote+Chart │  │ Articles │  │  Predictions │ │
│  └──────┬──────┘  └────┬─────┘  └──────┬──────┘ │
│         └───────┬───────┘───────────────┘        │
│                 ▼                                  │
│  ┌──────────────────────────────────────┐        │
│  │  Groq AI (LLama 3.3 70B)            │        │
│  │  • Sentiment analysis                │        │
│  │  • Investment brief generation       │        │
│  │  • Risk assessment                   │        │
│  │  • Macroeconomic context             │        │
│  └──────────────┬───────────────────────┘        │
│                 ▼                                  │
│  Full BriefData JSON response                     │
└──────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  React renders:                              │
│  • Executive Summary    • Price Chart        │
│  • Asset Overview       • News Sentiment     │
│  • Financial Metrics    • Risk Assessment    │
│  • Bayse Predictions    • Macro Context      │
│  • AI Chat Interface                         │
└─────────────────────────────────────────────┘
```

---

## License

This project is licensed under the MIT License.
