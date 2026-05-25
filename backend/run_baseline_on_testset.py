import json
from pathlib import Path

from baseline_qwen25vl import extract_chart


MANIFEST = Path("backend/chart_testset/manifest.jsonl")
OUT_PATH = Path("backend/chart_testset/predictions_qwen25vl_7b.jsonl")


def load_manifest():
    with MANIFEST.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


def main():
    rows = list(load_manifest())
    with OUT_PATH.open("w", encoding="utf-8") as f:
        for i, row in enumerate(rows, start=1):
            image = row["image"]
            print(f"[{i}/{len(rows)}] {image}")
            try:
                prediction = extract_chart(image)
                error = None
            except Exception as exc:
                prediction = None
                error = str(exc)

            f.write(
                json.dumps(
                    {
                        "image": image,
                        "expected": row["expected"],
                        "prediction": prediction,
                        "error": error,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
            f.flush()

    print(f"Predictions: {OUT_PATH}")


if __name__ == "__main__":
    main()