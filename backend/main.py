"""FastAPI app bootstrap for PV backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.pv_routes import router as pv_router

# Initialisation des modèles ML au démarrage
try:
    from pptx_parser import chart_detector

    print("🤖 Modèles IA chargés avec succès")
except Exception as e:
    print(f"⚠️  Erreur lors du chargement des modèles IA: {e}")
    chart_detector = None

app = FastAPI(title="PV Automation API - Version IA Avancée")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pv_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)