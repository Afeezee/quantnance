# Single-service Render deployment for Quantnance.
# Builds the React client, then serves both the SPA and FastAPI API from one container.

FROM node:22-alpine AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci --prefer-offline

COPY client/ ./
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/server

COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server/main.py server/auth.py server/database.py ./
COPY server/models/ ./models/
COPY server/routes/ ./routes/
COPY server/services/ ./services/

COPY --from=client-builder /app/client/dist /app/client/dist

EXPOSE 10000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]