# ── Quantnance Backend ──────────────────────────────────────────────────────
# Python 3.11 slim — production image for Google Cloud Run
FROM python:3.11-slim

# Prevent .pyc files and enable unbuffered stdout (important for Cloud Run logs)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Install dependencies first (Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the application source — no venv, no .env, no __pycache__
COPY main.py auth.py ./
COPY routes/ ./routes/
COPY services/ ./services/

# Cloud Run injects PORT at runtime; uvicorn reads it via shell substitution
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
