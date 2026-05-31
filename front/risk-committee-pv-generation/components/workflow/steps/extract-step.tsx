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
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PendingImageCard,
  StreamingImageCard,
  ImageAnalysisSummary,
} from '@/components/workflow/extraction-progress-banner';

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

function parseImageDescription(description: unknown) {
  if (!description) return null;
  if (typeof description === 'object') return description;
  if (typeof description !== 'string') return null;

  const raw = description
    .replace(/```(?:json)?|```/g, '')
    .trim();

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeImagePayload(parsed: any, index: number) {
  if (!parsed) return null;

  if (parsed.series && parsed.categories) {
    return {
      ...parsed,
      titre: parsed.titre || parsed.title || `Graphique image ${index + 1}`,
      type: parsed.type || parsed.chart_type || 'Inconnu',
    };
  }

  if (!Array.isArray(parsed.data)) return parsed;

  const points: { label: string; value: number }[] = parsed.data
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any) => {
      if ('x' in item && 'y' in item) {
        return { label: String(item.x ?? ''), value: Number(item.y) };
      }

      if ('label' in item || 'value' in item) {
        return { label: String(item.label ?? ''), value: Number(item.value) };
      }

      const [label, value] = Object.entries(item)[0] || [];
      return { label: String(label ?? ''), value: Number(value) };
    })
    .filter((point: { label: string; value: number }) => point.label && Number.isFinite(point.value));

  if (points.length === 0) return parsed;

  return {
    titre: parsed.titre || parsed.title || `Graphique image ${index + 1}`,
    type: parsed.type || parsed.chart_type || 'Inconnu',
    categories: points.map(point => point.label),
    series: [
      {
        nom: '',
        valeurs: points.map(point => point.value),
      },
    ],
    observations: parsed.observations || [],
    confidence: parsed.confidence,
    source: parsed.source,
  };
}

function imagePayloadFromNormalized(image: any, normalized: any) {
  const categories: string[] = normalized.categories || [];
  const values: number[] = normalized.series?.[0]?.valeurs || [];
  const payload = {
    ...image,
    title: normalized.titre,
    chart_type: normalized.type,
    data: categories.map((label, index) => ({
      [label]: Number(values[index]) || 0,
    })),
    confidence: normalized.confidence,
    source: normalized.source,
    observations: normalized.observations || [],
  };

  return {
    ...payload,
    description: JSON.stringify(payload),
  };
}

function ImageCard({
  image,
  index,
  editable = false,
  onImageChange,
}: {
  image: any;
  index: number;
  editable?: boolean;
  onImageChange?: (image: any) => void;
}) {
  let normalized: any = null;
  const parsed: any = normalizeImagePayload(parseImageDescription(image?.description) || image, index);

  const updateNormalized = (next: any) => {
    onImageChange?.(imagePayloadFromNormalized(image, next));
  };

  // ─── Normalisation ─────────────────────────────
  if (parsed) {
    // Déjà normalisé
    if (parsed.series && parsed.categories) {
      normalized = parsed;
    }

    // Format { data: [...] }
    else if (parsed.data && Array.isArray(parsed.data)) {
      const items = parsed.data.filter((d: any) => d !== null);

      const isXY =
        items.length > 0 &&
        'x' in items[0] &&
        'y' in items[0];

      const categories = isXY
        ? items.map((d: any) => String(d.x))
        : items
            .filter((d: any) => d.value !== null)
            .map((d: any) => String(d.label));

      const valeurs = isXY
        ? items.map((d: any) => Number(d.y))
        : items
            .filter((d: any) => d.value !== null)
            .map((d: any) => Number(d.value));

      normalized = {
        titre: parsed.title || `Graphique image ${index + 1}`,
        type: parsed.chart_type || 'Inconnu',
        categories,
        series: [
          {
            nom: '',
            valeurs,
          },
        ],
        observations: parsed.observations || [],
        confidence: parsed.confidence,
      };
    }
  }

  // ─── Affichage graphique ───────────────────────
  if (normalized) {
    return (
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
          <BarChart2 className="w-4 h-4" />

          <div className="flex-1 min-w-0">
            {editable && (
              <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                <input
                  value={normalized.titre || ''}
                  onChange={e => updateNormalized({ ...normalized, titre: e.target.value })}
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
                  aria-label="Titre du graphique image"
                />
                <input
                  value={normalized.type || ''}
                  onChange={e => updateNormalized({ ...normalized, type: e.target.value })}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                  aria-label="Type du graphique image"
                />
              </div>
            )}
            <p className={cn('text-sm font-semibold truncate', editable && 'hidden')}>
              {normalized.titre}
            </p>

            <p className={cn('text-xs text-muted-foreground capitalize', editable && 'hidden')}>
              {normalized.type} · via IA
            </p>
          </div>

          <Badge variant="outline" className="text-xs">
            IA (image)
          </Badge>
        </div>

        <div className="p-4 space-y-3">
          {(normalized.series || []).map((serie: any, si: number) => (
            <div key={si} className="space-y-1">
              {(serie.valeurs || []).map((val: number, vi: number) => {
                const label =
                  (normalized.categories || [])[vi] ||
                  `Item ${vi + 1}`;

                const max = Math.max(...(serie.valeurs || [1]));

                const pct =
                  max > 0
                    ? Math.round((val / max) * 100)
                    : 0;

                return (
                  <div
                    key={vi}
                    className="flex items-center gap-3"
                  >
                    {editable ? (
                      <input
                        value={label}
                        onChange={e => {
                          const categories = [...(normalized.categories || [])];
                          categories[vi] = e.target.value;
                          updateNormalized({ ...normalized, categories });
                        }}
                        className="h-8 w-32 shrink-0 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                        aria-label={`Libelle ${vi + 1}`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">
                        {label}
                      </span>
                    )}

                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {editable ? (
                      <input
                        value={val}
                        onChange={e => {
                          const series = [...(normalized.series || [])];
                          const currentSerie = series[si] || { nom: '', valeurs: [] };
                          const valeurs = [...(currentSerie.valeurs || [])];
                          valeurs[vi] = Number(e.target.value);
                          series[si] = { ...currentSerie, valeurs };
                          updateNormalized({ ...normalized, series });
                        }}
                        className="h-8 w-20 shrink-0 rounded-md border bg-background px-2 text-right text-xs font-medium outline-none focus:ring-2 focus:ring-primary/25"
                        aria-label={`Valeur ${vi + 1}`}
                        type="number"
                      />
                    ) : (
                      <span className="text-xs font-medium w-14 text-right shrink-0">
                        {val}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {(normalized.observations || []).length > 0 && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              {normalized.observations[0]}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Fallback ──────────────────────────────────
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-card">
      <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />

      {editable ? (
        <Textarea
          value={
            typeof image?.description === 'string'
              ? image.description
              : JSON.stringify(image || {}, null, 2)
          }
          onChange={e => onImageChange?.({ ...image, description: e.target.value })}
          className="min-h-20 resize-none text-xs"
          aria-label={`Description image ${index + 1}`}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {image?.description || `Image ${index + 1}`}
        </p>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

function isImagePending(image: any) {
  return image?.status === 'pending';
}

function isImageStreaming(image: any) {
  return image?.status === 'streaming';
}

function isImageDone(image: any) {
  return image?.status === 'done';
}

export function ExtractStep() {
  const {
    slides,
    updateSlide,
    deleteSlide,
    setCurrentStep,
    agendaItems,
    imageExtraction,
    runSingleImageAnalysis,
    isImageAnalyzing,
  } = useWorkflow();
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(slides[0]?.id || null);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});

  const selectedSlide = slides.find(s => s.id === selectedSlideId);

  const handleContentChange = (slideId: string, content: string) => {
    updateSlide(slideId, { extractedContent: content });
  };

  const handleTableCellChange = (
    slideId: string,
    tableIndex: number,
    rowIndex: number,
    cellIndex: number,
    value: string
  ) => {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return;

    const tables = [...(slide.tables || [])];
    const table = tables[tableIndex];
    if (!table) return;

    const lignes = (table.lignes || []).map((row: any[]) => [...row]);
    lignes[rowIndex] = lignes[rowIndex] || [];
    lignes[rowIndex][cellIndex] = value;
    tables[tableIndex] = {
      ...table,
      lignes,
      nb_lignes: lignes.length,
      nb_colonnes: Math.max(...lignes.map((row: any[]) => row.length), 0),
    };

    updateSlide(slideId, { tables });
  };

  const handleImageChange = (slideId: string, imageIndex: number, image: any) => {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return;

    const images = [...(slide.images || [])];
    images[imageIndex] = image;
    updateSlide(slideId, { images });
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

  const pendingImagesOnSlide = (slide: (typeof slides)[0]) =>
    (slide.images || []).filter(img => isImagePending(img)).length;

  const streamingImagesOnSlide = (slide: (typeof slides)[0]) =>
    (slide.images || []).filter(img => isImageStreaming(img)).length;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <ImageAnalysisSummary imageExtraction={imageExtraction} />

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
                            <Badge
                              variant={
                                pendingImagesOnSlide(slide) > 0 || streamingImagesOnSlide(slide) > 0
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="text-xs gap-1"
                            >
                              <ImageIcon className="w-3 h-3" />
                              {streamingImagesOnSlide(slide) > 0
                                ? 'stream…'
                                : pendingImagesOnSlide(slide) > 0
                                  ? `${pendingImagesOnSlide(slide)}/${slide.images!.length}…`
                                  : slide.images!.length}
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
                                        {editMode[selectedSlide.id] ? (
                                          <input
                                            value={cell}
                                            onChange={e => handleTableCellChange(selectedSlide.id, i, 0, ci, e.target.value)}
                                            className="h-8 min-w-28 w-full rounded-md border bg-background px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/25"
                                            aria-label={`Entete colonne ${ci + 1}`}
                                          />
                                        ) : (
                                          cell
                                        )}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(table.lignes || []).slice(1).map((row: any[], ri: number) => (
                                    <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-muted/20'}>
                                      {row.map((cell, ci) => (
                                        <td key={ci} className="border-b border-r last:border-r-0 px-3 py-2 text-xs">
                                          {editMode[selectedSlide.id] ? (
                                            <input
                                              value={cell}
                                              onChange={e => handleTableCellChange(selectedSlide.id, i, ri + 1, ci, e.target.value)}
                                              className="h-8 min-w-28 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/25"
                                              aria-label={`Cellule ligne ${ri + 2}, colonne ${ci + 1}`}
                                            />
                                          ) : (
                                            cell
                                          )}
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
                      <SectionTitle
                        icon={<ImageIcon className="w-4 h-4" />}
                        title={`Images analysées (${selectedSlide.images!.length})`}
                      />
                      <div className="space-y-4 mt-3">
                        {selectedSlide.images!.map((img, i) => {
                          const analyzing = selectedSlide
                            ? isImageAnalyzing(selectedSlide.slideNumber, i)
                            : false;
                          const streaming = isImageStreaming(img) || analyzing;

                          if (streaming) {
                            return (
                              <StreamingImageCard
                                key={i}
                                index={i}
                                streamText={String(img?.streamText || '')}
                                statusMessage={String(img?.streamStatus || '')}
                                starting={!img?.streamText}
                              />
                            );
                          }

                          if (isImagePending(img)) {
                            return (
                              <PendingImageCard
                                key={i}
                                index={i}
                                canAnalyze={!!imageExtraction.token}
                                onAnalyze={() =>
                                  runSingleImageAnalysis(selectedSlide.slideNumber, i)
                                }
                              />
                            );
                          }

                          if (isImageDone(img)) {
                            return (
                              <div key={i} className="space-y-2">
                                <ImageCard
                                  image={img}
                                  index={i}
                                  editable={editMode[selectedSlide.id]}
                                  onImageChange={image =>
                                    handleImageChange(selectedSlide.id, i, image)
                                  }
                                />
                                <div className="flex justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                    disabled={isImageAnalyzing(selectedSlide.slideNumber, i)}
                                    onClick={() =>
                                      runSingleImageAnalysis(selectedSlide.slideNumber, i)
                                    }
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                    Ré-analyser cette image
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          if (img?.status === 'error') {
                            return (
                              <div key={i} className="space-y-2">
                                <div className="p-4 border border-destructive/40 rounded-xl bg-destructive/5 text-sm text-destructive">
                                  Erreur image {i + 1} : {img.error || img.description}
                                </div>
                                <PendingImageCard
                                  index={i}
                                  canAnalyze={!!imageExtraction.token}
                                  onAnalyze={() =>
                                    runSingleImageAnalysis(selectedSlide.slideNumber, i)
                                  }
                                />
                              </div>
                            );
                          }

                          return (
                            <ImageCard
                              key={i}
                              image={img}
                              index={i}
                              editable={editMode[selectedSlide.id]}
                              onImageChange={image =>
                                handleImageChange(selectedSlide.id, i, image)
                              }
                            />
                          );
                        })}
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
                      Vous pouvez modifier le contenu extrait, les tableaux et les graphiques images avant de passer à l&apos;analyse
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
      <Button onClick={() => setCurrentStep('agenda-analysis')} className="gap-2">
        Analyse par Ordre du Jour <ArrowRight className="w-4 h-4" />
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
