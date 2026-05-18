'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2,
  ArrowRight, 
  ArrowLeft,
  Loader2,
  Calendar,
  Users,
  Plus,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock function to generate draft PV
const mockGenerateDraftPV = async (
  title: string,
  date: Date,
  agendaItems: { title: string; analysis: string }[]
): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  return `# PROCÈS-VERBAL
## ${title}

**Date:** ${date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

**Type de Comité:** Comité des Risques

---

### PARTICIPANTS

*À compléter lors de la réunion*

---

### ORDRE DU JOUR

${agendaItems.map((item, i) => `${i + 1}. ${item.title}`).join('\n')}

---

### COMPTE RENDU DES DISCUSSIONS

${agendaItems.map((item, i) => `
#### ${i + 1}. ${item.title}

${item.analysis}

**Décisions prises:**
- *À compléter lors de la réunion*

**Actions à mener:**
- *À compléter lors de la réunion*

---
`).join('\n')}

### PROCHAINES ÉTAPES

*À définir lors de la réunion*

---

### PROCHAINE RÉUNION

*Date à confirmer*

---

**Rédigé par:** Système de Génération PV
**Date de création:** ${new Date().toLocaleDateString('fr-FR')}
`;
};

export function DraftGenerationStep() {
const { document, slides, agendaItems, updateDocument, setCurrentStep } = useWorkflow();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [participants, setParticipants] = useState<string[]>(document?.participants || []);
  const [newParticipant, setNewParticipant] = useState('');

const handleGenerateDraft = async () => {
  if (!document) return;

  setIsGenerating(true);

  try {
    const formattedDate = document.date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });

    const fullDate = document.date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const pvLocal = {
      titre: document.title || 'COMITÉ DES RISQUES',
      date: fullDate,

      introduction: `
Le COMITÉ DES RISQUES de Direction des Risques s'est réuni le ${formattedDate} au siège de la banque, sur invitation de son Président, pour délibérer sur l'ordre du jour suivant.

La feuille de présence a été établie et dûment signée par les membres présents.

Après avoir constaté la présence requise des membres, le Président a ouvert les travaux du comité en souhaitant la bienvenue aux présents.
      `,

      participants,

      ordre_du_jour: [
        "Confirmation de l’ordre du jour",
        ...agendaItems.map((a) => a.title),
      ],

      points: [
        {
          numero: '1',
          titre: 'Confirmation de l’ordre du jour',
          discussion:
            "Tous les membres du comité présents ont confirmé l’ordre du jour à discuter durant cette séance.",
          conclusion:
            "Le comité a validé l’ordre du jour proposé.",
        },

        ...agendaItems.map((a, i) => ({
          numero: String(i + 2),
          titre: a.title,
          discussion:
            a.analysis || 'Aucune analyse disponible pour ce point.',
          conclusion:
            `Le Comité a pris acte des éléments présentés relatifs au point ${i + 2}.`,
        })),
      ],

      plan_action: slides
        .flatMap((s) => s.tables ?? [])
        .filter((t) =>
          t.lignes?.[0]?.some((h: string) =>
            h.toLowerCase().includes('action')
          )
        )
        .flatMap((t) =>
          t.lignes.slice(1).map((row: string[], i: number) => ({
            id: `A${String(i + 1).padStart(2, '0')}`,
            action: row[1] ?? '',
            responsable: row[2] ?? '',
            echeance: row[3] ?? '',
            statut: row[5] ?? 'En cours',
          }))
        ),
    };

    const draftContent = formatPVtoText(pvLocal);

    updateDocument({
      draftContent,
      status: 'draft',
    });
  } catch (err: any) {
    console.error('❌ Erreur génération draft:', err.message);
  } finally {
    setIsGenerating(false);
  }
};
// Convertit le JSON structuré du PV en texte lisible
function formatPVtoText(pv: any): string {
  const lines: string[] = [];

  lines.push(`# PROCÈS-VERBAL`);
  lines.push(`## ${pv.titre}\n`);

  lines.push(`**Date :** ${pv.date}\n`);

  // INTRODUCTION FIXE
  if (pv.introduction) {
    lines.push(pv.introduction.trim());
    lines.push('\n');
  }

  // PARTICIPANTS
  lines.push(`## ÉTAIENT PRÉSENTS\n`);

  if (pv.participants?.length) {
    pv.participants.forEach((p: string) => {
      lines.push(`- ${p}`);
    });
  } else {
    lines.push(`- Liste des participants à compléter`);
  }

  // ORDRE DU JOUR
  lines.push(`\n## ORDRE DU JOUR\n`);

  pv.ordre_du_jour?.forEach((item: string, i: number) => {
    lines.push(`${i + 1}. ${item}`);
  });

  // DISCUSSIONS
  lines.push(`\n## COMPTE RENDU DES DISCUSSIONS\n`);

  pv.points?.forEach((point: any) => {
    lines.push(`\n### ${point.numero}. ${point.titre}\n`);

    if (point.discussion) {
      lines.push(point.discussion);
      lines.push('\n');
    }

    if (point.conclusion) {
      lines.push(`**Conclusion :** ${point.conclusion}\n`);
    }
  });

  // PLAN D'ACTION
  if (pv.plan_action?.length) {
    lines.push(`\n## PLAN D'ACTION\n`);

    pv.plan_action.forEach((a: any) => {
      lines.push(`### ${a.id}`);
      lines.push(`- Action : ${a.action}`);
      lines.push(`- Responsable : ${a.responsable}`);
      lines.push(`- Échéance : ${a.echeance}`);
      lines.push(`- Statut : ${a.statut}\n`);
    });
  }

  lines.push(`\n---`);
  lines.push(`PV généré automatiquement par le système.`);

  return lines.join('\n');
}

  const handleRegenerateDraft = async () => {
    updateDocument({ draftContent: '' });
    await handleGenerateDraft();
  };

  const handleContentChange = (content: string) => {
    updateDocument({ draftContent: content });
  };

  const handleAddParticipant = () => {
    if (newParticipant.trim()) {
      const updatedParticipants = [...participants, newParticipant.trim()];
      setParticipants(updatedParticipants);
      updateDocument({ participants: updatedParticipants });
      setNewParticipant('');
    }
  };

  const handleRemoveParticipant = (index: number) => {
    const updatedParticipants = participants.filter((_, i) => i !== index);
    setParticipants(updatedParticipants);
    updateDocument({ participants: updatedParticipants });
  };

  const handleContinue = () => {
    updateDocument({ status: 'in-meeting' });
    setCurrentStep('meeting-notes');
  };

  const handleBack = () => {
    setCurrentStep('agenda-analysis');
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Info */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Informations du PV
            </CardTitle>
            <CardDescription>Détails du document</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Date du Comité
              </label>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  {document?.date.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Agenda Summary */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ordres du Jour</label>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {agendaItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <span className="text-sm truncate">{item.title}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Participants
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nom du participant"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleAddParticipant}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {participants.map((participant, index) => (
                  <Badge key={index} variant="secondary" className="gap-1 pr-1">
                    {participant}
                    <button
                      onClick={() => handleRemoveParticipant(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {participants.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun participant ajouté</p>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium text-primary">Draft - Avant Comité</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ce PV sera complété lors de la réunion
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Draft Content */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Brouillon du PV</CardTitle>
                <CardDescription>Généré automatiquement à partir des analyses</CardDescription>
              </div>
              <div className="flex gap-2">
                {!document?.draftContent && !isGenerating && (
                  <Button onClick={handleGenerateDraft} className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Générer le Draft
                  </Button>
                )}
                {document?.draftContent && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? 'Aperçu' : 'Modifier'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateDraft}
                      className="gap-2"
                      disabled={isGenerating}
                    >
                      <RefreshCw className={cn('w-4 h-4', isGenerating && 'animate-spin')} />
                      Régénérer
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="flex items-center justify-center p-12 border rounded-lg bg-muted/30">
                <div className="text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                  <div>
                    <p className="font-medium">Génération du brouillon en cours...</p>
                    <p className="text-sm text-muted-foreground">
                      Compilation des analyses et structuration du document
                    </p>
                  </div>
                </div>
              </div>
            ) : document?.draftContent ? (
              <div className="space-y-4">
                {isEditing ? (
                  <Textarea
                    value={document.draftContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    className="min-h-[500px] resize-none font-mono text-sm"
                  />
                ) : (
                  <ScrollArea className="h-[500px] border rounded-lg p-4">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {document.draftContent}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center p-12 border rounded-lg bg-muted/30 border-dashed">
                <div className="text-center space-y-2">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Cliquez sur &quot;Générer le Draft&quot; pour créer le brouillon du PV
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      {document?.draftContent && (
        <div className="mt-6 p-4 bg-info/10 border border-info/20 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-info">Prêt pour le Comité</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ce brouillon sera complété avec les notes prises lors de la réunion. 
              Vous pourrez ensuite le modifier et le valider avant de générer le PV final.
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button 
          onClick={handleContinue} 
          className="gap-2"
          disabled={!document?.draftContent}
        >
          Passer aux Notes de Réunion
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
