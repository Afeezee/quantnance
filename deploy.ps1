# =============================================================================
# deploy.ps1  —  Quantnance full-stack deployment to Google Cloud Run
# =============================================================================
# Prerequisites
#   1. Google Cloud SDK (gcloud) installed and in PATH
#   2. Docker Desktop running
#   3. A GCP project already created
#
# Usage
#   .\deploy.ps1
#
# Before running, fill in every placeholder marked  <REPLACE_ME>
# =============================================================================

# ─── CONFIGURATION  ──────────────────────────────────────────────────────────
# GCP project you want to deploy into
$PROJECT_ID   = "<REPLACE_ME>"            # e.g. "my-quantnance-project"

# Cloud Run region
$REGION       = "us-central1"

# Cloud Run service names
$BACKEND_SVC  = "quantnance-backend"
$FRONTEND_SVC = "quantnance-frontend"

# GCR image names
$BACKEND_IMG  = "gcr.io/$PROJECT_ID/$BACKEND_SVC"
$FRONTEND_IMG = "gcr.io/$PROJECT_ID/$FRONTEND_SVC"

# ── API Keys (passed as env vars to the backend — never baked into the image) ─
$GROQ_API_KEY           = "<REPLACE_ME>"  # Groq console.groq.com
$BAYSE_PUBLIC_KEY       = "<REPLACE_ME>"  # Bayse public key
$NEWS_API_KEY           = "<REPLACE_ME>"  # newsapi.org key
$ALPHA_VANTAGE_KEY      = "<REPLACE_ME>"  # alphavantage.co key (if used)
$CLERK_JWKS_URL         = "<REPLACE_ME>"  # e.g. https://sweet-chimp-85.clerk.accounts.dev/.well-known/jwks.json

# ── Frontend Clerk key (baked into the JS bundle at build time) ───────────────
$VITE_CLERK_PUBLISHABLE_KEY = "<REPLACE_ME>"  # pk_live_... or pk_test_...

# =============================================================================


# ─── Helper ──────────────────────────────────────────────────────────────────
function Step { param($n, $msg) Write-Host "`n── Step $n : $msg ──" -ForegroundColor Cyan }
function OK   { param($msg)     Write-Host "  ✔ $msg" -ForegroundColor Green }
function Fail { param($msg)     Write-Host "  ✘ $msg" -ForegroundColor Red; exit 1 }

function Require-Value {
    param($name, $value)
    if ($value -eq "<REPLACE_ME>" -or [string]::IsNullOrWhiteSpace($value)) {
        Fail "You must set `$$name` in deploy.ps1 before running."
    }
}

# Validate all required replacements
Require-Value "PROJECT_ID"                  $PROJECT_ID
Require-Value "GROQ_API_KEY"                $GROQ_API_KEY
Require-Value "BAYSE_PUBLIC_KEY"            $BAYSE_PUBLIC_KEY
Require-Value "NEWS_API_KEY"                $NEWS_API_KEY
Require-Value "CLERK_JWKS_URL"              $CLERK_JWKS_URL
Require-Value "VITE_CLERK_PUBLISHABLE_KEY"  $VITE_CLERK_PUBLISHABLE_KEY

# Store the script's own directory so relative paths always resolve correctly
$ROOT = $PSScriptRoot

# =============================================================================
# STEP 1 — Authenticate and configure gcloud
# =============================================================================
Step 1 "Authenticate with Google Cloud"

gcloud auth login
if ($LASTEXITCODE -ne 0) { Fail "gcloud auth login failed" }

gcloud config set project $PROJECT_ID
if ($LASTEXITCODE -ne 0) { Fail "Could not set GCP project '$PROJECT_ID'" }
OK "Project set to $PROJECT_ID"

# Configure Docker to push to GCR
gcloud auth configure-docker --quiet
if ($LASTEXITCODE -ne 0) { Fail "gcloud auth configure-docker failed" }
OK "Docker configured for GCR"

# =============================================================================
# STEP 2 — Enable required GCP APIs
# =============================================================================
Step 2 "Enable Cloud Run and Cloud Build APIs"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com --quiet
if ($LASTEXITCODE -ne 0) { Fail "Failed to enable APIs" }
OK "APIs enabled"

# =============================================================================
# STEP 3 — Build and push the backend image
# =============================================================================
Step 3 "Build backend Docker image"

docker build -t "$BACKEND_IMG" "$ROOT/server"
if ($LASTEXITCODE -ne 0) { Fail "Backend Docker build failed" }
OK "Image built: $BACKEND_IMG"

Step 4 "Push backend image to GCR"

docker push "$BACKEND_IMG"
if ($LASTEXITCODE -ne 0) { Fail "Backend image push failed" }
OK "Image pushed: $BACKEND_IMG"

# =============================================================================
# STEP 5 — Deploy backend to Cloud Run (initial deploy, no FRONTEND_URL yet)
# =============================================================================
Step 5 "Deploy backend to Cloud Run"

gcloud run deploy $BACKEND_SVC `
    --image "$BACKEND_IMG" `
    --platform managed `
    --region $REGION `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --port 8080 `
    --allow-unauthenticated `
    --set-env-vars "GROQ_API_KEY=$GROQ_API_KEY,BAYSE_PUBLIC_KEY=$BAYSE_PUBLIC_KEY,NEWS_API_KEY=$NEWS_API_KEY,ALPHA_VANTAGE_KEY=$ALPHA_VANTAGE_KEY,CLERK_JWKS_URL=$CLERK_JWKS_URL" `
    --quiet

if ($LASTEXITCODE -ne 0) { Fail "Backend Cloud Run deploy failed" }
OK "Backend deployed"

# =============================================================================
# STEP 6 — Capture the backend URL
# =============================================================================
Step 6 "Retrieve backend Cloud Run URL"

$BACKEND_URL = gcloud run services describe $BACKEND_SVC `
    --platform managed `
    --region $REGION `
    --format "value(status.url)"

if ([string]::IsNullOrWhiteSpace($BACKEND_URL)) {
    Fail "Could not retrieve backend URL from Cloud Run"
}
OK "Backend URL: $BACKEND_URL"

# =============================================================================
# STEP 7 — Build and push the frontend image (injects BACKEND_URL for Nginx)
# =============================================================================
Step 7 "Build frontend Docker image (with backend URL $BACKEND_URL baked into Nginx)"

docker build `
    --build-arg "BACKEND_URL=$BACKEND_URL" `
    --build-arg "VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY" `
    -t "$FRONTEND_IMG" `
    "$ROOT/client"

if ($LASTEXITCODE -ne 0) { Fail "Frontend Docker build failed" }
OK "Image built: $FRONTEND_IMG"

Step 8 "Push frontend image to GCR"

docker push "$FRONTEND_IMG"
if ($LASTEXITCODE -ne 0) { Fail "Frontend image push failed" }
OK "Image pushed: $FRONTEND_IMG"

# =============================================================================
# STEP 9 — Deploy frontend to Cloud Run
# =============================================================================
Step 9 "Deploy frontend to Cloud Run"

gcloud run deploy $FRONTEND_SVC `
    --image "$FRONTEND_IMG" `
    --platform managed `
    --region $REGION `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 10 `
    --port 8080 `
    --allow-unauthenticated `
    --quiet

if ($LASTEXITCODE -ne 0) { Fail "Frontend Cloud Run deploy failed" }
OK "Frontend deployed"

# =============================================================================
# STEP 10 — Capture the frontend URL
# =============================================================================
Step 10 "Retrieve frontend Cloud Run URL"

$FRONTEND_URL = gcloud run services describe $FRONTEND_SVC `
    --platform managed `
    --region $REGION `
    --format "value(status.url)"

if ([string]::IsNullOrWhiteSpace($FRONTEND_URL)) {
    Fail "Could not retrieve frontend URL from Cloud Run"
}
OK "Frontend URL: $FRONTEND_URL"

# =============================================================================
# STEP 11 — Update backend CORS to accept the frontend origin
# We update only env vars — no image rebuild needed
# =============================================================================
Step 11 "Update backend CORS to allow $FRONTEND_URL"

gcloud run services update $BACKEND_SVC `
    --platform managed `
    --region $REGION `
    --update-env-vars "FRONTEND_URL=$FRONTEND_URL" `
    --quiet

if ($LASTEXITCODE -ne 0) { Fail "Failed to update backend env vars" }
OK "Backend CORS updated"

# =============================================================================
# DONE
# =============================================================================
Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend  : $FRONTEND_URL" -ForegroundColor White
Write-Host "  Backend   : $BACKEND_URL"  -ForegroundColor White
Write-Host "  Health    : $BACKEND_URL/health" -ForegroundColor White
Write-Host "  API docs  : $BACKEND_URL/docs"   -ForegroundColor White
Write-Host ""
Write-Host "Verify both services are live:"
Write-Host "  Invoke-RestMethod '$BACKEND_URL/health'"
Write-Host "  Start-Process '$FRONTEND_URL'"
Write-Host ""
