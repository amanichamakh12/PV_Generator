'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Layers, 
  Sparkles, 
  RefreshCw, 
  Check, 
  CheckCircle2,
  ArrowRight, 
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const analyzeSlide = async (slide: Record<string, any>): Promise<Record<string, any>> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
  const response = await fetch(`${apiUrl}/api/test-slide-paragraph`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slide }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API error ${response.status}`);
  }

  const data = await response.json();
  return data?.result || {};
};

export function SlideAnalysisStep() {
  const { slides, updateSlide, setCurrentStep, agendaItems } = useWorkflow();
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(slides[0]?.id || null);
  const [analyzingSlides, setAnalyzingSlides] = useState<Set<string>>(new Set());

  const selectedSlide = slides.find(s => s.id === selectedSlideId);

  const getAgendaTitle = (agendaItemId: string) => {
    return agendaItems.find(a => a.id === agendaItemId)?.title || 'Non classé';
  };

  const handleAnalyzeSlide = async (slideId: string) => {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return;

    setAnalyzingSlides(prev => new Set([...prev, slideId]));
    
    try {
      const analysisResult = await analyzeSlide(slide as Record<string, any>);
      const summary = typeof analysisResult?.paragraphe === 'string'
        ? analysisResult.paragraphe
        : JSON.stringify(analysisResult, null, 2);
      updateSlide(slideId, { analysis: summary, analysisDetails: analysisResult, isAnalyzed: true });
    } catch (error) {
      console.error('Error analyzing slide', error);
    } finally {
      setAnalyzingSlides(prev => {
        const newSet = new Set(prev);
        newSet.delete(slideId);
        return newSet;
      });
    }
  };

  const handleRegenerateAnalysis = async (slideId: string) => {
    updateSlide(slideId, { analysis: '', isAnalyzed: false, isValidated: false });
    await handleAnalyzeSlide(slideId);
  };

  const handleValidateSlide = (slideId: string) => {
    updateSlide(slideId, { isValidated: true });
  };

  const handleAnalysisChange = (slideId: string, analysis: string) => {
    updateSlide(slideId, { analysis });
  };

  const allSlidesValidated = slides.every(s => s.isValidated);
  const analyzedCount = slides.filter(s => s.isAnalyzed).length;
  const validatedCount = slides.filter(s => s.isValidated).length;

  const handleContinue = () => {
    setCurrentStep('agenda-analysis');
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
            <span className="font-medium">Analysées:</span>
            <Badge variant="secondary">{analyzedCount}/{slides.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-accent" />
            <span className="font-medium">Validées:</span>
            <Badge variant="secondary" className="bg-accent/20 text-accent">{validatedCount}/{slides.length}</Badge>
          </div>
        </div>
        {!allSlidesValidated && (
          <p className="text-sm text-muted-foreground">
            Analysez et validez toutes les slides pour continuer
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Slide List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Slides à Analyser
            </CardTitle>
            <CardDescription>Cliquez pour analyser chaque slide</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setSelectedSlideId(slide.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all',
                      selectedSlideId === slide.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0',
                        slide.isValidated 
                          ? 'bg-accent text-accent-foreground'
                          : slide.isAnalyzed
                          ? 'bg-warning text-warning-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {slide.isValidated ? <Check className="w-4 h-4" /> : index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{slide.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getAgendaTitle(slide.agendaItemId)}
                          </Badge>
                          {slide.isValidated && (
                            <Badge className="text-xs bg-accent text-accent-foreground">Validée</Badge>
                          )}
                          {slide.isAnalyzed && !slide.isValidated && (
                            <Badge variant="secondary" className="text-xs">Analysée</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
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
                  {selectedSlide ? selectedSlide.title : 'Sélectionnez une slide'}
                </CardTitle>
                {selectedSlide && (
                  <CardDescription className="mt-1">
                    Slide {selectedSlide.slideNumber} • {getAgendaTitle(selectedSlide.agendaItemId)}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedSlide ? (
              <div className="space-y-4">
                {/* Extracted Content */}
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <span className="text-sm font-medium text-muted-foreground mb-2 block">
                    Contenu Extrait
                  </span>
                  <p className="text-sm">{selectedSlide.extractedContent}</p>
                </div>

                {/* Analysis Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Analyse IA
                    </span>
                    <div className="flex gap-2">
                      {!selectedSlide.isAnalyzed && !analyzingSlides.has(selectedSlide.id) && (
                        <Button
                          size="sm"
                          onClick={() => handleAnalyzeSlide(selectedSlide.id)}
                          className="gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          Analyser
                        </Button>
                      )}
                      {selectedSlide.isAnalyzed && !selectedSlide.isValidated && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRegenerateAnalysis(selectedSlide.id)}
                          className="gap-2"
                          disabled={analyzingSlides.has(selectedSlide.id)}
                        >
                          <RefreshCw className={cn('w-4 h-4', analyzingSlides.has(selectedSlide.id) && 'animate-spin')} />
                          Régénérer
                        </Button>
                      )}
                    </div>
                  </div>

                  {analyzingSlides.has(selectedSlide.id) ? (
                    <div className="flex items-center justify-center p-12 border rounded-lg bg-muted/30">
                      <div className="text-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground">Analyse en cours...</p>
                      </div>
                    </div>
                  ) : selectedSlide.isAnalyzed ? (
                    <Textarea
                      value={selectedSlide.analysis}
                      onChange={(e) => handleAnalysisChange(selectedSlide.id, e.target.value)}
                      className="min-h-[250px] resize-none font-mono text-sm"
                      disabled={selectedSlide.isValidated}
                    />
                  ) : (
                    <div className="flex items-center justify-center p-12 border rounded-lg bg-muted/30 border-dashed">
                      <p className="text-sm text-muted-foreground">
                        Cliquez sur &quot;Analyser&quot; pour générer l&apos;analyse IA
                      </p>
                    </div>
                  )}
                </div>

                {/* Validation Button */}
                {selectedSlide.isAnalyzed && !selectedSlide.isValidated && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleValidateSlide(selectedSlide.id)}
                      className="gap-2 bg-accent hover:bg-accent/90"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Valider cette analyse
                    </Button>
                  </div>
                )}

                {selectedSlide.isValidated && (
                  <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                    <span className="text-sm text-accent font-medium">
                      Cette slide a été validée
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p>Sélectionnez une slide pour l&apos;analyser</p>
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
        >
          Analyser par Ordre du Jour
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
