"""
Export du PV en fichier .docx professionnel.
"""
import subprocess
import json
import os
from pathlib import Path


def export_to_docx(pv: dict, output_path: str, language: str = "fr"):
    """Générer un fichier .docx à partir du PV structuré."""

    # Écrire le script JS temporairement
    script_path = Path(output_path).parent / "_gen_docx.mjs"
    js_code = _build_js(pv, output_path, language)

    with open(script_path, "w", encoding="utf-8") as f:
        f.write(js_code)

    try:
        result = subprocess.run(
            ["node", str(script_path)],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise RuntimeError(f"Erreur génération DOCX: {result.stderr}")
    finally:
        if script_path.exists():
            script_path.unlink()


def _build_js(pv: dict, output_path: str, language: str) -> str:
    """Générer le code JS pour créer le DOCX."""

    lang_labels = {
        "fr": {
            "pv_title": "PROCÈS-VERBAL",
            "date_label": "Date",
            "heure_debut": "Heure de début",
            "heure_fin": "Heure de fin",
            "lieu": "Lieu",
            "president": "Président de séance",
            "redacteur": "Rédacteur",
            "participants_title": "LISTE DES PARTICIPANTS",
            "nom": "Nom & Prénom",
            "fonction": "Fonction",
            "present": "Présence",
            "excuses_title": "EXCUSÉS",
            "odj_title": "ORDRE DU JOUR",
            "points_title": "DÉROULEMENT DE LA RÉUNION",
            "expose": "Exposé",
            "discussion": "Discussion",
            "remarques": "Remarques",
            "conclusion": "Conclusion",
            "decisions_title": "DÉCISIONS PRISES",
            "actions_title": "PLAN D'ACTION",
            "action": "Action",
            "responsable": "Responsable",
            "echeance": "Échéance",
            "statut": "Statut",
            "prochaine_title": "PROCHAINE RÉUNION",
            "approbation_title": "APPROBATION",
            "oui": "Oui",
            "non": "Non",
        },
        "en": {
            "pv_title": "MEETING MINUTES",
            "date_label": "Date",
            "heure_debut": "Start time",
            "heure_fin": "End time",
            "lieu": "Location",
            "president": "Chair",
            "redacteur": "Secretary",
            "participants_title": "ATTENDEES",
            "nom": "Name",
            "fonction": "Role",
            "present": "Present",
            "excuses_title": "APOLOGIES",
            "odj_title": "AGENDA",
            "points_title": "MEETING PROCEEDINGS",
            "expose": "Presentation",
            "discussion": "Discussion",
            "remarques": "Remarks",
            "conclusion": "Conclusion",
            "decisions_title": "DECISIONS",
            "actions_title": "ACTION PLAN",
            "action": "Action",
            "responsable": "Owner",
            "echeance": "Due date",
            "statut": "Status",
            "prochaine_title": "NEXT MEETING",
            "approbation_title": "APPROVAL",
            "oui": "Yes",
            "non": "No",
        },
        "ar": {
            "pv_title": "محضر الاجتماع",
            "date_label": "التاريخ",
            "heure_debut": "وقت البداية",
            "heure_fin": "وقت النهاية",
            "lieu": "المكان",
            "president": "رئيس الجلسة",
            "redacteur": "كاتب المحضر",
            "participants_title": "قائمة الحاضرين",
            "nom": "الاسم واللقب",
            "fonction": "المنصب",
            "present": "الحضور",
            "excuses_title": "المعتذرون",
            "odj_title": "جدول الأعمال",
            "points_title": "سير الاجتماع",
            "expose": "العرض",
            "discussion": "النقاش",
            "remarques": "الملاحظات",
            "conclusion": "الخلاصة",
            "decisions_title": "القرارات المتخذة",
            "actions_title": "خطة العمل",
            "action": "الإجراء",
            "responsable": "المسؤول",
            "echeance": "الأجل",
            "statut": "الحالة",
            "prochaine_title": "الاجتماع القادم",
            "approbation_title": "المصادقة",
            "oui": "نعم",
            "non": "لا",
        }
    }

    L = lang_labels.get(language, lang_labels["fr"])
    pv_json = json.dumps(pv, ensure_ascii=False)
    output_escaped = output_path.replace("\\", "\\\\")

    return f"""
import {{ Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
         LevelFormat }} from 'docx';
import fs from 'fs';

const pv = {pv_json};
const L = {json.dumps(L, ensure_ascii=False)};

const BLUE = "1B3A6B";
const LIGHT_BLUE = "D6E4F0";
const GRAY = "666666";

const border = {{ style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }};
const borders = {{ top: border, bottom: border, left: border, right: border }};
const noBorder = {{ style: BorderStyle.NONE, size: 0, color: "FFFFFF" }};
const noBorders = {{ top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }};

function heading1(text) {{
  return new Paragraph({{
    children: [new TextRun({{ text, bold: true, color: BLUE, size: 28, font: "Arial" }})],
    spacing: {{ before: 360, after: 120 }},
    border: {{ bottom: {{ style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 1 }} }},
  }});
}}

function heading2(text) {{
  return new Paragraph({{
    children: [new TextRun({{ text, bold: true, color: BLUE, size: 24, font: "Arial" }})],
    spacing: {{ before: 240, after: 80 }},
  }});
}}

function bodyText(text, opts = {{}}) {{
  return new Paragraph({{
    children: [new TextRun({{ text: text || "—", size: 22, font: "Arial", ...opts }})],
    spacing: {{ after: 80 }},
  }});
}}

function labelValue(label, value) {{
  return new Paragraph({{
    children: [
      new TextRun({{ text: label + " : ", bold: true, size: 22, font: "Arial" }}),
      new TextRun({{ text: value || "—", size: 22, font: "Arial" }}),
    ],
    spacing: {{ after: 60 }},
  }});
}}

function tableHeader(cells) {{
  return new TableRow({{
    children: cells.map(text => new TableCell({{
      borders,
      shading: {{ fill: BLUE, type: ShadingType.CLEAR }},
      margins: {{ top: 80, bottom: 80, left: 120, right: 120 }},
      children: [new Paragraph({{
        children: [new TextRun({{ text, bold: true, color: "FFFFFF", size: 20, font: "Arial" }})],
      }})],
    }})),
  }});
}}

function tableRow(cells, shade = false) {{
  return new TableRow({{
    children: cells.map(text => new TableCell({{
      borders,
      shading: shade ? {{ fill: "F5F8FB", type: ShadingType.CLEAR }} : undefined,
      margins: {{ top: 60, bottom: 60, left: 120, right: 120 }},
      children: [new Paragraph({{
        children: [new TextRun({{ text: text || "—", size: 20, font: "Arial" }})],
      }})],
    }})),
  }});
}}

const children = [];

// ── EN-TÊTE ──────────────────────────────────────────────────────────────────
children.push(new Paragraph({{
  alignment: AlignmentType.CENTER,
  spacing: {{ after: 120 }},
  children: [new TextRun({{ text: L.pv_title, bold: true, size: 40, color: BLUE, font: "Arial" }})],
}}));

children.push(new Paragraph({{
  alignment: AlignmentType.CENTER,
  spacing: {{ after: 60 }},
  children: [new TextRun({{ text: pv.titre || pv.type_reunion || "", size: 28, color: GRAY, font: "Arial" }})],
}}));

if (pv.numero) {{
  children.push(new Paragraph({{
    alignment: AlignmentType.CENTER,
    spacing: {{ after: 240 }},
    children: [new TextRun({{ text: pv.numero, size: 20, color: GRAY, font: "Arial" }})],
  }}));
}}

// ── INFOS SÉANCE ─────────────────────────────────────────────────────────────
children.push(heading1("INFORMATIONS DE SÉANCE"));
children.push(labelValue(L.date_label, pv.date));
children.push(labelValue(L.heure_debut, pv.heure_debut));
children.push(labelValue(L.heure_fin, pv.heure_fin));
children.push(labelValue(L.lieu, pv.lieu));
children.push(labelValue(L.president, pv.president_seance));
children.push(labelValue(L.redacteur, pv.redacteur));

// ── PARTICIPANTS ──────────────────────────────────────────────────────────────
if (pv.participants && pv.participants.length > 0) {{
  children.push(heading1(L.participants_title));
  const rows = [tableHeader([L.nom, L.fonction, L.present])];
  pv.participants.forEach((p, i) => {{
    const nom = typeof p === "string" ? p : (p.nom || "");
    const fn = typeof p === "string" ? "" : (p.fonction || "");
    const present = typeof p === "string" ? L.oui : (p.present !== false ? L.oui : L.non);
    rows.push(tableRow([nom, fn, present], i % 2 === 1));
  }});
  children.push(new Table({{
    width: {{ size: 9026, type: WidthType.DXA }},
    columnWidths: [4200, 3600, 1226],
    rows,
  }}));
  children.push(new Paragraph({{ spacing: {{ after: 120 }} }}));
}}

// ── EXCUSÉS ───────────────────────────────────────────────────────────────────
if (pv.excuses && pv.excuses.length > 0) {{
  children.push(heading1(L.excuses_title));
  pv.excuses.forEach(e => children.push(bodyText(typeof e === "string" ? e : e.nom)));
}}

// ── ORDRE DU JOUR ─────────────────────────────────────────────────────────────
if (pv.ordre_du_jour && pv.ordre_du_jour.length > 0) {{
  children.push(heading1(L.odj_title));
  pv.ordre_du_jour.forEach((item, i) => {{
    children.push(new Paragraph({{
      children: [new TextRun({{ text: `${{i+1}}. ${{item}}`, size: 22, font: "Arial" }})],
      spacing: {{ after: 60 }},
    }}));
  }});
}}

// ── POINTS DISCUTÉS ────────────────────────────────────────────────────────────
if (pv.points && pv.points.length > 0) {{
  children.push(heading1(L.points_title));
  pv.points.forEach(point => {{
    children.push(heading2(`${{point.numero || ""}}. ${{point.titre || ""}}`));

    if (point.expose) {{
      children.push(new Paragraph({{
        children: [new TextRun({{ text: L.expose + " : ", bold: true, size: 22, font: "Arial" }})],
        spacing: {{ after: 40 }},
      }}));
      children.push(bodyText(point.expose));
    }}

    if (point.discussion) {{
      children.push(new Paragraph({{
        children: [new TextRun({{ text: L.discussion + " : ", bold: true, size: 22, font: "Arial" }})],
        spacing: {{ after: 40 }},
      }}));
      children.push(bodyText(point.discussion));
    }}

    if (point.remarques && point.remarques.length > 0) {{
      children.push(new Paragraph({{
        children: [new TextRun({{ text: L.remarques + " :", bold: true, size: 22, font: "Arial" }})],
        spacing: {{ after: 40 }},
      }}));
      point.remarques.forEach(r => {{
        children.push(new Paragraph({{
          children: [new TextRun({{ text: "• " + (typeof r === "string" ? r : r.texte || r), size: 22, font: "Arial" }})],
          spacing: {{ after: 40 }},
          indent: {{ left: 360 }},
        }}));
      }});
    }}

    if (point.conclusion) {{
      children.push(new Paragraph({{
        children: [
          new TextRun({{ text: L.conclusion + " : ", bold: true, size: 22, font: "Arial", color: BLUE }}),
          new TextRun({{ text: point.conclusion, size: 22, font: "Arial" }}),
        ],
        spacing: {{ after: 120 }},
        shading: {{ fill: LIGHT_BLUE, type: ShadingType.CLEAR }},
      }}));
    }}
  }});
}}

// ── DÉCISIONS ────────────────────────────────────────────────────────────────
if (pv.decisions && pv.decisions.length > 0) {{
  children.push(heading1(L.decisions_title));
  pv.decisions.forEach((d, i) => {{
    const text = typeof d === "string" ? d : (d.decision || d.texte || JSON.stringify(d));
    children.push(new Paragraph({{
      children: [new TextRun({{ text: `D${{String(i+1).padStart(2,"0")}} – ${{text}}`, size: 22, font: "Arial" }})],
      spacing: {{ after: 80 }},
    }}));
  }});
}}

// ── PLAN D'ACTION ─────────────────────────────────────────────────────────────
if (pv.plan_action && pv.plan_action.length > 0) {{
  children.push(heading1(L.actions_title));
  const rows = [tableHeader([L.action, L.responsable, L.echeance, L.statut])];
  pv.plan_action.forEach((a, i) => {{
    const action = typeof a === "string" ? a : (a.action || "");
    const resp = typeof a === "string" ? "" : (a.responsable || "");
    const ech = typeof a === "string" ? "" : (a.echeance || "");
    const stat = typeof a === "string" ? "" : (a.statut || "");
    rows.push(tableRow([action, resp, ech, stat], i % 2 === 1));
  }});
  children.push(new Table({{
    width: {{ size: 9026, type: WidthType.DXA }},
    columnWidths: [3800, 2000, 1600, 1626],
    rows,
  }}));
  children.push(new Paragraph({{ spacing: {{ after: 120 }} }}));
}}

// ── PROCHAINE RÉUNION ────────────────────────────────────────────────────────
const pr = pv.prochaine_reunion || {{}};
if (pr.date || pr.lieu) {{
  children.push(heading1(L.prochaine_title));
  if (pr.date) children.push(labelValue(L.date_label, pr.date));
  if (pr.lieu) children.push(labelValue(L.lieu, pr.lieu));
  if (pr.points_previsionnels && pr.points_previsionnels.length > 0) {{
    pr.points_previsionnels.forEach(p => children.push(bodyText("• " + p)));
  }}
}}

// ── APPROBATION ───────────────────────────────────────────────────────────────
children.push(heading1(L.approbation_title));
const app = pv.approbation || {{}};
children.push(labelValue("Statut", app.statut || "—"));
children.push(labelValue("Date", app.date || "—"));
children.push(labelValue("Signataire", app.signataire || "—"));

// ── SIGNATURES ───────────────────────────────────────────────────────────────
children.push(new Paragraph({{ spacing: {{ before: 480, after: 0 }} }}));
children.push(new Table({{
  width: {{ size: 9026, type: WidthType.DXA }},
  columnWidths: [4513, 4513],
  rows: [
    new TableRow({{ children: [
      new TableCell({{ borders: noBorders, margins: {{ top: 60, bottom: 60, left: 120, right: 120 }}, children: [
        new Paragraph({{ children: [new TextRun({{ text: "Le Président de séance", bold: true, size: 22, font: "Arial" }})] }}),
        new Paragraph({{ spacing: {{ before: 720 }}, children: [new TextRun({{ text: pv.president_seance || "___________________", size: 22, font: "Arial" }})] }}),
      ]}}),
      new TableCell({{ borders: noBorders, margins: {{ top: 60, bottom: 60, left: 120, right: 120 }}, children: [
        new Paragraph({{ alignment: AlignmentType.RIGHT, children: [new TextRun({{ text: "Le Rédacteur", bold: true, size: 22, font: "Arial" }})] }}),
        new Paragraph({{ alignment: AlignmentType.RIGHT, spacing: {{ before: 720 }}, children: [new TextRun({{ text: pv.redacteur || "___________________", size: 22, font: "Arial" }})] }}),
      ]}}),
    ]}})
  ],
}}));

// ── GÉNÉRATION ────────────────────────────────────────────────────────────────
const doc = new Document({{
  sections: [{{
    properties: {{
      page: {{
        size: {{ width: 11906, height: 16838 }},
        margin: {{ top: 1134, right: 1134, bottom: 1134, left: 1134 }},
      }},
    }},
    children,
  }}],
}});

Packer.toBuffer(doc).then(buf => {{
  fs.writeFileSync("{output_escaped}", buf);
  console.log("DOCX généré: {output_escaped}");
}});
"""