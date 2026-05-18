'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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

// Mock function to generate final PV
const mockGenerateFinalPV = async (
  draftContent: string,
  agendaItems: { title: string; notes: { speaker: string; content: string }[] }[]
): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  let notesSection = '';
  agendaItems.forEach((item, i) => {
    notesSection += `\n### ${i + 1}. ${item.title}\n\n`;
    if (item.notes.length > 0) {
      notesSection += '**Interventions:**\n\n';
      item.notes.forEach(note => {
        notesSection += `**${note.speaker}:** ${note.content}\n\n`;
      });
    }
  });

  return `${draftContent}

---

## NOTES DE LA RÉUNION
${notesSection}

---

## VALIDATION

Ce procès-verbal a été établi conformément aux discussions tenues lors du comité.

**Statut:** ✓ Validé
**Date de validation:** ${new Date().toLocaleDateString('fr-FR')}
`;
};

export function FinalPVStep() {
  const { document, agendaItems, updateDocument, setCurrentStep } = useWorkflow();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const handleGenerateFinal = async () => {
    if (!document?.draftContent) return;

    setIsGenerating(true);
    
    try {
      const finalContent = await mockGenerateFinalPV(
        document.draftContent,
        agendaItems.map(a => ({
          title: a.title,
          notes: a.notes.map(n => ({ speaker: n.speaker, content: n.content }))
        }))
      );
      updateDocument({ finalContent, status: 'reviewing' });
    } catch {
      console.error('Error generating final PV');
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

  const handleDownload = () => {
    if (!document?.finalContent) return;
    
    const blob = new Blob([document.finalContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `PV_Comite_Risques_${new Date().toISOString().split('T')[0]}.md`;
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
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {document.finalContent}
                  </div>
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
