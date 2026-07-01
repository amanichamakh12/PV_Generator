workspace "PV Generator - Schéma Base de Données" "Diagramme de classe global de la base de données" {

    model {

        pvSystem = softwareSystem "PV Generator" "Système de génération automatique de PV de réunion à partir de présentations PPTX" {

            database = container "Base de Données" "Persistance de toutes les données du workflow" "SQLite / PostgreSQL — SQLAlchemy ORM" "Database" {

                # ── Entité racine ──────────────────────────────────────────
                pvSessions = component "pv_sessions" "Session principale — cycle de vie d'un fichier PPTX\n──────────────────────────────\nPK  id            INTEGER\n    filename      VARCHAR(255)\n    status        VARCHAR(50)\n    nb_slides     INTEGER\n    nb_slides_vides INTEGER\n    nb_graphiques_natifs INTEGER\n    nb_images_ocr INTEGER\n    created_at    DATETIME\n    updated_at    DATETIME" "Table" {
                    tags "Entity" "Root"
                }

                # ── Extraction PPTX ────────────────────────────────────────
                slides = component "slides" "Diapositives extraites du PPTX\n──────────────────────────────\nPK  id              INTEGER\nFK  session_id      INTEGER\n    slide_number    INTEGER\n    titre           TEXT\n    contenu         TEXT\n    is_empty        BOOLEAN\n    has_native_chart BOOLEAN\n    is_ocr_candidate BOOLEAN\n    agenda_item_index INTEGER" "Table" {
                    tags "Entity" "Extraction"
                }

                slideCharts = component "slide_charts" "Graphiques extraits des diapositives\n──────────────────────────────\nPK  id                INTEGER\nFK  slide_id          INTEGER\n    chart_type        VARCHAR(50)\n    chart_title       TEXT\n    chart_data        JSON\n    confidence_score  FLOAT\n    extraction_method VARCHAR(50)\n    image_path        TEXT" "Table" {
                    tags "Entity" "Extraction"
                }

                slideTables = component "slide_tables" "Tableaux extraits des diapositives\n──────────────────────────────\nPK  id              INTEGER\nFK  slide_id        INTEGER\n    table_data      JSON\n    position_index  INTEGER" "Table" {
                    tags "Entity" "Extraction"
                }

                # ── Analyse ────────────────────────────────────────────────
                agendaItems = component "agenda_items" "Points de l'ordre du jour\n──────────────────────────────\nPK  id                INTEGER\nFK  session_id        INTEGER\n    ordre             INTEGER\n    titre             TEXT\n    analysis          TEXT\n    key_findings      JSON\n    identified_risks  JSON\n    suggested_actions JSON" "Table" {
                    tags "Entity" "Analysis"
                }

                # ── Réunion ────────────────────────────────────────────────
                participants = component "participants" "Participants à la réunion\n──────────────────────────────\nPK  id          INTEGER\nFK  session_id  INTEGER\n    nom         VARCHAR(200)\n    role        VARCHAR(100)\n    presence    VARCHAR(20)" "Table" {
                    tags "Entity" "Meeting"
                }

                meetingNotes = component "meeting_notes" "Notes prises durant la réunion\n──────────────────────────────\nPK  id                  INTEGER\nFK  session_id          INTEGER\n    participant         VARCHAR(200)\n    content             TEXT\n    agenda_item_index   INTEGER\n    created_at          DATETIME" "Table" {
                    tags "Entity" "Meeting"
                }

                # ── PV généré ──────────────────────────────────────────────
                pvDrafts = component "pv_drafts" "Brouillons / versions du PV généré\n──────────────────────────────\nPK  id            INTEGER\nFK  session_id    INTEGER\n    titre         TEXT\n    date_reunion  DATE\n    introduction  TEXT\n    comite_type   VARCHAR(100)\n    language      VARCHAR(10)\n    version       INTEGER\n    is_final      BOOLEAN\n    created_at    DATETIME" "Table" {
                    tags "Entity" "PV"
                }

                pvPoints = component "pv_points" "Points du PV liés à l'ordre du jour\n──────────────────────────────\nPK  id              INTEGER\nFK  draft_id        INTEGER\nFK  agenda_item_id  INTEGER\n    titre           TEXT\n    discussion      TEXT\n    conclusion      TEXT\n    remarques       TEXT\n    ordre           INTEGER" "Table" {
                    tags "Entity" "PV"
                }

                decisions = component "decisions" "Décisions extraites des points du PV\n──────────────────────────────\nPK  id           INTEGER\nFK  point_id     INTEGER\n    contenu      TEXT\n    responsable  VARCHAR(200)\n    echeance     DATE" "Table" {
                    tags "Entity" "PV"
                }

                actionItems = component "action_items" "Plan d'action — suivi des tâches\n──────────────────────────────\nPK  id           INTEGER\nFK  point_id     INTEGER\n    action       TEXT\n    responsable  VARCHAR(200)\n    echeance     DATE\n    statut       VARCHAR(50)" "Table" {
                    tags "Entity" "PV"
                }

                # ── Sorties ────────────────────────────────────────────────
                translations = component "translations" "Versions traduites du PV\n──────────────────────────────\nPK  id                  INTEGER\nFK  draft_id            INTEGER\n    target_language     VARCHAR(10)\n    translated_content  JSON\n    created_at          DATETIME" "Table" {
                    tags "Entity" "Output"
                }

                exports = component "exports" "Historique des fichiers DOCX générés\n──────────────────────────────\nPK  id          INTEGER\nFK  draft_id    INTEGER\n    file_path   TEXT\n    language    VARCHAR(10)\n    created_at  DATETIME" "Table" {
                    tags "Entity" "Output"
                }

                # ── Relations (clés étrangères) ────────────────────────────
                slides       -> pvSessions  "session_id  [1..N]"
                slideCharts  -> slides      "slide_id    [1..N]"
                slideTables  -> slides      "slide_id    [1..N]"
                agendaItems  -> pvSessions  "session_id  [1..N]"
                participants -> pvSessions  "session_id  [1..N]"
                meetingNotes -> pvSessions  "session_id  [1..N]"
                pvDrafts     -> pvSessions  "session_id  [1..N]"
                pvPoints     -> pvDrafts    "draft_id    [1..N]"
                pvPoints     -> agendaItems "agenda_item_id [0..N]"
                decisions    -> pvPoints    "point_id    [1..N]"
                actionItems  -> pvPoints    "point_id    [1..N]"
                translations -> pvDrafts    "draft_id    [1..N]"
                exports      -> pvDrafts    "draft_id    [1..N]"
            }
        }
    }

    views {

        component database "ClassDiagram_Global" "Diagramme de classe global — Base de données PV Generator" {
            include *
            autolayout lr 120 60
        }

        # Vue partielle : Extraction PPTX
        component database "ClassDiagram_Extraction" "Vue — Extraction PPTX" {
            include pvSessions
            include slides
            include slideCharts
            include slideTables
            autolayout lr 100 50
        }

        # Vue partielle : Génération du PV
        component database "ClassDiagram_PV" "Vue — Génération du PV" {
            include pvSessions
            include agendaItems
            include pvDrafts
            include pvPoints
            include decisions
            include actionItems
            autolayout lr 100 50
        }

        # Vue partielle : Sorties
        component database "ClassDiagram_Outputs" "Vue — Traduction et Export" {
            include pvDrafts
            include translations
            include exports
            autolayout lr 100 50
        }

        styles {

            element "Database" {
                shape Cylinder
                background #1e293b
                color #f8fafc
            }

            # Entité racine
            element "Root" {
                shape RoundedBox
                background #1d4ed8
                color #ffffff
                border #1e40af
                fontSize 13
            }

            # Extraction
            element "Extraction" {
                shape RoundedBox
                background #0369a1
                color #ffffff
                border #075985
                fontSize 12
            }

            # Analyse agenda
            element "Analysis" {
                shape RoundedBox
                background #7c3aed
                color #ffffff
                border #6d28d9
                fontSize 12
            }

            # Réunion
            element "Meeting" {
                shape RoundedBox
                background #059669
                color #ffffff
                border #047857
                fontSize 12
            }

            # PV généré
            element "PV" {
                shape RoundedBox
                background #d97706
                color #ffffff
                border #b45309
                fontSize 12
            }

            # Sorties
            element "Output" {
                shape RoundedBox
                background #dc2626
                color #ffffff
                border #b91c1c
                fontSize 12
            }

            relationship "Relationship" {
                color #64748b
                fontSize 11
                style dashed
            }
        }

        terminology {
            softwareSystem "Système"
            container "Conteneur"
            component "Table"
            relationship "Clé étrangère"
        }
    }
}
