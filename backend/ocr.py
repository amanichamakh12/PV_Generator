import re
import numpy as np
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
import numpy as np
from PIL import Image
import io
# ocr.py
from PIL import Image, ImageEnhance, ImageFilter
import io
import numpy as np

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # Upscale 2x — biggest single improvement for small text
    w, h = img.size
    img = img.resize((w * 2, h * 2), Image.LANCZOS)
    
    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)
    
    # Boost contrast
    img = ImageEnhance.Contrast(img).enhance(1.5)

    return img
def extract_values(tokens):
    vals = []

    for t in tokens:
        # Skip low-confidence tokens
        if t["conf"] < 70:
            continue

        # Skip Y-axis (x < 20 in original coords, x < 40 after 2x upscale)
        if t["x"] < 40:
            continue

        txt = re.sub(r"\D", "", t["text"])
        if not txt:
            continue

        v = int(txt)

        if v % 100 == 0:
            continue

        if 1000 < v < 10000:
            vals.append((v, t["x"], t["y"]))

    return sorted(vals, key=lambda x: x[1])

def map_data(labels, values):
    # Sort values left-to-right (already sorted by x in extract_values)
    result = []
    for i in range(min(len(labels), len(values))):
        result.append({"label": labels[i], "value": values[i][0]})
    
    # Warn if counts don't match
    if len(labels) != len(values):
        print(f"⚠️ Mismatch: {len(labels)} labels vs {len(values)} values")
    
    return result

def validate(data):
    values = [d["value"] for d in data]

    if len(values) < 2:
        return False

    # ❌ valeurs toutes identiques
    if len(set(values)) == 1:
        return False

    # ❌ valeurs trop rondes → axe Y
    if all(v % 100 == 0 for v in values):
        return False

    return True



def get_ocr_tokens(image_bytes):
    img = preprocess_image(image_bytes)  # ← use preprocessed image
    img_np = np.array(img)

    data = pytesseract.image_to_data(
        img_np,
        output_type=pytesseract.Output.DICT,
        config="--psm 11 --oem 3"  # psm 11 = sparse text, finds all text freely
    )

    tokens = []
    for i in range(len(data["text"])):
        txt = data["text"][i].strip()
        if txt:
            tokens.append({
                "text": txt,
                "x": data["left"][i],
                "y": data["top"][i],
                "conf": data["conf"][i]
            })

    return tokens

def extract_pie_values(tokens):
    """Extract percentage values from pie chart OCR tokens."""
    vals = []

    for t in tokens:
        txt = t["text"].strip()
        # Match patterns like "11%", "11" near a % token
        match = re.match(r"^(\d{1,3})%?$", txt)
        if match:
            v = int(match.group(1))
            if 1 <= v <= 99:  # Valid percentage range
                vals.append((v, t["x"], t["y"]))

    # Validate: percentages should sum close to 100
    total = sum(v[0] for v in vals)
    if abs(total - 100) > 5:
        print(f"⚠️ Percentages sum to {total}, expected ~100")

    return vals


def extract_legend_labels(tokens):
    """Extract category labels from the legend area (bottom of image)."""
    # Legend is typically in the lower portion of the image
    all_ys = [t["y"] for t in tokens]
    if not all_ys:
        return []
    
    max_y = max(all_ys)
    legend_threshold = max_y * 0.65  # bottom 35% of image

    legend_tokens = [t for t in tokens if t["y"] > legend_threshold]

    # Group tokens into lines by Y proximity
    lines = []
    used = set()
    for i, t in enumerate(sorted(legend_tokens, key=lambda x: x["y"])):
        if i in used:
            continue
        line = [t]
        used.add(i)
        for j, t2 in enumerate(legend_tokens):
            if j not in used and abs(t2["y"] - t["y"]) < 12:
                line.append(t2)
                used.add(j)
        text = " ".join(tok["text"] for tok in sorted(line, key=lambda x: x["x"]))
        if text.strip():
            lines.append(text.strip())

    return lines