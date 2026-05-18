'use client';

import { useState } from 'react';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Edit3,
  Check,
  ArrowRight,
  ArrowLeft,
  Save,
  Trash2,
  BarChart2,
  PieChart,
  TrendingUp,
  Image as ImageIcon,
  StickyNote,
  Table2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

function ChartIcon({ type }: { type?: string }) {
  const t = (type || '').toLowerCase();
  if (t.includes('camembert') || t.includes('pie') || t.includes('donut'))
    return <PieChart className="w-4 h-4" />;
  if (t.includes('courbe') || t.includes('line') || t.includes('marqueur'))
    return <TrendingUp className="w-4 h-4" />;
  return <BarChart2 className="w-4 h-4" />;
}

function ChartCard({ chart, index }: { chart: any; index: number }) {
  const series: any[] = chart.series || [];
  const categories: string[] = chart.categories || [];

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <ChartIcon type={chart.type} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {chart.titre || `Graphique ${index + 1}`}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{chart.type || 'Inconnu'}</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {chart.source === 'natif' ? 'Natif PPTX' : 'IA'}
        </Badge>
      </div>

      {/* data rows */}
      <div className="p-4 space-y-4">
        {series.map((serie: any, si: number) => (
          <div key={si}>
            {series.length > 1 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {serie.nom || `Série ${si + 1}`}
              </p>
            )}
            <div className="space-y-1">
              {(serie.valeurs || []).map((val: number, vi: number) => {
                const label = (serie.categories || categories)[vi] || `Item ${vi + 1}`;
                const max = Math.max(...(serie.valeurs || [1]));
                const pct = max > 0 ? Math.round((val / max) * 100) : 0;
                return (
                  <div key={vi} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right shrink-0">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* observations */}
        {chart.resume_pv && (
          <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">
            {/* show only OBSERVATIONS line */}
            {chart.resume_pv
              .split('\n')
              .filter((l: string) => l.startsWith('  ') && l.includes('→') || l.toLowerCase().includes('observation'))
              .slice(0, 3)
              .join(' · ')
              .replace('OBSERVATIONS :', '')
              .trim()}
          </p>
        )}
      </div>
    </div>
  );
}

function ImageCard({ image, index }: { image: any; index: number }) {
  // Try to parse JSON description from groq
  let parsed: any = null;
  try {
    const raw = (image.description || '').replace(/```json|```/g, '').trim();
    parsed = JSON.parse(raw);
  } catch {}

  if (parsed) {
    return (
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <BarChart2 className="w-4 h-4" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{parsed.titre || `Graphique image ${index + 1}`}</p>
            <p className="text-xs text-muted-foreground capitalize">{parsed.type || 'Inconnu'} · via IA</p>
          </div>
          <Badge variant="outline" className="text-xs">IA (image)</Badge>
        </div>
        <div className="p-4 space-y-3">
          {(parsed.series || []).map((serie: any, si: number) => (
            <div key={si} className="space-y-1">
              {(serie.valeurs || []).map((val: number, vi: number) => {
                const label = (parsed.categories || [])[vi] || `Item ${vi + 1}`;
                const max = Math.max(...(serie.valeurs || [1]));
                const pct = max > 0 ? Math.round((val / max) * 100) : 0;
                return (
                  <div key={vi} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium w-14 text-right shrink-0">{val}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {(parsed.observations || []).length > 0 && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              {parsed.observations[0]}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Fallback plain image info
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
      <p className="text-sm text-muted-foreground">{image.description || `Image ${index + 1}`}</p>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function ExtractStep() {
  const { slides, updateSlide, deleteSlide, setCurrentStep, agendaItems } = useWorkflow();
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(slides[0]?.id || null);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  const selectedSlide = slides.find(s => s.id === selectedSlideId);

  const handleContentChange = (slideId: string, content: string) => {
    updateSlide(slideId, { extractedContent: content });
  };

  const toggleEditMode = (slideId: string) => {
    setEditMode(prev => ({ ...prev, [slideId]: !prev[slideId] }));
  };

  const getAgendaTitle = (agendaItemId: string) =>
    agendaItems.find(a => a.id === agendaItemId)?.title || 'Non classé';

  const handleDeleteSlide = (slideId: string) => {
    const nextSlide = slides.find(s => s.id !== slideId);
    deleteSlide(slideId);
    setSelectedSlideId(nextSlide?.id || null);
  };

  const hasRichContent = (slide: typeof selectedSlide) =>
    (slide?.tables?.length ?? 0) > 0 ||
    (slide?.charts?.length ?? 0) > 0 ||
    (slide?.images?.length ?? 0) > 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Slide list ── */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Slides Extraites
            </CardTitle>
            <CardDescription>{slides.length} slides détectées</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
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
                        'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0',
                        selectedSlideId === slide.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {slide.title || <span className="italic text-muted-foreground">Sans titre</span>}
                        </p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {getAgendaTitle(slide.agendaItemId)}
                          </Badge>
                          {(slide.tables?.length ?? 0) > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Table2 className="w-3 h-3" />{slide.tables!.length}
                            </Badge>
                          )}
                          {(slide.charts?.length ?? 0) > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <BarChart2 className="w-3 h-3" />{slide.charts!.length}
                            </Badge>
                          )}
                          {(slide.images?.length ?? 0) > 0 && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <ImageIcon className="w-3 h-3" />{slide.images!.length}
                            </Badge>
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

        {/* ── Content panel ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedSlide?.title || (selectedSlide ? 'Sans titre' : 'Sélectionnez une slide')}
                </CardTitle>
                {selectedSlide && (
                  <CardDescription className="mt-1">
                    Slide {selectedSlide.slideNumber} · {getAgendaTitle(selectedSlide.agendaItemId)}
                  </CardDescription>
                )}
              </div>
              {selectedSlide && (
                <div className="flex items-center gap-2">
                  <Button
                    variant={editMode[selectedSlide.id] ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleEditMode(selectedSlide.id)}
                    className="gap-2"
                  >
                    {editMode[selectedSlide.id]
                      ? <><Save className="w-4 h-4" />Sauvegarder</>
                      : <><Edit3 className="w-4 h-4" />Modifier</>}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteSlide(selectedSlide.id)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />Supprimer
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {selectedSlide ? (
              <ScrollArea className="h-[560px] pr-2">
                <div className="space-y-6">

                  {/* ── Meta badges ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Numéro', value: `Slide ${selectedSlide.slideNumber}` },
                      { label: 'Ordre du jour', value: getAgendaTitle(selectedSlide.agendaItemId) },
                      { label: 'Analysée', value: selectedSlide.isAnalyzed ? 'Oui' : 'Non' },
                      { label: 'Validée', value: selectedSlide.isValidated ? 'Oui' : 'Non' },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 bg-muted/40 border rounded-lg">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Text blocks ── */}
                  {(selectedSlide.contentBlocks?.length ?? 0) > 0 && (
                    <section>
                      <SectionTitle icon={<FileText className="w-4 h-4" />} title="Blocs de texte" />
                      <div className="space-y-2 mt-3">
                        {selectedSlide.contentBlocks!.map((block, i) => (
                          <div key={i} className="px-4 py-2 bg-muted/30 border rounded-lg text-sm">
                            {block}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Tables ── */}
                  {(selectedSlide.tables?.length ?? 0) > 0 && (
                    <section>
                      <SectionTitle icon={<Table2 className="w-4 h-4" />} title={`Tableaux (${selectedSlide.tables!.length})`} />
                      <div className="space-y-4 mt-3">
                        {selectedSlide.tables!.map((table, i) => (
                          <div key={i} className="border rounded-xl overflow-hidden">
                            <div className="px-4 py-2 bg-muted/40 border-b text-xs text-muted-foreground">
                              {table.nb_lignes ?? table.lignes?.length ?? 0} lignes
                              × {table.nb_colonnes ?? table.lignes?.[0]?.length ?? 0} colonnes
                            </div>
                            <div className="overflow-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="bg-muted/50">
                                    {(table.lignes?.[0] || []).map((cell: string, ci: number) => (
                                      <th key={ci} className="border-b border-r last:border-r-0 px-3 py-2 text-left text-xs font-semibold">
                                        {cell}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(table.lignes || []).slice(1).map((row: any[], ri: number) => (
                                    <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-muted/20'}>
                                      {row.map((cell, ci) => (
                                        <td key={ci} className="border-b border-r last:border-r-0 px-3 py-2 text-xs">
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Native charts ── */}
                  {(selectedSlide.charts?.length ?? 0) > 0 && (
                    <section>
                      <SectionTitle icon={<BarChart2 className="w-4 h-4" />} title={`Graphiques (${selectedSlide.charts!.length})`} />
                      <div className="space-y-4 mt-3">
                        {selectedSlide.charts!.map((chart, i) => (
                          <ChartCard key={i} chart={chart} index={i} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Image / AI charts ── */}
                  {(selectedSlide.images?.length ?? 0) > 0 && (
                    <section>
                      <SectionTitle icon={<ImageIcon className="w-4 h-4" />} title={`Images analysées (${selectedSlide.images!.length})`} />
                      <div className="space-y-4 mt-3">
                        {selectedSlide.images!.map((img, i) => (
                          <ImageCard key={i} image={img} index={i} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ── Notes ── */}
                  {selectedSlide.notes && (
                    <section>
                      <SectionTitle icon={<StickyNote className="w-4 h-4" />} title="Notes" />
                      <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                        {selectedSlide.notes}
                      </div>
                    </section>
                  )}

                  {/* ── Editable extracted content ── */}
                  <section>
                    <SectionTitle icon={<Edit3 className="w-4 h-4" />} title="Contenu extrait (édition)" />
                    <div className="mt-3">
                      {editMode[selectedSlide.id] ? (
                        <Textarea
                          value={selectedSlide.extractedContent}
                          onChange={e => handleContentChange(selectedSlide.id, e.target.value)}
                          className="min-h-[180px] resize-none"
                          placeholder="Contenu extrait de la slide..."
                        />
                      ) : (
                        <div className="p-4 bg-muted/30 border rounded-lg min-h-[120px]">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                            {selectedSlide.extractedContent || (
                              <span className="text-muted-foreground italic">Aucun contenu extrait.</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ── Tip ── */}
                  <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                    <Check className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm text-accent">
                      Vous pouvez modifier le contenu extrait avant de passer à l&apos;analyse
                    </span>
                  </div>

                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p>Sélectionnez une slide pour voir son contenu</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setCurrentStep('upload')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />Retour
        </Button>
        <Button onClick={() => setCurrentStep('slide-analysis')} className="gap-2">
          Analyser les Slides<ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── tiny helper ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b">
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}