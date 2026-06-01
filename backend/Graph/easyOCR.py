import cv2
import easyocr
import numpy as np

def extract_chart_data(image_path: str) -> dict:
    reader = easyocr.Reader(['fr', 'en'], gpu=False)
    
    # Extrait TOUT le texte visible dans l'image
    results = reader.readtext(image_path)
    
    texts = []
    for (bbox, text, confidence) in results:
        if confidence > 0.5:
            texts.append({
                "text": text,
                "position": bbox[0],  # coordonnée [x, y]
                "confidence": round(confidence, 2)
            })
    
    return texts

if __name__ == "__main__":
    data = extract_chart_data(r"C:\Users\user\Downloads\Engagement.PNG")
    for item in data:
        print(f"{item['text']:20} | pos: {item['position']} | conf: {item['confidence']}")