# Architecture du systeme PV Generator apres organisation

## 1. Objectif fonctionnel

PV Generator automatise la production d'un proces-verbal de comite a partir d'une presentation PowerPoint et de notes de reunion. Le systeme couvre le cycle suivant :

1. Importer un fichier PPTX.
2. Extraire les slides, titres, tableaux, graphiques et images.
3. Analyser les graphiques avec OCR, modele vision ou LLM local.
4. Structurer l'ordre du jour, les notes, les decisions et les actions.
5. Generer un brouillon de PV.
6. Fusionner les notes de reunion avec le PV.
7. Traduire et exporter le resultat en DOCX.
8. Persister les sessions et donnees intermediaires en base PostgreSQL.

## 2. Organisation du code

La structure conserve le regroupement par couches deja present et ajoute une couche technique explicite.

```text
PV generator/
├── backend/
│   ├── core_layer/              # Infrastructure technique partagee
│   │   └── database.py           # Engine SQLAlchemy, SessionLocal, Base, get_db
│   ├── routes_layer/             # API FastAPI et controleurs HTTP
│   ├── services_layer/           # Cas d'utilisation metier et orchestration
│   ├── repository_layer/         # Acces aux donnees et operations CRUD
│   ├── models_layer/             # Schemas Pydantic et modeles ORM SQLAlchemy
│   ├── Graph/                    # Pipeline actif d'analyse de graphiques
│   ├── alembic/                  # Migrations de schema base de donnees
│   ├── modeles/                  # Modeles IA montes dans Docker
│   ├── main.py                   # Bootstrap FastAPI
│   ├── Pv_Generator.py           # Generation/fusion/export PV legacy encore utilise
│   ├── generate_pv_draft.py      # Pipeline de generation du brouillon
│   ├── pptx_parser_chartLlama.py # Parsing PPTX actif
│   └── docX.py                   # Construction DOCX active
├── front/risk-committee-pv-generation/
│   ├── app/                      # Application Next.js
│   ├── components/               # Composants UI et etapes workflow
│   ├── contexts/                 # Etat global du workflow
│   ├── hooks/                    # Hooks React
│   ├── lib/                      # Fonctions client et appels API
│   ├── public/                   # Assets statiques
│   └── types/                    # Types TypeScript
├── docs/
│   ├── architecture_soutenance.md
│   ├── architecture_structurizr.dsl
│   └── database_schema.dsl
├── docker-compose.yml
├── docker-compose.prod.yml
└── trash/                        # Elements conserves mais sortis du code actif
```

## 3. Role des couches backend

### routes_layer

Responsabilite : exposer les endpoints HTTP FastAPI et convertir les requetes front en appels applicatifs.

Exemples :

- Upload et parsing PPTX.
- Analyse agenda.
- Analyse image avec SmolVLM.
- Gestion des sessions.
- Generation de brouillon PV.
- Fusion notes/PV.
- Traduction et export.

Cette couche doit rester mince : validation HTTP, codes d'erreur, streaming, fichiers temporaires, puis delegation vers `services_layer`.

### services_layer

Responsabilite : porter les cas d'utilisation du systeme. Elle orchestre les traitements, appelle les repositories et les modules IA.

Services principaux :

- `pv_service.py` : facade applicative qui regroupe les operations PV.
- `parsing_service.py` : validation et parsing PPTX.
- `draft_service.py` : generation de brouillon et construction DOCX.
- `merge_service.py` : fusion des notes avec le PV.
- `document_service.py` : export DOCX et health check.
- `extraction_service.py` : persistance des elements extraits des slides.
- `translation_service.py` : traduction.
- `reformulate_service.py` : nettoyage/reformulation des reponses IA.
- `smolvlm_service.py` : chargement et inference du modele vision local.

### repository_layer

Responsabilite : isoler l'acces a la base de donnees. Les services ne manipulent pas directement les details CRUD partout dans le code.

Repositories :

- `session_repository.py` : sessions de travail.
- `agenda_repository.py` : points d'ordre du jour.
- `slide_repository.py` : slides, tableaux et graphiques.
- `note_repository.py` : notes de reunion.
- `draft_repository.py` : brouillons, participants, decisions, actions, traductions et exports.
- `pv_repository.py` : documents PV historiques.
- `base_repository.py` : operations generiques.

### models_layer

Responsabilite : definir les contrats de donnees.

- `orm_models.py` : tables SQLAlchemy relationnelles.
- `models.py` : schemas Pydantic utilises par l'API et quelques modeles historiques.

### core_layer

Nouvelle couche ajoutee.

Responsabilite : isoler l'infrastructure technique partagee du backend.

- `database.py` contient `DATABASE_URL`, `engine`, `SessionLocal`, `Base` et `get_db`.
- Les routes, repositories, modeles ORM et migrations importent maintenant la base depuis `core_layer.database`.

Interet pour la soutenance : la configuration technique est separee des couches metier. Cela clarifie la dependance descendante suivante :

`routes_layer -> services_layer -> repository_layer -> models_layer/core_layer`

## 4. Architecture logique

L'architecture logique est organisee autour de quatre blocs applicatifs :

1. Interface utilisateur
   - Application Next.js.
   - Workflow guide par etapes : upload, extraction, notes, generation, PV final, traduction.
   - Appels REST vers le backend.

2. API et orchestration
   - FastAPI expose les endpoints.
   - Les routes deleguent aux services.
   - Les services coordonnent parsing, IA, base de donnees et generation documentaire.

3. Domaine PV
   - Session de reunion.
   - Slides et elements extraits.
   - Ordre du jour.
   - Notes, decisions et actions.
   - Brouillon PV, PV final, traductions et exports.

4. Intelligence documentaire
   - Parsing PPTX.
   - OCR et extraction de graphiques.
   - LLM local via Ollama pour generation, reformulation et traduction.
   - SmolVLM local pour analyse visuelle specialisee.

## 5. Architecture technique

### Frontend

- Framework : Next.js.
- Langage : TypeScript / React.
- UI : composants React, Radix UI, lucide-react, Tailwind.
- Communication : `fetch` vers `NEXT_PUBLIC_API_BASE_URL`.
- Port Docker : `3000`.

### Backend

- Framework : FastAPI.
- Langage : Python.
- ORM : SQLAlchemy.
- Migrations : Alembic.
- Generation DOCX : `python-docx`.
- Parsing PPTX : `python-pptx`.
- OCR / image : Pillow, OpenCV, pytesseract.
- IA texte/vision :
  - Ollama pour modeles LLM/vision exposes sur `11434`.
  - SmolVLM charge localement au demarrage du backend.
  - Groq/API externe possible dans certains modules de pipeline, selon configuration.
- Port Docker : `8000`.

### Base de donnees

- SGBD : PostgreSQL 15 Alpine.
- Base : `PV_Generator`.
- Port : `5432`.
- Volume Docker : `postgres_data`.
- Acces applicatif : `core_layer.database`.

### Runtime IA

- Service Docker `ollama`.
- Port : `11434`.
- Volume Docker : `ollama_data`.
- Modeles configures par variables :
  - `OLLAMA_MODEL`
  - `OLLAMA_VISION_MODEL`
  - `LLAMA_MODEL_PATH`
  - `SMOLVLM_MODEL_PATH`
  - `SMOLVLM_ADAPTER_PATH`

### Deploiement

Le deploiement local cible Docker Compose avec quatre services principaux :

- `pv-db` : PostgreSQL.
- `ollama` : runtime des modeles locaux.
- `backend` : API FastAPI.
- `frontend` : application Next.js.

Un service optionnel `ollama-init` precharge les modeles.

## 6. Flux principal de donnees

1. L'utilisateur importe un fichier PowerPoint dans le frontend.
2. Le frontend appelle `/api/parse-pptx/fast`.
3. Le backend valide le fichier puis appelle le parser PPTX.
4. Les slides sont extraites : titres, contenu, tableaux, notes, graphiques et images.
5. Les graphiques/images sont analyses par OCR, Qwen/Ollama ou SmolVLM selon le chemin utilise.
6. Les elements extraits sont persistes via les repositories.
7. L'utilisateur enrichit les notes de reunion.
8. Le backend genere un brouillon de PV avec le LLM.
9. Les notes sont fusionnees avec le brouillon.
10. Le PV final est exporte en DOCX et, si demande, traduit.

## 7. Elements deplaces dans trash

Aucun fichier n'a ete supprime. Les elements suivants ont ete sortis du code actif :

- Artefacts generes : `__pycache__`, `.next`, `node_modules`, `tsconfig.tsbuildinfo`.
- Fichiers accidentels ou inutiles a la racine : `docker`, `netstat`, `package-lock.json` sans `package.json`.
- Scripts experimentaux ou non importes par le runtime : benchmarks, tests manuels, generation de dataset, anciens scripts OCR et traduction experimentale.
- Fichier vide : `backend/annotations.json`.

Le dossier `trash` garde ces fichiers recuperables en cas de besoin, sans polluer l'architecture active.

## 8. Points forts a presenter en soutenance

- Separation claire entre interface, API, services, persistence, modeles et infrastructure.
- Backend oriente cas d'utilisation : les routes deleguent aux services.
- Acces base centralise dans `core_layer.database`.
- Persistance relationnelle des sessions, slides, notes, decisions, actions et exports.
- Pipeline IA hybride : parsing structurel, OCR, vision model, LLM local.
- Deploiement reproductible avec Docker Compose.
- Organisation prudente : les fichiers inutilises sont conserves dans `trash`, pas supprimes.

## 9. Limites techniques a mentionner avec maturite

- Certains modules actifs historiques restent a la racine du backend (`Pv_Generator.py`, `generate_pv_draft.py`, `pptx_parser_chartLlama.py`, `docX.py`) parce qu'ils sont encore fortement appeles par les services. Une etape future serait de les decouper progressivement dans `services_layer` ou une couche dediee `ai_layer`.
- Le chargement SmolVLM au demarrage augmente le temps de boot mais reduit la latence des requetes d'analyse visuelle.
- Le systeme depend de modeles lourds et de ressources memoire importantes, d'ou l'interet de Docker Compose et des variables d'environnement.
