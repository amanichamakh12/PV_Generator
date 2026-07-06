"""
Benchmark comparatif de 3 modeles Ollama (qwen2.5:3b, qwen2.5:7b, qwen3:4b)
sur des cas d'usage reels du pipeline PV Generator : analyse par ordre du
jour et reformulation de notes.

Usage :
    python run_benchmark_llm.py

Resultats generes :
    - results_llm.csv   : detail (modele x cas de test) avec temps, validite
                          du schema JSON, sortie brute complete
    - summary_llm.csv   : moyennes par modele (temps, taux de conformite)

Les sorties brutes completes sont a relire manuellement pour la
comparaison QUALITATIVE (fidelite au ton demande, absence d'inventions,
respect de la consigne "pas de liste a puces", etc.) -- ce script mesure
ce qui est mesurable automatiquement (temps, conformite du JSON), mais
la qualite redactionnelle reste a juger a la lecture, comme on l'a fait
pour SmolVLM.
"""

import json
import time
import re
import ollama
import pandas as pd

MODELS = ["qwen2.5:3b", "qwen2.5:7b", "qwen3:4b"]

TEST_CASES_FILE = "test_cases.json"
RESULTS_CSV = "results_llm.csv"
SUMMARY_CSV = "summary_llm.csv"


def call_model(model: str, system_prompt: str, user_prompt: str, options: dict | None = None, fmt: str | None = None):
    """Appelle un modele Ollama et mesure le temps de reponse.

    options/fmt reproduisent les parametres reels utilises en production
    (cf. generate_pv_draft.py::_post_ollama_json et
    pv_routes.py::reformulate_agenda_notes) pour comparer les modeles
    dans les memes conditions d'appel que le pipeline.
    """
    start = time.perf_counter()
    kwargs = {}
    if options:
        kwargs["options"] = options
    if fmt:
        kwargs["format"] = fmt
    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        **kwargs,
    )
    elapsed = time.perf_counter() - start
    return response["message"]["content"], round(elapsed, 2)


def clean_output(text: str) -> str:
    """Retire les balises <think> (Qwen3) pour une lecture qualitative propre."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()


def try_parse_json(raw: str):
    """Tente d'extraire et parser un objet JSON depuis la sortie brute du modele."""
    text = raw.strip()
    text = re.sub(r"^```json\s*|\s*```$", "", text)
    # certains modeles (notamment qwen3, mode "thinking") ajoutent des balises
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


def schema_conformity(parsed: dict, expected_keys: list) -> float:
    """Pourcentage de cles attendues effectivement presentes dans le JSON produit."""
    if parsed is None:
        return 0.0
    present = sum(1 for k in expected_keys if k in parsed)
    return round(100 * present / len(expected_keys), 1)


def run():
    with open(TEST_CASES_FILE, "r", encoding="utf-8") as f:
        test_cases = json.load(f)

    rows = []

    for case_name, case in test_cases.items():
        print(f"\n=== Cas de test : {case_name} ({case['description']}) ===")
        for model in MODELS:
            print(f"  [{model}] en cours...")
            try:
                raw_output, elapsed = call_model(
                    model,
                    case["system_prompt"],
                    case["user_prompt"],
                    options=case.get("options"),
                    fmt=case.get("format"),
                )
            except Exception as exc:  # noqa: BLE001
                print(f"    -> ECHEC : {exc}")
                rows.append({
                    "cas_test": case_name,
                    "modele": model,
                    "temps_secondes": None,
                    "conformite_schema_pct": None,
                    "erreur": str(exc),
                    "sortie_brute": None,
                })
                continue

            raw_output = clean_output(raw_output)

            conformity = None
            if case["expected_keys"]:
                parsed = try_parse_json(raw_output)
                conformity = schema_conformity(parsed, case["expected_keys"])

            rows.append({
                "cas_test": case_name,
                "modele": model,
                "temps_secondes": elapsed,
                "conformite_schema_pct": conformity,
                "erreur": None,
                "sortie_brute": raw_output,
            })

    df = pd.DataFrame(rows)
    df.to_csv(RESULTS_CSV, index=False, encoding="utf-8-sig")
    print(f"\nResultats detailles enregistres dans {RESULTS_CSV}")
    print("-> Ouvre ce fichier pour comparer les sorties brutes cote a cote"
          " et juger la qualite redactionnelle (ton, fidelite, absence de listes...).")

    print("\n=== Resume par modele (temps moyen, conformite moyenne) ===")
    summary = df.groupby("modele").agg(
        temps_moyen_s=("temps_secondes", "mean"),
        conformite_moyenne_pct=("conformite_schema_pct", "mean"),
    ).round(2)
    print(summary.to_string())
    summary.to_csv(SUMMARY_CSV, encoding="utf-8-sig")
    print(f"\nResume enregistre dans {SUMMARY_CSV}")


if __name__ == "__main__":
    run()
