"""Translation service functions — version Ollama."""

import re

import requests

OLLAMA_MODEL = "qwen2.5:7b"
OLLAMA_URL="http://localhost:11434"  # URL de l'API Ollama
# Noms de langues lisibles pour le prompt
LANG_NAMES = {
    "ar": "arabe (langue financière et juridique formelle)",
    "en": "anglais",
}
#Dictionnaire de termes finance islamique selon la IFSB 
GLOSSARY = {
    # Gouvernance
    "comité des risques": "لجنة المخاطر",
    "comité de risque": "لجنة المخاطر",
    "direction des risques": "إدارة المخاطر",
    "conseil d'administration": "مجلس الإدارة",
    "président du conseil": "رئيس مجلس الإدارة",
    "administrateur": "عضو مجلس الإدارة",
    "administrateur indépendant": "عضو مجلس إدارة مستقل",
    "gouvernance": "الحوكمة",
    "gouvernance d'entreprise": "حوكمة الشركات",
    "audit interne": "التدقيق الداخلي",
    "audit externe": "التدقيق الخارجي",
    "contrôle interne": "الرقابة الداخلية",
    "conformité": "الامتثال",
    "gestion des risques": "إدارة المخاطر",
    "appétit pour le risque": "شهية المخاطر",
    "cadre de gestion des risques": "إطار إدارة المخاطر",

    # Réunions
    "quorum": "النصاب القانوني",
    "ordre du jour": "جدول الأعمال",
    "résolution": "قرار",
    "procès-verbal": "محضر الاجتماع",
    "assemblée générale": "الجمعية العامة",
    "réunion": "اجتماع",
    "vote": "تصويت",
    "approbation": "موافقة",

    # Comptabilité et finance
    "capitaux propres": "حقوق الملكية",
    "fonds propres": "الأموال الخاصة",
    "actif": "الأصول",
    "actifs": "الأصول",
    "passif": "الخصوم",
    "total du bilan": "إجمالي الميزانية",
    "état financier": "القوائم المالية",
    "bilan": "الميزانية",
    "compte de résultat": "قائمة الدخل",
    "flux de trésorerie": "التدفقات النقدية",
    "résultat net": "صافي الربح",
    "bénéfice": "ربح",
    "perte": "خسارة",
    "revenus": "الإيرادات",
    "charges": "المصروفات",
    "provisions": "المخصصات",

    # Exercice et reporting
    "exercice clos le": "السنة المالية المختومة في",
    "année financière": "السنة المالية",
    "rapport annuel": "التقرير السنوي",
    "rapport de gestion": "تقرير الإدارة",
    "états financiers audités": "القوائم المالية المدققة",

    # Finance islamique - général
    "finance islamique": "المالية الإسلامية",
    "banque islamique": "مصرف إسلامي",
    "institution financière islamique": "مؤسسة مالية إسلامية",
    "charia": "الشريعة الإسلامية",
    "conformité à la charia": "الالتزام بأحكام الشريعة",
    "conseil de la charia": "هيئة الرقابة الشرعية",
    "comité charia": "لجنة الرقابة الشرعية",
    "avis charia": "فتوى شرعية",
    "gouvernance charia": "الحوكمة الشرعية",

    # Contrats islamiques
    "mourabaha": "مرابحة",
    "murabaha": "مرابحة",
    "moucharaka": "مشاركة",
    "musharaka": "مشاركة",
    "moudaraba": "مضاربة",
    "mudaraba": "مضاربة",
    "ijara": "إجارة",
    "ijarah": "إجارة",
    "salam": "سلم",
    "istisna": "استصناع",
    "wakala": "وكالة",
    "kafala": "كفالة",
    "qard hassan": "قرض حسن",
    "sukuk": "صكوك",
    "takaful": "تكافل",

    # Risques selon IFSB
    "risque de crédit": "مخاطر الائتمان",
    "risque de marché": "مخاطر السوق",
    "risque opérationnel": "المخاطر التشغيلية",
    "risque de liquidité": "مخاطر السيولة",
    "risque de taux de rendement": "مخاطر معدل العائد",
    "risque commercial déplacé": "المخاطر التجارية المنقولة",
    "risque de non-conformité à la charia": "مخاطر عدم الالتزام بالشريعة",
    "risque fiduciaire": "مخاطر الأمانة",
    "risque de réputation": "مخاطر السمعة",

    # Capital et solvabilité
    "adéquation des fonds propres": "كفاية رأس المال",
    "ratio de solvabilité": "نسبة الملاءة",
    "capital réglementaire": "رأس المال الرقابي",
    "capital de catégorie 1": "رأس المال من الشريحة الأولى",
    "capital de catégorie 2": "رأس المال من الشريحة الثانية",
    "actifs pondérés par les risques": "الأصول المرجحة بالمخاطر",

    # Dépôts et investissement
    "compte d'investissement": "حساب استثماري",
    "compte d'investissement participatif": "حساب استثمار بالمشاركة",
    "titulaire de compte d'investissement": "صاحب حساب الاستثمار",
    "déposant": "مودع",
    "profit": "ربح",
    "partage des profits": "تقاسم الأرباح",
    "distribution des bénéfices": "توزيع الأرباح",

    # Divers
    "partie prenante": "أصحاب المصلحة",
    "transparence": "الشفافية",
    "divulgation": "الإفصاح",
    "politique": "سياسة",
    "procédure": "إجراء",
    "règlement": "لائحة",
    "circulaire": "منشور",
    "supervision": "إشراف",
    "surveillance": "رقابة"
}
SYSTEM_PROMPT = """Tu es un traducteur spécialisé en documents financiers et juridiques.
Tu traduis des procès-verbaux (PV) du français vers le {lang}.

Règles IMPÉRATIVES :
- Restitue EXACTEMENT la même structure : mêmes paragraphes, même ordre, mêmes sauts de ligne. N'ajoute, ne supprime, ne fusionne rien.
- Utilise la terminologie financière et juridique consacrée, pas une traduction littérale.
- Ne traduis JAMAIS les nombres, montants, dates, pourcentages, codes ou noms propres : recopie-les tels quels.
- Réponds UNIQUEMENT avec la traduction. Aucun commentaire, aucune introduction, aucune balise."""


def _split_segments(pv: str) -> list[str]:
    """Découpe le PV en blocs (paragraphes) pour traduire morceau par morceau."""
    # On coupe sur les lignes vides, en gardant les blocs non vides
    blocks = re.split(r"\n\s*\n", pv)
    return [b for b in blocks if b.strip()]


def _clean(text: str) -> str:
    """Retire les préambules parasites que les petits modèles ajoutent parfois."""
    text = text.strip()
    # Enlève un éventuel "Voici la traduction :" / "Translation:" en tête
    text = re.sub(r"^(voici la traduction\s*:?|translation\s*:?|الترجمة\s*:?)\s*",
                  "", text, flags=re.IGNORECASE)
    return text.strip()

def _relevant_terms(segment: str) -> dict:
    """Ne garde que les termes du glossaire réellement présents dans le segment."""
    low = segment.lower()
    return {fr: ar for fr, ar in GLOSSARY.items() if fr in low}

def _translate_segment(segment: str, target_language: str) -> str:
    lang = LANG_NAMES.get(target_language, target_language)

    terms = _relevant_terms(segment)
    glossary_block = ""
    if terms and target_language == "ar":
        lines = "\n".join(f'- "{fr}" → "{ar}"' for fr, ar in terms.items())
        glossary_block = (
            "\n\nTERMINOLOGIE IMPOSÉE (utilise EXACTEMENT ces traductions) :\n" + lines
        )

    response = requests.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT.format(lang=lang) + glossary_block},
                {"role": "user", "content": segment},
            ],
            "options": {"temperature": 0.1},
            "stream": False,
        },
        timeout=120,
    )
    response.raise_for_status()              
    return _clean(response.json()["message"]["content"]) 



def translate_service(pv: str, target_language: str) -> dict:
    segments = _split_segments(pv)
    translated_segments = [_translate_segment(s, target_language) for s in segments]
    translated = "\n\n".join(translated_segments)

    return {
        "success": True,
        "language": target_language,
        "pv": translated,
    }