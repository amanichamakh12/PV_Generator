# PV Generator - Docker Deployment

This repository is ready to run with Docker Compose for client delivery.

## Services

- `ollama`: local LLM runtime
- `backend`: FastAPI API on port `8000`
- `frontend`: Next.js app on port `3000`

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose plugin)

## Quick Start

1. Create a local env file:

   ```bash
   cp .env.example .env
   ```

2. Start all services:

   ```bash
   docker compose up --build -d
   ```

Windows one-command launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-client.ps1
```

Windows double-click launcher (recommended):

```bat
start-client.cmd
```

Shell launcher:

```bash
./start-client.sh
```

If you want to double-click the shell script on Windows, associate `.sh` files with Git Bash.

3. Open the app:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/api/health`

## Pull the Ollama model (recommended first run)

You can pre-pull the configured model before first use:

```bash
docker compose --profile init up ollama-init
```

Default model is set in `.env` via `OLLAMA_MODEL`.

## Production Mode (Pinned Tags + Resource Limits)

1. Create production env file:

   ```bash
   cp .env.prod.example .env.prod
   ```

2. Start in production mode:

   ```bash
   docker compose --env-file .env --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up --build -d
   ```

Windows one-command production launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-client.ps1 -Production
```

Windows production double-click launcher:

```bat
start-client-prod.cmd
```

Shell production launcher:

```bash
./start-client.sh --prod
```

## Logs and Troubleshooting

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ollama
```

If frontend cannot reach backend, verify `NEXT_PUBLIC_API_BASE_URL` in `.env` is `http://localhost:8000`.

## Stop / Remove

```bash
docker compose down
```

Windows stop script:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-client.ps1
```

Windows stop double-click launcher:

```bat
stop-client.cmd
```

Shell stop script:

```bash
./stop-client.sh
```

Production stop:

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-client.ps1 -Production
```

To remove volumes too (including cached Ollama models):

```bash
docker compose down -v
```