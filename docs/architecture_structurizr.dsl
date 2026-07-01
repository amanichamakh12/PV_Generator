workspace "PV Generator" "Architecture C4 du systeme de generation de PV" {

    model {
        user = person "Utilisateur metier" "Membre du comite ou redacteur qui importe les supports et genere le proces-verbal."

        pvGenerator = softwareSystem "PV Generator" "Automatise l'extraction PPTX, la generation, la fusion, la traduction et l'export DOCX d'un PV de comite." {
            frontend = container "Frontend Next.js" "Interface web de workflow : upload PPTX, verification, notes, generation, traduction et export." "Next.js, React, TypeScript"
            backend = container "Backend FastAPI" "API REST et orchestration des cas d'utilisation PV." "Python, FastAPI" {
                routes = component "routes_layer" "Controleurs HTTP FastAPI, validation des requetes et exposition des endpoints." "FastAPI routers"
                services = component "services_layer" "Cas d'utilisation : parsing, extraction, generation de brouillon, fusion, traduction, export." "Python services"
                repositories = component "repository_layer" "Acces aux donnees et operations CRUD." "SQLAlchemy repositories"
                models = component "models_layer" "Schemas Pydantic et modeles ORM." "Pydantic, SQLAlchemy ORM"
                core = component "core_layer" "Infrastructure technique partagee : connexion base, sessions SQLAlchemy, dependance FastAPI get_db." "SQLAlchemy"
                parsing = component "PPTX parsing pipeline" "Extraction des slides, titres, contenus, tableaux, notes, graphiques et images." "python-pptx"
                ai = component "AI/document pipeline" "Generation PV, fusion notes, traduction, OCR et analyse de graphiques." "Ollama, SmolVLM, OCR, python-docx"
            }
            database = container "PostgreSQL" "Persiste sessions, slides, agenda, notes, brouillons, decisions, actions, traductions et exports." "PostgreSQL 15" {
                tags "Database"
            }
            ollama = container "Ollama" "Runtime local pour les modeles LLM et vision appeles par le backend." "Ollama"
            modelFiles = container "Modeles locaux" "Fichiers de modeles montes dans le conteneur backend." "GGUF, SmolVLM, adapters"
        }

        user -> frontend "Utilise le workflow web"
        frontend -> backend "Appelle les endpoints REST" "HTTP/JSON, multipart upload"
        backend -> database "Lit/ecrit les donnees metier" "SQLAlchemy/PostgreSQL"
        backend -> ollama "Demande generation, reformulation, traduction et analyse vision" "HTTP"
        backend -> modelFiles "Charge les modeles locaux" "Filesystem mount"

        routes -> services "Delegue les cas d'utilisation"
        services -> repositories "Persiste et recupere les donnees"
        repositories -> models "Manipule les entites ORM"
        repositories -> core "Ouvre les sessions SQLAlchemy"
        models -> core "Partage la Base declarative"
        services -> parsing "Parse les fichiers PPTX"
        services -> ai "Orchestre IA, OCR, DOCX et traduction"
        ai -> ollama "Appels LLM/vision"
        ai -> modelFiles "Inference locale SmolVLM/LLM"

        deploymentEnvironment "Docker Compose local" {
            deploymentNode "Machine locale" "Poste de demonstration ou serveur local" {
                deploymentNode "Docker Compose" {
                    frontendInstance = containerInstance frontend
                    backendInstance = containerInstance backend
                    databaseInstance = containerInstance database
                    ollamaInstance = containerInstance ollama
                    modelFilesInstance = containerInstance modelFiles
                }
            }
        }
    }

    views {
        systemContext pvGenerator "SystemContext" {
            include *
            autolayout lr
        }

        container pvGenerator "Containers" {
            include *
            autolayout lr
        }

        component backend "BackendComponents" {
            include *
            autolayout lr
        }

        deployment pvGenerator "Docker Compose local" "Deployment" {
            include *
            autolayout lr
        }

        styles {
            element "Person" {
                shape person
                background #084c61
                color #ffffff
            }
            element "Software System" {
                background #177e89
                color #ffffff
            }
            element "Container" {
                background #3a7d44
                color #ffffff
            }
            element "Component" {
                background #f4a261
                color #000000
            }
            element "Database" {
                shape cylinder
            }
        }

        theme default
    }
}
