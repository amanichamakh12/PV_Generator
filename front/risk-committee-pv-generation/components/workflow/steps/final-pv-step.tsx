'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PVRenderer } from './PVRenderer';
import { Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType, LineRuleType } from 'docx';
import { 
  FileCheck, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2,
  ArrowRight, 
  ArrowLeft,
  Loader2,
  Download,
  Edit3,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

const generateFinalPV = async (pvDraft: string, agendaItems: any[]) => {
  console.group("🔵 generateFinalPV");

  console.log("📥 pvDraft (100 premiers chars) :", pvDraft?.slice(0, 100));
  console.log("📥 agendaItems :", agendaItems);

  // Étape 2 — Construction du payload notes
  const notes = agendaItems.flatMap(a =>
    a.notes.map((n: { speaker: any; content: any }) => ({
      participant: n.speaker,
      content: n.content,
      ordre_du_jour: a.title
    }))
  );
  console.log("📋 Notes aplaties :", notes);
  console.log("📋 Nombre de notes :", notes.length);

  // ✅ Étape 3 — Construction du JSON structuré depuis agendaItems
const pvDraftStructure = {
  points: agendaItems.map(a => ({
    titre: a.title,
    expose: a.expose ?? "",
    discussion: a.analysis ?? "",  
    conclusion: a.conclusion ?? "",
    remarques: a.remarques ?? [],
  }))
};

  console.log("🏗️ PV structuré construit :", JSON.stringify(pvDraftStructure, null, 2));
  console.log("🏗️ Nombre de points :", pvDraftStructure.points.length);
  pvDraftStructure.points.forEach(p =>
    console.log(`   - "${p.titre}" → discussion: ${p.discussion.slice(0, 60)}...`)
  );

  // Étape 3 — Body final envoyé
  const body = {
    pv_draft: pvDraftStructure,  // ✅ JSON structuré au lieu de { content: string }
    notes,
  };
  console.log("📤 Body envoyé au backend :", JSON.stringify(body, null, 2));

  // Étape 4 — Appel fetch
  console.time("⏱️ Durée appel /api/merge-notes");
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
  const response = await fetch(`${apiUrl}/api/merge-notes`, {

    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.timeEnd("⏱️ Durée appel /api/merge-notes");

  console.log("📡 Status HTTP :", response.status, response.statusText);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("❌ Erreur backend brute :", errorBody);
    try {
      console.error("❌ Erreur backend parsée :", JSON.parse(errorBody));
    } catch {
      console.warn("⚠️ Réponse d'erreur non-JSON");
    }
    console.groupEnd();
    throw new Error(`Erreur génération PV final [${response.status}]: ${errorBody}`);
  }

  const data = await response.json();
console.log("✅ Réponse backend :", data);
console.log("✅ Type de data.pv :", typeof data.pv);

let pvFinal: string;

if (typeof data.pv === "string") {
  pvFinal = data.pv;

} else if (data.pv?.content) {
  pvFinal = data.pv.content;

} else if (data.pv?.points) {
  // ✅ Reconversion JSON enrichi → Markdown
  console.log("🔄 Reconversion JSON mergé → Markdown");

  const intro = pvDraft.split("## COMPTE RENDU DES DISCUSSIONS")[0] ?? "";

  const pointsMarkdown = data.pv.points.map((p: any, idx: number) => {
    const remarques = (p.remarques ?? [])
      .map((r: string) => `• ${r}`)
      .join("\n");

    const decisions = (data.pv.decisions ?? [])
      .map((d: string) => `• ${d}`)
      .join("\n");

    const actions = (data.pv.plan_action ?? [])
      .filter((a: any) => a.action)
      .map((a: any) => `• [${a.id}] ${a.action} — ${a.responsable} (${a.echeance || "à définir"})`)
      .join("\n");

    return [
      `### ${idx + 2}. ${p.titre}`,
      "",
      p.discussion || "",
      "",
      remarques ? `**Remarques :**\n${remarques}` : "",
      "",
      decisions ? `**Décisions :**\n${decisions}` : "",
      "",
      actions ? `**Plan d'action :**\n${actions}` : "",
      "",
      `**Conclusion :** ${p.conclusion || `Le Comité a pris acte des éléments présentés relatifs à ce point.`}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  pvFinal = `${intro}## COMPTE RENDU DES DISCUSSIONS\n\n${pointsMarkdown}\n\n---\nPV généré automatiquement par le système.`;

  console.log("✅ Markdown reconstruit (200 premiers chars) :", pvFinal.slice(0, 200));

} else {
  console.warn("⚠️ Structure data.pv non reconnue — fallback pvDraft");
  pvFinal = pvDraft;
}

// Vérification merge
console.group("🔍 Vérification merge notes");
notes.forEach((n: any) => {
  const motsCles = n.content.split(/\s+/).filter((w: string) => w.length > 5).slice(0, 3);
  const trouves = motsCles.filter((m: string) => pvFinal.includes(m));
  const ratio = trouves.length / motsCles.length;
  if (ratio >= 0.6) {
    console.log(`✅ Note de ${n.participant} mergée (${trouves.length}/${motsCles.length} mots-clés)`);
  } else {
    console.warn(`❌ Note de ${n.participant} NON mergée — mots-clés cherchés : [${motsCles}]`);
  }
});
console.groupEnd();

console.groupEnd();
return pvFinal;
};

export function FinalPVStep() {
  const { document, agendaItems, updateDocument, setCurrentStep } = useWorkflow();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
   const [participants, setParticipants] = useState<string[]>(document?.participants || []);
  const [newParticipant, setNewParticipant] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState('');

const [error, setError] = useState<string | null>(null);

const handleGenerateFinal = async () => {
  if (!document?.draftContent) {
    console.error('draftContent manquant');
    return;
  }

  setIsGenerating(true);
  setError(null); // clear previous error

  try {
    const finalPV = await generateFinalPV(document.draftContent, agendaItems);

    updateDocument({
      finalContent: JSON.stringify(finalPV, null, 2),
      finalJson: finalPV,
      status: 'reviewing'
    });
  } catch (err: any) {
    console.error(err);
    setError(err.message ?? 'Une erreur est survenue');
  } finally {
    setIsGenerating(false);
  }
};

  const handleRegenerateFinal = async () => {
    setIsValidated(false);
    updateDocument({ finalContent: '', status: 'reviewing' });
    await handleGenerateFinal();
  };

  const handleContentChange = (content: string) => {
    updateDocument({ finalContent: content });
  };

  const handleValidate = () => {
    setIsValidated(true);
    updateDocument({ status: 'validated' });
  };
  function createDocxDocumentFromDraft(content: string) {
    const paragraphs: Paragraph[] = [];
    const lines = content.split(/\r?\n/);
  
    // Ligne de séparation réutilisable
    const horizontalRule = new Paragraph({
      border: {
        bottom: { color: "000000", size: 6, style: BorderStyle.SINGLE, space: 1 },
      },
      spacing: { after: 200 },
      children: [],
    });
  
    lines.forEach((rawLine) => {
      const line = rawLine.trim();
  
      if (!line) {
        paragraphs.push(new Paragraph({ spacing: { after: 100 } }));
        return;
      }
  
      if (line.startsWith('# ')) {
        // Titre principal — grand, gras, centré, souligné
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: line.replace('# ', ''),
                bold: true,
                size: 36, // 18pt
                color: "000000",
                font: "Calibri",
              }),
            ],
          })
        );
        paragraphs.push(horizontalRule);
        return;
      }
  
      if (line.startsWith('## ')) {
        // Section — gras, bordure gauche noire
        paragraphs.push(
          new Paragraph({
            spacing: { before: 300, after: 120 },
            border: {
              left: { color: "000000", size: 12, style: BorderStyle.SINGLE, space: 8 },
            },
            indent: { left: 200 },
            children: [
              new TextRun({
                text: line.replace('## ', ''),
                bold: true,
                size: 28, // 14pt
                color: "000000",
                font: "Calibri",
              }),
            ],
          })
        );
        return;
      }
  
      if (line.startsWith('### ')) {
        // Sous-section — gras, italique
        paragraphs.push(
          new Paragraph({
            spacing: { before: 200, after: 80 },
            children: [
              new TextRun({
                text: line.replace('### ', ''),
                bold: true,
                italics: true,
                size: 24, // 12pt
                color: "000000",
                font: "Calibri",
              }),
            ],
          })
        );
        return;
      }
  
      if (line.startsWith('- ')) {
        // Bullet propre avec tiret
        paragraphs.push(
          new Paragraph({
            spacing: { after: 80 },
            indent: { left: 400, hanging: 200 },
            children: [
              new TextRun({
                text: `– ${line.replace('- ', '')}`,
                size: 22, // 11pt
                color: "000000",
                font: "Calibri",
              }),
            ],
          })
        );
        // Section signatures
    if (participants.length > 0) {
      // Titre section
      paragraphs.push(new Paragraph({
        spacing: { before: 600, after: 200 },
        border: {
          bottom: { color: "000000", size: 6, style: BorderStyle.SINGLE, space: 1 },
        },
        children: [new TextRun({
          text: "SIGNATURES",
          bold: true,
          size: 28,
          font: "Calibri",
          color: "000000",
        })],
      }));
  
      // Grille de signatures 2 par ligne
      for (let i = 0; i < participants.length; i += 2) {
        const left = participants[i];
        const right = participants[i + 1];
  
        const [leftName, leftRole] = left.split(" — ");
        const [rightName, rightRole] = right ? right.split(" — ") : ["", ""];
  
        // Noms
        paragraphs.push(new Paragraph({
          spacing: { before: 400, after: 60 },
          children: [
            new TextRun({ text: leftName, bold: true, size: 22, font: "Calibri" }),
            new TextRun({ text: "\t\t\t\t", size: 22 }),
            new TextRun({ text: rightName, bold: true, size: 22, font: "Calibri" }),
          ],
        }));
  
        // Rôles
        paragraphs.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: leftRole || "", italics: true, size: 20, font: "Calibri", color: "444444" }),
            new TextRun({ text: "\t\t\t\t", size: 22 }),
            new TextRun({ text: rightRole || "", italics: true, size: 20, font: "Calibri", color: "444444" }),
          ],
        }));
  
        // Ligne de signature
        paragraphs.push(new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: "_______________________", size: 22, font: "Calibri" }),
            new TextRun({ text: "\t\t\t\t", size: 22 }),
            new TextRun({ text: rightName ? "_______________________" : "", size: 22, font: "Calibri" }),
          ],
        }));
      }
    }
        return;
      }
  
      // Paragraphe normal
      paragraphs.push(
        new Paragraph({
          spacing: { after: 100 },
          children: getRunsFromLine(line),
        })
      );
    });
  
    return new DocxDocument({
      styles: {
        default: {
          document: {
            run: {
              font: "Calibri",
              size: 22, // 11pt
              color: "000000",
            },
            paragraph: {
              spacing: { line: 276, lineRule: LineRuleType.AUTO },
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,    // 2.54cm
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: paragraphs,
        },
      ],
    });
  }
const handleDownload = async () => {
  if (!document?.draftContent) return;

  const doc = createDocxDocumentFromDraft(document.draftContent);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `PV_Comite_Risques_${new Date().toISOString().split('T')[0]}.docx`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
};


  const handleContinue = () => {
    setCurrentStep('translation');
  };

  const handleBack = () => {
    setCurrentStep('meeting-notes');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-primary" />
                Procès-Verbal Final
              </CardTitle>
              <CardDescription className="mt-1">
                Compilé à partir du brouillon et des notes de réunion
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!document?.finalContent && !isGenerating && (
                <Button onClick={handleGenerateFinal} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Générer le PV Final
                </Button>
              )}
              {document?.finalContent && !isValidated && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="gap-2"
                  >
                    {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                    {isEditing ? 'Aperçu' : 'Modifier'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateFinal}
                    className="gap-2"
                    disabled={isGenerating}
                  >
                    <RefreshCw className={cn('w-4 h-4', isGenerating && 'animate-spin')} />
                    Régénérer
                  </Button>
                </>
              )}
              {document?.finalContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isGenerating ? (
            <div className="flex items-center justify-center p-16 border rounded-lg bg-muted/30">
              <div className="text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <div>
                  <p className="font-medium text-lg">Génération du PV final en cours...</p>
                  <p className="text-sm text-muted-foreground">
                    Compilation du brouillon avec les notes de réunion
                  </p>
                </div>
              </div>
            </div>
          ) : document?.finalContent ? (
            <div className="space-y-4">
              {isEditing ? (
                <Textarea
                  value={document.finalContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="min-h-[500px] resize-none font-mono text-sm"
                />
              ) : (
                
            <ScrollArea className="h-[500px] border rounded-lg p-6">
              <PVRenderer content={document.finalContent} />
            </ScrollArea>
              )}

              {/* Validation Section */}
              {!isValidated ? (
                <div className="flex items-center justify-between p-4 bg-warning/10 border border-warning/20 rounded-lg">
                  <div>
                    <p className="font-medium text-warning-foreground">Validation requise</p>
                    <p className="text-sm text-muted-foreground">
                      Veuillez relire le PV et le valider avant de passer à la traduction
                    </p>
                  </div>
                  <Button
                    onClick={handleValidate}
                    className="gap-2 bg-accent hover:bg-accent/90"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Valider le PV
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-accent" />
                  <div>
                    <p className="font-medium text-accent">PV Validé</p>
                    <p className="text-sm text-muted-foreground">
                      Vous pouvez maintenant procéder à la traduction
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center p-16 border rounded-lg bg-muted/30 border-dashed">
              <div className="text-center space-y-3">
                <FileCheck className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium">Prêt à générer le PV final</p>
                  <p className="text-muted-foreground">
                    Cliquez sur &quot;Générer le PV Final&quot; pour compiler le document
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button 
          onClick={handleContinue} 
          className="gap-2"
          disabled={!isValidated}
        >
          Passer à la Traduction
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
function createDocxDocumentFromDraft(finalContent: string, arg1: string[]) {
  throw new Error('Function not implemented.');
}

function getRunsFromLine(line: string): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map(part =>
    part.startsWith("**") && part.endsWith("**")
      ? new TextRun({ text: part.slice(2, -2), bold: true, font: "Calibri", size: 22 })
      : new TextRun({ text: part, font: "Calibri", size: 22 })
  );
}
