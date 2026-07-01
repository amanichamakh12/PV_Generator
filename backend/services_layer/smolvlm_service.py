import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ.setdefault("OMP_NUM_THREADS", str(os.cpu_count() or 1))
os.environ.setdefault("MKL_NUM_THREADS", str(os.cpu_count() or 1))

import io, logging, time, threading, re
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForVision2Seq

torch.set_num_threads(os.cpu_count() or 1)

logger = logging.getLogger(__name__)

# smolvlm-graphes-v2-merged : LoRA fusionné dans les poids de base (via merge_and_unload),
# généré une fois pour toutes à partir de smolvlm-base + smolvlm-graphes-v2 (adapter).
MODEL_DIR = os.environ.get("SMOLVLM_ADAPTER_PATH", "IA_modeles/smolvlm-graphes-v2-merged")

PROMPT = """Analyse ce graphique et renvoie son contenu sous forme JSON.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après :
{
  "type": "<bar|pie|line|area|autre>",
  "titre": "<titre du graphique ou null>",
  "data": [
    {"category": "<étiquette>", "valeur": <nombre>}
  ]
}"""

_lock      = threading.Lock()
_processor = None
_model     = None


def _load_once():
    global _processor, _model
    if _model is None:
        # pas de lock — le semaphore dans la route garantit l'accès séquentiel
        t0 = time.monotonic()
        logger.info("Chargement SmolVLM depuis %s …", MODEL_DIR)
        _processor = AutoProcessor.from_pretrained(MODEL_DIR)
        _model = AutoModelForVision2Seq.from_pretrained(
            MODEL_DIR,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
        ).eval()
        logger.info("SmolVLM chargé en %.1fs", time.monotonic() - t0)
    return _processor, _model

def is_loaded() -> bool:
    return _model is not None


def analyze_image_bytes(image_bytes: bytes) -> str:
    t_total = time.monotonic()

    # ── Étape 1 : s'assurer que le modèle est chargé ────────────────────────
    t0 = time.monotonic()
    processor, model = _load_once()
    logger.info("[SmolVLM] ① modèle prêt      : %.3fs", time.monotonic() - t0)

    # ── Étape 2 : décodage image (PIL) ──────────────────────────────────────
    t0 = time.monotonic()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    logger.info("[SmolVLM] ② décodage image   : %.3fs  (%dx%d px, %.1f KB)",
                time.monotonic() - t0, image.width, image.height, len(image_bytes) / 1024)

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": PROMPT},
            ],
        }
    ]

    # ── Étape 3 : apply_chat_template ───────────────────────────────────────
    t0 = time.monotonic()
    text_input = processor.apply_chat_template(messages, add_generation_prompt=True)
    logger.info("[SmolVLM] ③ chat template     : %.3fs  (%d chars)", time.monotonic() - t0, len(text_input))

    # ── Étape 4 : processor (tokenisation + encoding image) ─────────────────
    t0 = time.monotonic()
    inputs = processor(
        text=[text_input],
        images=[image],
        return_tensors="pt",
    )
    n_tokens = inputs["input_ids"].shape[1]
    logger.info("[SmolVLM] ④ processor         : %.3fs  (%d tokens input)", time.monotonic() - t0, n_tokens)

    # ── Étape 5 : model.generate (inférence) ────────────────────────────────
    t0 = time.monotonic()
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=512,
            do_sample=False,
            temperature=None,
            top_p=None,
            repetition_penalty=1.05,
        )
    n_generated = output_ids.shape[1] - n_tokens
    t_gen = time.monotonic() - t0
    logger.info("[SmolVLM] ⑤ generate          : %.3fs  (%d tokens générés, %.1f tok/s)",
                t_gen, n_generated, n_generated / t_gen if t_gen > 0 else 0)

    # ── Étape 6 : décodage tokens → texte ───────────────────────────────────
    t0 = time.monotonic()
    generated = output_ids[0][n_tokens:]
    raw = processor.decode(generated, skip_special_tokens=True)
    logger.info("[SmolVLM] ⑥ décodage tokens  : %.3fs  (sortie brute: %r)", time.monotonic() - t0, raw[:120])

    # Couper proprement après le premier ]}
    end = raw.find("]}")
    if end != -1:
        raw = raw[:end + 2]

    logger.info("[SmolVLM] ✓ TOTAL             : %.3fs", time.monotonic() - t_total)
    return raw
