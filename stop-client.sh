#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PRODUCTION=false
REMOVE_VOLUMES=false

for arg in "$@"; do
  case "$arg" in
    --prod|-p)
      PRODUCTION=true
      ;;
    --volumes|-v)
      REMOVE_VOLUMES=true
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: ./stop-client.sh [--prod|-p] [--volumes|-v]"
      exit 1
      ;;
  esac
done

COMPOSE_ARGS=(compose)

if [[ "$PRODUCTION" == "true" ]]; then
  COMPOSE_ARGS+=(--env-file .env --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml)
fi

DOWN_ARGS=(down)
if [[ "$REMOVE_VOLUMES" == "true" ]]; then
  DOWN_ARGS+=(-v)
fi

docker "${COMPOSE_ARGS[@]}" "${DOWN_ARGS[@]}"