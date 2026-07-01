"""FastAPI app bootstrap for PV backend."""

import logging
import logging.config
from contextlib import asynccontextmanager
from pathlib import Path
import time
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import models_layer.orm_models  # noqa: F401 — enregistre les 13 tables dans Base.metadata
from core_layer.database import Base, engine
from routes_layer.pv_routes import router as pv_router

# Configure logging explicitement (fonctionne même si Uvicorn a déjà initialisé le root logger)
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": "ext://sys.stdout",
        }
    },
    "root": {"level": "INFO", "handlers": ["console"]},
    "loggers": {
        "uvicorn": {"level": "INFO", "propagate": True},
        "uvicorn.error": {"level": "INFO", "propagate": True},
        "uvicorn.access": {"level": "INFO", "propagate": True},
    },
})

logger = logging.getLogger(__name__)

Path("data").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Préchargement SmolVLM au démarrage — le modèle reste en mémoire pour toutes les requêtes
    # Exécuté dans un thread pour ne pas bloquer la boucle asyncio
    logger.info("Préchargement SmolVLM au démarrage du serveur...")
    import asyncio as _asyncio
    try:
        from services_layer.smolvlm_service import _load_once
        await _asyncio.to_thread(_load_once)
        logger.info("SmolVLM prêt.")
    except Exception as exc:
        logger.error("Échec préchargement SmolVLM : %s", exc, exc_info=True)
    yield
    logger.info("Arrêt du serveur.")


app = FastAPI(title="PV Automation API - Version IA Avancee", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pv_router)  # ← manquant !


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.monotonic()
    logger.info("→ %s %s", request.method, request.url.path)  # ← ajoute cette ligne
    response = await call_next(request)
    elapsed = time.monotonic() - start
    logger.info(
        "%s %s → %d  (%.3fs)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
    )
    return response

def wait_for_db(retries=10, delay=3):
    for i in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("✓ PostgreSQL prêt")
            return
        except OperationalError:
            print(f"⏳ Attente PostgreSQL... ({i+1}/{retries})")
            time.sleep(delay)
    raise RuntimeError("❌ PostgreSQL inaccessible")

wait_for_db()
Base.metadata.create_all(bind=engine)
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
