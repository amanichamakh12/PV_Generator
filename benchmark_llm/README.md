# Benchmark comparatif — Modèles de langage (Ollama)

Compare `qwen2.5:3b`, `qwen2.5:7b` et `qwen3:4b` sur deux cas d'usage
réels du pipeline PV Generator : l'analyse par ordre du jour (PVG-25) et
la reformulation de notes (PVG-45).

## Installation

```bash
pip install ollama pandas --break-system-packages
```

Les 3 modèles doivent déjà être installés (`ollama list` pour vérifier) :
```bash
ollama pull qwen2.5:3b
ollama pull qwen2.5:7b
ollama pull qwen3:4b
```

## ⚠️ Avant de lancer : adapte les prompts à tes VRAIS prompts système

Le fichier `test_cases.json` contient des prompts **reconstitués** à partir
des descriptions qu'on a documentées dans le rapport (schéma JSON, ton
administratif...). **Remplace `system_prompt` par le texte exact** de tes
fichiers `generate_pv_draft.py` / `pv_routes.py` pour que la comparaison
soit fidèle à ton vrai système, pas à une reconstitution approximative.

## Lancer le benchmark

```bash
python run_benchmark_llm.py
```

## Résultats générés

- **`results_llm.csv`** — détail complet (modèle × cas de test) : temps de
  réponse, % de conformité au schéma JSON attendu (pour le cas
  "analyse_odj"), et la **sortie brute intégrale** de chaque modèle.
- **`summary_llm.csv`** — moyennes par modèle (temps moyen, conformité
  moyenne), directement réutilisables dans le tableau du rapport.

## Ce que le script mesure automatiquement vs ce qui reste à juger à l'œil

| Mesuré automatiquement | À évaluer manuellement (lire `results_llm.csv`) |
|---|---|
| Temps de réponse | Qualité rédactionnelle, fidélité du ton administratif |
| % de clés JSON attendues présentes (cas "analyse_odj") | Absence d'inventions non présentes dans les notes |
| — | Respect de la consigne "pas de liste à puces" (cas "reformulation") |
| — | Présence de balises parasites (`<think>`, artefacts de langue) |

C'est volontairement la même logique que pour le benchmark des modèles de
vision (SmolVLM) : le script donne des chiffres exploitables, mais la
lecture des sorties reste nécessaire pour un jugement qualitatif honnête.

## Exemple de tableau à produire pour le rapport

| Modèle | Temps moyen (s) | Conformité JSON (%) |
|---|---|---|
| qwen2.5:3b | ... | ... |
| qwen2.5:7b | ... | ... |
| qwen3:4b | ... | ... |

Remplis ce tableau avec les vraies valeurs de `summary_llm.csv` une fois
le script exécuté.
