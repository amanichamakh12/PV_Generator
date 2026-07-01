'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  ListChecks,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FileText,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export function AgendaAnalysisStep() {
  const { slides, agendaItems, updateAgendaItem, updateSlide, setCurrentStep, sessionId } = useWorkflow();
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(agendaItems[0]?.id || null);
  const [analyzingItems, setAnalyzingItems] = useState<Set<string>>(new Set());

  const selectedAgenda = agendaItems.find(a => a.id === selectedAgendaId);
  const agendaSlides = selectedAgenda
    ? slides.filter(s => s.agendaItemId === selectedAgenda.id)
    : [];
  // Slides pouvant être ajoutées à l'ODJ courant (affectées ailleurs ou non affectées)
  const availableSlides = selectedAgenda
    ? slides.filter(s => s.agendaItemId !== selectedAgenda.id)
    : [];

  const persistSlideAgenda = async (slide: (typeof slides)[0], agendaOrder: number | null) => {
    if (!slide.db_id) return;
    try {
      await fetch(`${API}/api/slides/${slide.db_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agenda_item_index: agendaOrder }),
      });
    } catch (err) {
      console.error('Erreur réaffectation slide:', err);
    }
  };

  const handleRemoveSlide = async (slideId: string) => {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return;
    if (slide.agendaItemId) {
      updateAgendaItem(slide.agendaItemId, { isValidated: false });
    }
    updateSlide(slideId, { agendaItemId: '' });
    await persistSlideAgenda(slide, null);
  };

  const handleAssignSlide = async (slideId: string) => {
    if (!selectedAgenda) return;
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return;
    updateAgendaItem(selectedAgenda.id, { isValidated: false });
    updateSlide(slideId, { agendaItemId: selectedAgenda.id });
    await persistSlideAgenda(slide, selectedAgenda.db_id ?? selectedAgenda.order);
  };

  const handleAnalyzeAgenda = async (agendaId: string) => {
  const agenda = agendaItems.find(a => a.id === agendaId);
  if (!agenda) return;

  const relatedSlides = slides.filter(s => s.agendaItemId === agendaId);
  setAnalyzingItems(prev => new Set([...prev, agendaId]));

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

    const body = {
      ordre_du_jour: agenda.title,
      slides: relatedSlides.map(s => ({
        index: s.slideNumber,
        titre: s.title,
        contenu: s.extractedContent
          ? s.extractedContent.split('\n').filter(Boolean)
          : Array.isArray(s.contentBlocks)
            ? s.contentBlocks
            : (s.content || '').split('\n').filter(Boolean),
        tableaux: s.tables ?? [],
        graphiques: s.charts ?? [],
        images: (s.images ?? []).filter((img: any) => img?.status === 'done'),
        notes: s.notes ?? null,
      })),
      use_llm: true,
    };
console.log('DEBUG images raw:', JSON.stringify(relatedSlides.map(s => s.images), null, 2));

    const res = await fetch(`${apiUrl}/api/analyze-agenda-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `API error ${res.status}`);
    }

    const data = await res.json();
    console.log('✅ Analyse agenda reçue:', data);

    const result = data.result || {};

    // Utilise paragraphe_pv (rédigé en style PV) si disponible, sinon fallback sur analyse
    const analysis = result?.paragraphe_pv || result?.analyse || '';
    updateAgendaItem(agendaId, { analysis, isAnalyzed: true });

    if (agenda.db_id) {
      fetch(`${API}/api/agenda-items/${agenda.db_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      }).catch(() => {});
    }

    // Marquer la session comme "agenda_analyzed" dès qu'au moins un ODJ est analysé
    if (sessionId) {
      fetch(`${API}/api/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'agenda_analyzed' }),
      }).catch(() => {});
    }

  } catch (err: any) {
    console.error('❌ Erreur API analyse ordre du jour:', err.message);
  } finally {
    setAnalyzingItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(agendaId);
      return newSet;
    });
  }
};

  const handleQuickFill = () => {
    const staticAnalyses: Record<number, string> = {
      1: `Le Comité a procédé à l'examen de l'ordre du jour et a validé les points à discuter.\n\n**Constats :**\n• L'ordre du jour a été approuvé à l'unanimité\n• Les membres présents ont confirmé leur disponibilité pour la durée de la séance`,
      2: `L'analyse du portefeuille de crédit au mois de mai 2025 révèle une augmentation du montant total des engagements de 2,3 % par rapport à l'époque précédente, avec un nombre de contreparties qui a augmenté de 48 unités. Le taux de défaut a diminué de 0,12 points pour atteindre 4,18 %, tandis que le taux de couverture s'est amélioré de 1,8 point à 72,3 %. La répartition du portefeuille selon les stades IFRS 9 montre une forte concentration dans le segment performant (Stage 1) avec 77,4 % des actifs totaux et une ECL de 12,3 Mrd DZD. Le segment sous surveillance (Stage 2) représente 14,8 % du portefeuille avec une ECL de 18,7 MrD ZD, tandis que le segment non performant (Stage 3) s'élève à 7,8 % des actifs totaux et une ECL de 41,2 MrD ZD. La répartition sectorielle du portefeuille montre un leadership de l'Industrie & BTP avec 48,2 Mrd DZD (26%), suivi par le Commerce & Distribution à 36,7 Mrd DZD (20%). Les notations internes des secteurs varient entre BB+ et BBB-, avec l'Industrie & BTP étant la plus forte. Ces informations suggèrent une situation globale stable mais nécessitent une vigilance accrue sur les segments non performants.

**Constats :**
• Le montant total des engagements est de 184,6 Mrd DZD
• Le taux de défaut est de 4,18 %
• Le taux de couverture s'est amélioré de 1,8 point
• Industrie & BTP domine avec 26% des actifs
• Commerce & Distribution représente 20%
• Agriculture totalise 16%
• Services & Telecom atteignent 13%
• Immobilier affiche 12%

**Risques identifiés :**
• La concentration dans le segment non performant (Stage 3) avec une ECL élevée de 41,2 MrD ZD
• Les notations internes des secteurs varient entre BB+ et BBB-
• Le leadership du secteur Industrie & BTP`,
      3: `Le Comité a examiné le suivi des incidents et pertes opérationnelles pour T1 2025. 28 incidents ont été enregistrés pour des pertes totales de 476K MAD, avec un taux de résolution de 68%.\n\n**Constats :**\n• 28 incidents au total, en baisse vs 31 en T4 2024\n• Pertes totales : 476K MAD (↓12%)\n• Taux de résolution : 68% — objectif cible 75%\n• Erreurs de traitement : catégorie dominante (12 cas)\n\n**Risques identifiés :**\n• Fraude interne en hausse (statut ouvert)\n• Taux de résolution encore en dessous de la cible\n\n**Actions suggérées :**\n• Renforcer les mesures anti-fraude interne\n• Plan d'action pour atteindre 75% de résolution`,
      4: `Le Comité a passé en revue la répartition sectorielle du portefeuille et le respect des limites de concentration.\n\n**Constats :**\n• Commerce & Distribution : utilisation à 90% de la limite — ALERTE ROUGE\n• BTP & Immobilier : utilisation à 87.5% — ALERTE ORANGE\n• Exposition totale : 4 512 MMAD\n\n**Risques identifiés :**\n• Dépassement imminent sur Commerce & Distribution\n• Deux secteurs simultanément en zone d'alerte\n\n**Actions suggérées :**\n• Révision urgente de la limite Commerce & Distribution\n• Stress test sectoriel BTP & Immobilier`,
    };

    agendaItems.forEach((agenda, index) => {
      const analysis = staticAnalyses[index + 1] ||
        `Le Comité a examiné le point relatif à "${agenda.title}".\n\n**Constats :**\n• Point examiné et acté par le Comité\n\n**Actions suggérées :**\n• Suivi à assurer lors du prochain comité`;
      updateAgendaItem(agenda.id, { analysis, isAnalyzed: true, isValidated: true });
    });
  };

  const handleRegenerateAnalysis = async (agendaId: string) => {
    updateAgendaItem(agendaId, { analysis: '', isAnalyzed: false, isValidated: false });
    await handleAnalyzeAgenda(agendaId);
  };

  const handleValidateAgenda = (agendaId: string) => {
    const agenda = agendaItems.find(a => a.id === agendaId);
    updateAgendaItem(agendaId, { isValidated: true });
    if (agenda?.db_id) {
      fetch(`${API}/api/agenda-items/${agenda.db_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: agenda.analysis }),
      }).catch(() => {});
    }
  };

  const handleAnalysisChange = (agendaId: string, analysis: string) => {
    updateAgendaItem(agendaId, { analysis, isValidated: false });
  };

  const hasValidatedAgenda = agendaItems.some(a => a.isAnalyzed && a.isValidated);
  const analyzedCount = agendaItems.filter(a => a.isAnalyzed).length;
  const validatedCount = agendaItems.filter(a => a.isValidated).length;

  const handleContinue = () => {
    if (sessionId) {
      fetch(`${API}/api/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'agenda_analyzed' }),
      }).catch(() => {});
    }
    setCurrentStep('draft-generation');
  };

  const handleBack = () => {
    setCurrentStep('extract');
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Progress Header */}
      <div className="mb-6 p-4 bg-card rounded-lg border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-medium">Analysés:</span>
            <Badge variant="secondary">{analyzedCount}/{agendaItems.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-accent" />
            <span className="font-medium">Validés:</span>
            <Badge variant="secondary" className="bg-accent/20 text-accent">{validatedCount}/{agendaItems.length}</Badge>
          </div>
        </div>
       
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              Ordres du Jour
            </CardTitle>
            <CardDescription>{agendaItems.length} points à analyser</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-2">
                {agendaItems.map((agenda) => {
                  const slideCount = slides.filter(s => s.agendaItemId === agenda.id).length;
                  return (
                    <button
                      key={agenda.id}
                      onClick={() => setSelectedAgendaId(agenda.id)}
                      className={cn(
                        'w-full text-left p-4 rounded-lg border transition-all',
                        selectedAgendaId === agenda.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                          agenda.isValidated 
                            ? 'bg-accent text-accent-foreground'
                            : agenda.isAnalyzed
                            ? 'bg-warning text-warning-foreground'
                            : 'bg-primary/10 text-primary'
                        )}>
                          {agenda.isValidated ? <Check className="w-5 h-5" /> : agenda.order}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{agenda.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {slideCount} slide{slideCount > 1 ? 's' : ''}
                            </Badge>
                            {agenda.isValidated && (
                              <Badge className="text-xs bg-accent text-accent-foreground">Validé</Badge>
                            )}
                            {agenda.isAnalyzed && !agenda.isValidated && (
                              <Badge variant="secondary" className="text-xs">Analysé</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Analysis Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedAgenda ? `${selectedAgenda.order}. ${selectedAgenda.title}` : 'Sélectionnez un ordre du jour'}
                </CardTitle>
                {selectedAgenda && (
                  <CardDescription className="mt-1">
                    {agendaSlides.length} slide{agendaSlides.length > 1 ? 's' : ''} associée{agendaSlides.length > 1 ? 's' : ''}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedAgenda ? (
              <div className="space-y-4">
                {/* Slides de cet ODJ + gestion affectation */}
                <Accordion type="multiple" className="w-full space-y-2">

                  {/* ── Slides actuellement dans cet ODJ ── */}
                  <AccordionItem value="slides-in" className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">
                          Slides associées ({agendaSlides.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {agendaSlides.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          Aucune slide affectée à cet ordre du jour.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {agendaSlides.map((slide) => (
                            <div key={slide.id} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  #{slide.slideNumber} {slide.title || 'Sans titre'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {slide.extractedContent}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveSlide(slide.id)}
                                className="shrink-0 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                                title="Retirer de cet ordre du jour"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* ── Slides disponibles à ajouter ── */}
                  <AccordionItem value="slides-add" className="border rounded-lg">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">
                          Ajouter des slides ({availableSlides.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {availableSlides.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          Toutes les slides sont déjà dans cet ordre du jour.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {availableSlides.map((slide) => {
                            const currentOdj = agendaItems.find(a => a.id === slide.agendaItemId);
                            return (
                              <div key={slide.id} className="flex items-start gap-2 p-3 bg-muted/30 border border-dashed rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    #{slide.slideNumber} {slide.title || 'Sans titre'}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {currentOdj
                                      ? `ODJ : ${currentOdj.order}. ${currentOdj.title}`
                                      : 'Non affectée'}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleAssignSlide(slide.id)}
                                  className="shrink-0 p-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                                  title="Ajouter à cet ordre du jour"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>

                {/* Analysis Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Analyse Consolidée
                    </span>
                    <div className="flex gap-2">
                      {!selectedAgenda.isAnalyzed && !analyzingItems.has(selectedAgenda.id) && (
                        <Button
                          size="sm"
                          onClick={() => handleAnalyzeAgenda(selectedAgenda.id)}
                          className="gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          Analyser
                        </Button>
                      )}
                      {selectedAgenda.isAnalyzed && !analyzingItems.has(selectedAgenda.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRegenerateAnalysis(selectedAgenda.id)}
                          className="gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Régénérer
                        </Button>
                      )}
                    </div>
                  </div>

                  {analyzingItems.has(selectedAgenda.id) ? (
                    <div className="flex items-center justify-center p-12 border rounded-lg bg-muted/30">
                      <div className="text-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground">Analyse consolidée en cours...</p>
                      </div>
                    </div>
                  ) : selectedAgenda.isAnalyzed ? (
                    <Textarea
                      value={selectedAgenda.analysis}
                      onChange={(e) => handleAnalysisChange(selectedAgenda.id, e.target.value)}
                      className="min-h-[300px] resize-none font-mono text-sm"
                    />
                  ) : (
                    <div className="flex items-center justify-center p-12 border rounded-lg bg-muted/30 border-dashed">
                      <p className="text-sm text-muted-foreground">
                        Cliquez sur &quot;Analyser&quot; pour générer la synthèse de cet ordre du jour
                      </p>
                    </div>
                  )}
                </div>

                {/* Validation Button */}
                {selectedAgenda.isAnalyzed && !selectedAgenda.isValidated && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleValidateAgenda(selectedAgenda.id)}
                      className="gap-2 bg-accent hover:bg-accent/90"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Valider cette analyse
                    </Button>
                  </div>
                )}

                {selectedAgenda.isValidated && (
                  <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                      <span className="text-sm text-accent font-medium">
                        Cet ordre du jour a été validé
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Vous pouvez modifier ou régénérer l&apos;analyse ci-dessus
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>Sélectionnez un ordre du jour pour l&apos;analyser</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Button>
        <Button
          onClick={handleContinue}
          className="gap-2"
          disabled={!hasValidatedAgenda}
          title={!hasValidatedAgenda ? "Veuillez analyser et valider au moins un ordre du jour" : undefined}
        >
          Générer le Draft PV
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

