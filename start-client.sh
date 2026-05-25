#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PRODUCTION=false
PULL_MODEL=true

for arg in "$@"; do
  case "$arg" in
    --prod|-p)
      PRODUCTION=true
      ;;
    --no-pull)
      PULL_MODEL=false
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: ./start-client.sh [--prod|-p] [--no-pull]"
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is not installed. Install Docker Desktop first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop and retry."
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

COMPOSE_ARGS=(compose)

if [[ "$PRODUCTION" == "true" ]]; then
  if [[ ! -f .env.prod ]]; then
    cp .env.prod.example .env.prod
    echo "Created .env.prod from .env.prod.example"
  fi
  COMPOSE_ARGS+=(--env-file .env --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml)
fi

if [[ "$PULL_MODEL" == "true" ]]; then
  docker "${COMPOSE_ARGS[@]}" --profile init up ollama-init
fi

docker "${COMPOSE_ARGS[@]}" up --build -d
docker "${COMPOSE_ARGS[@]}" ps

echo
echo "Application is starting:"
echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://localhost:8000/api/health"