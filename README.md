# AI PV Comité — Générateur de Procès-Verbaux de Comité des Risques

Application interne pour automatiser la rédaction des procès-verbaux (PV) de comité des risques bancaire à partir de présentations PowerPoint. Le pipeline extrait le contenu des slides (texte, tableaux, graphiques), fait analyser les graphiques par un modèle de vision, rédige un brouillon de PV via LLM, permet la relecture/validation humaine, ajoute les notes de séance, puis exporte le PV final en `.docx` — en français et en arabe.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Démarrage rapide (Docker)](#démarrage-rapide-docker)
- [Développement local (sans Docker)](#développement-local-sans-docker)
- [Variables d'environnement](#variables-denvironnement)
- [Aperçu de l'API](#aperçu-de-lapi)
- [Notes de performance](#notes-de-performance)
- [Sécurité](#sécurité)

## Fonctionnalités

- **Extraction PPTX** : parsing des slides (texte, tableaux, images, graphiques natifs) via `python-pptx`.
- **Analyse de graphiques (chart OCR)** : plusieurs backends interchangeables pour transformer un graphique image en données structurées (`type`, `titre`, `data`) :
  - **SmolVLM** fine-tuné (LoRA) localement sur des graphiques bancaires — modèle par défaut, tourne en local (CPU/GPU).
  - **Groq** (API vision, modèle `llama-4-scout`) et **Ollama vision** (`qwen2.5vl`, `moondream`) en alternatives.
- **Rédaction assistée par LLM**, en deux temps :
  1. Un paragraphe par slide, rédigé par un petit modèle local via `llama-cpp-python` (Qwen2.5-1.5B quantisé GGUF).
  2. Une synthèse par point d'ordre du jour (constats, risques, actions, paragraphe de PV), générée par un modèle plus grand via **Ollama** (Qwen2.5-7B par défaut).
  - Repli heuristique (templates, sans LLM) si le modèle est indisponible ou hors-service — le pipeline ne bloque jamais.
- **Workflow de relecture** en plusieurs étapes côté frontend : import → extraction → analyse par ordre du jour → génération du brouillon → notes de séance → traduction → PV final.
- **Traduction FR → AR** avec glossaire de finance islamique (IFSB), via Ollama.
- **Export DOCX** du brouillon et du PV final (français et arabe).
- **Persistance** complète des sessions, ordres du jour, slides, tableaux/graphiques et notes en base PostgreSQL (SQLAlchemy + Alembic).

## Architecture

```
┌──────────────┐      REST/JSON      ┌───────────────────┐
│   Frontend    │ ──────────────────▶ │      Backend       │
│  Next.js 16   │ ◀────────────────── │     FastAPI         │
│ (port 3000)   │                     │    (port 8000)      │
└──────────────┘                     └─────────┬───────────┘
                                                 │
                        ┌────────────────────────┼────────────────────────┐
                        │                        │                        │
                 ┌──────▼──────┐         ┌───────▼────────┐      ┌────────▼────────┐
                 │ PostgreSQL  │         │  Ollama (7B)     │      │ llama.cpp (1.5B) │
                 │  (sessions, │         │  agenda analysis │      │  + SmolVLM local  │
                 │ slides, PV) │         │  + traduction     │      │  paragraphe/slide │
                 └─────────────┘         └──────────────────┘      │  + chart OCR       │
                                                                    └────────────────────┘
```

Le backend est organisé en couches :

- `routes_layer/` — endpoints FastAPI (HTTP <-> services).
- `services_layer/` — logique métier (parsing, extraction, brouillon, traduction, fusion des notes...).
- `repository_layer/` — accès base de données (SQLAlchemy).
- `models_layer/` — modèles ORM et DTO (Pydantic).
- `core_layer/` — configuration base de données / moteur SQLAlchemy.
- `Graph/` — parsing et OCR spécifique aux graphiques PPTX.
- `IA_modeles/` — poids des modèles locaux (SmolVLM, GGUF Qwen2.5).

## Stack technique

| Domaine | Technologies |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| IA texte | llama-cpp-python (Qwen2.5-1.5B GGUF, local), Ollama (Qwen2.5-7B) |
| IA vision | SmolVLM (LoRA fine-tuné, local, `transformers`/`torch`), Groq API, Ollama vision |
| Traitement PPTX/DOCX | `python-pptx`, `python-docx` |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/Radix UI |
| Infra | Docker Compose (backend, frontend, Ollama, PostgreSQL) |

## Structure du projet

```
PV generator/
├── backend/
│   ├── main.py                  # bootstrap FastAPI
│   ├── generate_pv_draft.py     # pipeline de rédaction (slide → paragraphe, ordre du jour → analyse)
│   ├── Pv_Generator.py          # pipeline alternatif/historique (Anthropic)
│   ├── docX.py                  # génération du .docx
│   ├── ocr.py
│   ├── routes_layer/            # endpoints FastAPI
│   ├── services_layer/          # logique métier
│   ├── repository_layer/        # accès base de données
│   ├── models_layer/            # ORM + DTO
│   ├── core_layer/               # config DB
│   ├── Graph/                    # parsing/OCR des graphiques PPTX
│   ├── IA_modeles/                # poids des modèles locaux (SmolVLM, GGUF)
│   └── alembic/                  # migrations base de données
├── front/risk-committee-pv-generation/
│   ├── app/                      # routes Next.js (App Router)
│   ├── components/workflow/steps/  # étapes du workflow (upload, extract, agenda-analysis,
│   │                                # draft-generation, meeting-notes, translation, final-pv)
│   ├── contexts/workflow-context.tsx  # état global du workflow
│   └── types/                    # types partagés (AgendaItem, Slide, PVDocument...)
├── dataset_finetuning/           # dataset utilisé pour le fine-tuning de SmolVLM (hors pipeline applicatif)
├── docs/                         # documentation d'architecture (Structurizr, schéma DB)
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Démarrage rapide (Docker)

Le moyen le plus simple de lancer l'ensemble (backend + frontend + Ollama + PostgreSQL).

### Prérequis

- Docker Desktop (ou Docker Engine + plugin Docker Compose)

### Lancement

1. Créer le fichier d'environnement local :

   ```bash
   cp .env.example .env
   ```

   Puis renseigner vos propres valeurs (voir [Variables d'environnement](#variables-denvironnement)) — **ne jamais commiter de vraies clés API**.

2. Démarrer tous les services :

   ```bash
   docker compose up --build -d
   ```

   Lanceurs one-command équivalents :

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-client.ps1
   ```

   ```bat
   start-client.cmd
   ```

   ```bash
   ./start-client.sh
   ```

3. Ouvrir l'application :
   - Frontend : `http://localhost:3000`
   - Santé du backend : `http://localhost:8000/api/health`

### Pré-télécharger les modèles Ollama (recommandé au premier lancement)

```bash
docker compose --profile init up ollama-init
```

Les modèles utilisés sont définis via `OLLAMA_MODEL` et `OLLAMA_VISION_MODEL` dans `.env`.

### Mode production (tags figés + limites de ressources)

1. Créer le fichier d'environnement de production :

   ```bash
   cp .env.prod.example .env.prod
   ```

2. Démarrer en mode production :

   ```bash
   docker compose --env-file .env --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up --build -d
   ```

   Lanceurs équivalents : `start-client.ps1 -Production`, `start-client-prod.cmd`, `./start-client.sh --prod`.

### Logs et dépannage

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f ollama
```

Si le frontend n'arrive pas à joindre le backend, vérifier que `NEXT_PUBLIC_API_BASE_URL` vaut bien `http://localhost:8000` dans `.env`.

### Arrêt / nettoyage

```bash
docker compose down
```

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-client.ps1
```

Pour supprimer aussi les volumes (dont les modèles Ollama en cache) :

```bash
docker compose down -v
```

## Développement local (sans Docker)

Utile pour itérer rapidement sur le backend ou le frontend sans reconstruire d'image à chaque changement.

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py     # sert l'API sur http://0.0.0.0:8000 (uvicorn, reload=False)
```

Le backend a besoin d'une base PostgreSQL accessible (`DATABASE_URL`) et, en option, d'un serveur **Ollama** local (`http://localhost:11434`) pour la synthèse par ordre du jour et la traduction. Les modèles locaux (SmolVLM, Qwen2.5-1.5B GGUF) sont chargés depuis `backend/IA_modeles/`.

### Frontend

```bash
cd front/risk-committee-pv-generation
npm install
npm run dev     # http://localhost:3000
```

## Variables d'environnement

Définies dans `.env` (voir `.env.example` pour le gabarit) :

| Variable | Rôle |
|---|---|
| `OLLAMA_MODEL` | Modèle Ollama utilisé pour la synthèse par ordre du jour et la traduction (ex. `qwen2.5:7b`) |
| `OLLAMA_VISION_MODEL` | Modèle Ollama vision utilisé comme alternative pour l'analyse de graphiques |
| `OLLAMA_NUM_GPU` | Nombre de couches déchargées sur GPU par Ollama (mettre à `0` si CPU uniquement) |
| `LLAMA_MODEL_PATH` | Chemin vers le GGUF Qwen2.5-1.5B (paragraphe par slide, via `llama-cpp-python`) |
| `SMOLVLM_MODEL_PATH` / `SMOLVLM_ADAPTER_PATH` | Chemins vers le modèle de base SmolVLM et l'adaptateur/modèle fusionné fine-tuné |
| `GROQ_API_KEY*` | Clé(s) API Groq, utilisées comme backend alternatif d'analyse de graphiques |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `NEXT_PUBLIC_API_BASE_URL` | URL de base de l'API, utilisée par le frontend |

> ⚠️ Voir la section [Sécurité](#sécurité) — des clés réelles ont été trouvées commitées dans ce dépôt, à faire tourner immédiatement.

## Aperçu de l'API

Principaux endpoints exposés par le backend (`backend/routes_layer/pv_routes.py`) :

| Domaine | Endpoints |
|---|---|
| Santé | `GET /api/health` |
| Sessions | `GET/POST/DELETE /api/sessions`, `PATCH /api/sessions/{id}/status` |
| Extraction PPTX | `POST /api/parse-pptx`, `POST /api/parse-pptx/fast`, `POST /api/parse-pptx/images-stream`, `PUT /api/update-extraction` |
| Analyse d'images/graphiques | `POST /api/analyze-image/smolvlm`, `PATCH /api/slide-charts/{id}`, `PATCH /api/slide-tables/{id}` |
| Rédaction du brouillon | `POST /api/test-slide-paragraph`, `POST /api/analyze-agenda-full`, `POST /api/generate-draft`, `POST /api/generate-pv-from-pptx`, `POST /api/test-draft-pipeline` |
| Notes de séance | `POST/GET/PATCH/DELETE /api/meeting-notes`, `POST /api/reformulate-note`, `POST /api/reformulate-agenda-notes`, `POST /api/merge-notes` |
| PV final | `POST /api/sessions/{id}/final-pv`, `POST /api/sessions/{id}/assemble-final-pv`, `POST /api/export-docx` |
| Traduction | `POST /api/translate`, `POST /api/sessions/{id}/translations` |

## Notes de performance

Le pipeline IA est conçu pour tourner sans GPU, avec repli heuristique systématique en cas d'échec ou d'indisponibilité d'un modèle :

- Sur une machine CPU uniquement, un modèle 7B (Ollama) tourne à titre indicatif autour de 5-7 tokens/s — préférer un modèle plus petit (`qwen3:4b`, Qwen2.5-1.5B via `llama-cpp-python`) si la latence est critique, au prix d'une qualité de rédaction un peu plus faible sur les analyses complexes.
- SmolVLM doit être chargé comme modèle **fusionné** (LoRA + base mergés via `peft.merge_and_unload()`), pas comme adaptateur seul — sinon `transformers`/`peft` réappliquent l'adaptateur à chaque appel, ce qui ralentit fortement l'inférence.
- Penser à configurer `torch.set_num_threads()` / `OMP_NUM_THREADS` / `MKL_NUM_THREADS` sur le nombre de cœurs disponibles pour l'inférence CPU (SmolVLM et llama.cpp).

## Sécurité

⚠️ **Action requise** : ce dépôt ne contient pas de `.gitignore`, et le fichier `.env` (avec de vraies clés `GROQ_API_KEY1`/`GROQ_API_KEY2`) est actuellement suivi par Git — `.env.example` contient lui aussi une clé Groq en clair. Si ce dépôt a déjà été poussé vers un remote partagé :

1. Révoquer/regénérer immédiatement ces clés Groq.
2. Ajouter un `.gitignore` excluant `.env`, `node_modules/`, `__pycache__/`, et les poids de modèles volumineux (`backend/IA_modeles/`).
3. Retirer `.env` du suivi Git (`git rm --cached .env`) et purger l'historique si le dépôt a déjà été partagé.
4. Ne garder que des valeurs d'exemple factices dans `.env.example` / `.env.prod.example`.
