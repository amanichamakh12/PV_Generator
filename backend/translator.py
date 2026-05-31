
from deep_translator import GoogleTranslator


text = "comité des risques"
translated = GoogleTranslator(source='fr', target='ar').translate(text)
print(translated)