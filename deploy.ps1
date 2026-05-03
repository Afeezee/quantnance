# =============================================================================
# deploy.ps1  —  Quantnance full-stack deployment to Google Cloud Run
# =============================================================================
# Prerequisites
#   1. Google Cloud SDK (gcloud) installed and in PATH
#   2. A GCP project already created
#   (Docker Desktop is NOT required — images are built remotely via Cloud Build)
#
# Usage
#   .\deploy.ps1
#
# =============================================================================

# ─── CONFIGURATION  ──────────────────────────────────────────────────────────
# GCP project you want to deploy into
$PROJECT_ID   = "gen-lang-client-0393914745"

# Cloud Run region
$REGION       = "us-central1"

# Cloud Run service names
$BACKEND_SVC  = "quantnance-backend"
$FRONTEND_SVC = "quantnance-frontend"

# GCR image names
$BACKEND_IMG  = "gcr.io/$PROJECT_ID/$BACKEND_SVC"
$FRONTEND_IMG = "gcr.io/$PROJECT_ID/$FRONTEND_SVC"

# ── Local deployment inputs (kept out of git) ──────────────────────────────
$BACKEND_ENV_FILE = Join-Path $PSScriptRoot "server\cloudrun-env.yaml"

$_clientEnv = @{}
Get-Content "$PSScriptRoot\client\.env" | ForEach-Object {
    if ($_ -match '^([A-Za-z_]+)=(.+)$') { $_clientEnv[$Matches[1]] = $Matches[2] }
}

$_backendDeployEnv = @{}
Get-Content $BACKEND_ENV_FILE | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*$') {
        $key = $Matches[1]
        $value = $Matches[2].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $_backendDeployEnv[$key] = $value
    }
}

if (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    $_backendDeployEnv["DATABASE_URL"] = $env:DATABASE_URL
}

if (-not [string]::IsNullOrWhiteSpace($env:CLOUD_SQL_INSTANCE)) {
    $_backendDeployEnv["CLOUD_SQL_INSTANCE"] = $env:CLOUD_SQL_INSTANCE
}

# ── Frontend Clerk key (baked into the JS bundle at build time) ───────────────
$VITE_CLERK_PUBLISHABLE_KEY = $_clientEnv["VITE_CLERK_PUBLISHABLE_KEY"]
$CLOUD_SQL_INSTANCE = $_backendDeployEnv["CLOUD_SQL_INSTANCE"]
$BACKEND_SECRET_KEYS = @(
    "GROQ_API_KEY",
    "BAYSE_PUBLIC_KEY",
    "ALPHA_VANTAGE_KEY",
    "NEWS_API_KEY",
    "CLERK_JWKS_URL",
    "DATABASE_URL"
)

# =============================================================================


# ─── Helper ──────────────────────────────────────────────────────────────────
function Step { param($n, $msg) Write-Host "`n-- Step $n : $msg --" -ForegroundColor Cyan }
function OK   { param($msg)     Write-Host "  [OK] $msg" -ForegroundColor Green }
function Fail { param($msg)     Write-Host "  [FAIL] $msg" -ForegroundColor Red; exit 1 }

function Require-Value {
    param($name, $value)
    if ([string]::IsNullOrWhiteSpace($value)) {
        Fail "Missing key '$name' - check your .env files."
    }
}

function Require-File {
    param($path, $name)
    if (-not (Test-Path $path)) {
        Fail "Missing file '$name'. Create it locally before running deploy."
    }
}

function Secret-Name {
    param($key)
    return ("{0}-{1}" -f $BACKEND_SVC.ToLowerInvariant(), $key.ToLowerInvariant().Replace('_', '-'))
}

function Upsert-Secret {
    param(
        [string]$Key,
        [string]$Value
    )

    $secretName = Secret-Name $Key
    gcloud secrets describe $secretName --project $PROJECT_ID *> $null
    if ($LASTEXITCODE -ne 0) {
        gcloud secrets create $secretName --replication-policy automatic --project $PROJECT_ID --quiet
        if ($LASTEXITCODE -ne 0) { Fail "Failed to create secret '$secretName'" }
    }

    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tempFile, $Value)
        gcloud secrets versions add $secretName --data-file=$tempFile --project $PROJECT_ID --quiet
        if ($LASTEXITCODE -ne 0) { Fail "Failed to add secret version for '$secretName'" }
    }
    finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

function Quote-ForSetArgs {
    param([string]$value)
    if ($value -match '[,=]') {
        return '"' + $value.Replace('"', '\"') + '"'
    }
    return $value
}

# Validate all required values
Require-File  $BACKEND_ENV_FILE              "server/cloudrun-env.yaml"
Require-Value "VITE_CLERK_PUBLISHABLE_KEY"  $VITE_CLERK_PUBLISHABLE_KEY
foreach ($requiredKey in $BACKEND_SECRET_KEYS) {
    Require-Value $requiredKey $_backendDeployEnv[$requiredKey]
}
Require-Value "CLOUD_SQL_INSTANCE" $CLOUD_SQL_INSTANCE

if ($_backendDeployEnv["DATABASE_URL"] -match '^sqlite') {
    Fail "DATABASE_URL points to SQLite. Use a Cloud SQL Postgres connection string before deploying."
}

# Store the script's own directory so relative paths always resolve correctly
$ROOT = $PSScriptRoot

# =============================================================================
# STEP 1 — Authenticate and configure gcloud
# =============================================================================
Step 1 "Authenticate with Google Cloud"

$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)"
if ([string]::IsNullOrWhiteSpace($activeAccount)) {
    gcloud auth login
    if ($LASTEXITCODE -ne 0) { Fail "gcloud auth login failed" }
}
else {
    OK "Using active gcloud account $activeAccount"
}

gcloud config set project $PROJECT_ID
if ($LASTEXITCODE -ne 0) { Fail "Could not set GCP project '$PROJECT_ID'" }
OK "Project set to $PROJECT_ID"

# (No local Docker auth needed — Cloud Build pushes directly to GCR)

# =============================================================================
# STEP 2 — Enable required GCP APIs
# =============================================================================
Step 2 "Enable Cloud Run and Cloud Build APIs"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com sql-component.googleapis.com --quiet
if ($LASTEXITCODE -ne 0) { Fail "Failed to enable APIs" }
OK "APIs enabled"

# =============================================================================
# STEP 3 — Sync backend secrets into Secret Manager
# =============================================================================
Step 3 "Sync backend runtime secrets to Secret Manager"

$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format "value(projectNumber)"
if ([string]::IsNullOrWhiteSpace($PROJECT_NUMBER)) {
    Fail "Could not determine project number for '$PROJECT_ID'"
}

$RUNTIME_SERVICE_ACCOUNT = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

foreach ($secretKey in $BACKEND_SECRET_KEYS) {
    $secretValue = $_backendDeployEnv[$secretKey]
    Upsert-Secret -Key $secretKey -Value $secretValue

    $secretName = Secret-Name $secretKey
    gcloud secrets add-iam-policy-binding $secretName `
        --member "serviceAccount:$RUNTIME_SERVICE_ACCOUNT" `
        --role "roles/secretmanager.secretAccessor" `
        --project $PROJECT_ID `
        --quiet *> $null
    if ($LASTEXITCODE -ne 0) {
        Fail "Failed to grant Secret Manager access for '$secretName' to '$RUNTIME_SERVICE_ACCOUNT'"
    }
}

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member "serviceAccount:$RUNTIME_SERVICE_ACCOUNT" `
    --role "roles/cloudsql.client" `
    --quiet *> $null
if ($LASTEXITCODE -ne 0) {
    Fail "Failed to grant Cloud SQL Client to '$RUNTIME_SERVICE_ACCOUNT'"
}
OK "Backend secrets synced"

# =============================================================================
# STEP 4 — Build and push the backend image (Cloud Build)
# =============================================================================
Step 4 "Build and push backend image via Cloud Build"

gcloud builds submit "$ROOT/server" `
    --tag "$BACKEND_IMG" `
    --quiet

if ($LASTEXITCODE -ne 0) { Fail "Backend Cloud Build failed" }
OK "Image built and pushed: $BACKEND_IMG"

# =============================================================================
# STEP 5 — Deploy backend to Cloud Run (initial deploy, no FRONTEND_URL yet)
# =============================================================================
Step 5 "Deploy backend to Cloud Run"

$backendSecretsArg = ($BACKEND_SECRET_KEYS | ForEach-Object {
    "{0}={1}:latest" -f $_, (Secret-Name $_)
}) -join ","

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
    --clear-env-vars `
    --add-cloudsql-instances "$CLOUD_SQL_INSTANCE" `
    --set-secrets "$backendSecretsArg" `
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
# STEP 7 — Build and push the frontend image via Cloud Build
# =============================================================================
Step 7 "Build and push frontend image via Cloud Build (BACKEND_URL=$BACKEND_URL)"

# Use cloudbuild.yaml to pass VITE_CLERK_PUBLISHABLE_KEY as a Docker build-arg
gcloud builds submit "$ROOT/client" `
    --config "$ROOT/client/cloudbuild.yaml" `
    --substitutions "_IMAGE=$FRONTEND_IMG,_VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY" `
    --quiet

if ($LASTEXITCODE -ne 0) { Fail "Frontend Cloud Build failed" }
OK "Image built and pushed: $FRONTEND_IMG"

# =============================================================================
# STEP 8 — Deploy frontend to Cloud Run
# =============================================================================
Step 8 "Deploy frontend to Cloud Run"

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
    --set-env-vars "BACKEND_URL=$BACKEND_URL" `
    --quiet

if ($LASTEXITCODE -ne 0) { Fail "Frontend Cloud Run deploy failed" }
OK "Frontend deployed"

# =============================================================================
# STEP 9 — Capture the frontend URL
# =============================================================================
Step 9 "Retrieve frontend Cloud Run URL"

$FRONTEND_URL = gcloud run services describe $FRONTEND_SVC `
    --platform managed `
    --region $REGION `
    --format "value(status.url)"

if ([string]::IsNullOrWhiteSpace($FRONTEND_URL)) {
    Fail "Could not retrieve frontend URL from Cloud Run"
}
OK "Frontend URL: $FRONTEND_URL"

# =============================================================================
# STEP 10 — Update backend CORS to accept the frontend origin
# We update only env vars — no image rebuild needed
# =============================================================================
Step 10 "Update backend CORS to allow $FRONTEND_URL"

$quotedFrontendUrl = Quote-ForSetArgs $FRONTEND_URL

gcloud run services update $BACKEND_SVC `
    --platform managed `
    --region $REGION `
    --update-env-vars "FRONTEND_URL=$quotedFrontendUrl" `
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
