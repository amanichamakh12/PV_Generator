'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useWorkflow } from '@/contexts/workflow-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageAnalysisSummary } from '@/components/workflow/extraction-progress-banner';
import {
  Upload,
  Presentation,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  Table2,
  BarChart2,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PVDocument } from '@/types/pv-generator';
import { getApiBaseUrl, mapRawSlidesToWorkflow } from '@/lib/pptx-import';

type UploadPhase = 'idle' | 'parsing' | 'ready' | 'error';

export function UploadStep() {
  const {
    slides,
    setSlides,
    setAgendaItems,
    setDocument,
    setCurrentStep,
    setProcessing,
    prepareImageExtraction,
    imageExtraction,
  } = useWorkflow();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    slides: 0,
    charts: 0,
    tables: 0,
    pendingImages: 0,
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const validTypes = [
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ];
      if (
        !validTypes.includes(file.type) &&
        !file.name.endsWith('.pptx') &&
        !file.name.endsWith('.ppt')
      ) {
        setPhase('error');
        setErrorMessage('Veuillez importer un fichier PowerPoint (.ppt ou .pptx)');
        return;
      }

      setUploadedFile(file);
      setPhase('parsing');
      setProcessing(true);
      setErrorMessage('');

      try {
        const apiUrl = getApiBaseUrl();
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${apiUrl}/api/parse-pptx/fast`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `API error ${res.status}`);
        }

        const data = await res.json();
        const rawSlides: any[] = data.slides || [];
        const { slides: mappedSlides, agendaItems } = mapRawSlidesToWorkflow(rawSlides);

        const chartCount = rawSlides.reduce(
          (acc, s) => acc + (s.graphiques?.length || 0),
          0,
        );
        const tableCount = rawSlides.reduce(
          (acc, s) => acc + (s.tableaux?.length || 0),
          0,
        );
        const pendingImages = data.nb_images_pending || 0;

        setStats({
          slides: rawSlides.length,
          charts: chartCount,
          tables: tableCount,
          pendingImages,
        });

        setSlides(mappedSlides);
        setAgendaItems(agendaItems);

        const newDocument: PVDocument = {
          id: `pv-${Date.now()}`,
          title: `PV Comité des Risques - ${new Date().toLocaleDateString('fr-FR')}`,
          date: new Date(),
          committeeType: 'Comité des Risques',
          participants: [],
          agendaItems,
          draftContent: '',
          finalContent: '',
          status: 'draft',
          translations: {},
        };
        setDocument(newDocument);

        setPhase('ready');
        setProcessing(false);

        if (data.token) {
          prepareImageExtraction(data.token, pendingImages);
        }
      } catch (err: any) {
        if (err instanceof TypeError) {
          setErrorMessage(
            `Serveur injoignable sur ${getApiBaseUrl()} — vérifiez que le backend tourne`,
          );
        } else {
          setErrorMessage(err?.message || 'Erreur lors du traitement du fichier');
        }
        setPhase('error');
        setProcessing(false);
      }
    },
    [setSlides, setAgendaItems, setDocument, setProcessing, prepareImageExtraction],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    multiple: false,
    disabled: phase === 'parsing',
  });

  const handleContinue = () => {
    setCurrentStep('extract');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-2 border-dashed border-primary/30 bg-card/50 backdrop-blur">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Presentation className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Importer le Support de Comité</CardTitle>
          <CardDescription className="text-base">
            Extraction immédiate du texte et des tableaux — analyse image par image, à la demande
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
              isDragActive && 'border-primary bg-primary/5 scale-[1.02]',
              phase === 'idle' && 'border-border hover:border-primary/50 hover:bg-muted/50',
              phase === 'parsing' && 'border-info bg-info/5',
              phase === 'ready' && 'border-accent bg-accent/5',
              phase === 'error' && 'border-destructive bg-destructive/5',
              phase === 'parsing' && 'pointer-events-none opacity-80',
            )}
          >
            <input {...getInputProps()} />

            {phase === 'idle' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <Upload
                    className={cn('w-10 h-10 text-muted-foreground', isDragActive && 'text-primary')}
                  />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {isDragActive ? 'Déposez le fichier ici...' : 'Glissez votre fichier PowerPoint ici'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ou <span className="text-primary font-medium">cliquez pour parcourir</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Formats acceptés: .ppt, .pptx</p>
              </div>
            )}

            {phase === 'parsing' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-info/20 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-info border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Extraction du contenu texte…</p>
                  <p className="text-sm text-muted-foreground mt-1">{uploadedFile?.name}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Le texte et les tableaux sont prêts. Analysez chaque image individuellement à l&apos;étape suivante.
                  </p>
                </div>
              </div>
            )}

            {phase === 'ready' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Contenu extrait — prêt à consulter</p>
                  <p className="text-sm text-muted-foreground mt-1">{uploadedFile?.name}</p>
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div className="space-y-4">
                <div className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">Erreur d&apos;importation</p>
                  <p className="text-sm text-destructive mt-1">{errorMessage}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={e => {
                    e.stopPropagation();
                    setPhase('idle');
                    setUploadedFile(null);
                  }}
                >
                  Réessayer
                </Button>
              </div>
            )}
          </div>

          {phase === 'ready' && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={<FileText className="w-4 h-4" />} label="Slides" value={stats.slides} />
                <StatCard icon={<Table2 className="w-4 h-4" />} label="Tableaux" value={stats.tables} />
                <StatCard icon={<BarChart2 className="w-4 h-4" />} label="Graphiques natifs" value={stats.charts} />
                <StatCard icon={<ImageIcon className="w-4 h-4" />} label="Images IA" value={stats.pendingImages} />
              </div>

              <ImageAnalysisSummary imageExtraction={imageExtraction} className="text-center" />

              {stats.pendingImages > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  {stats.pendingImages} image{stats.pendingImages > 1 ? 's' : ''} en attente — bouton
                  &laquo;&nbsp;Analyser&nbsp;&raquo; sur chaque image dans l&apos;écran d&apos;extraction.
                </p>
              )}

              {slides.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-muted/40 border-b text-sm font-medium">
                    Aperçu des slides extraites
                  </div>
                  <div className="max-h-48 overflow-auto divide-y">
                    {slides.slice(0, 8).map(slide => (
                      <div key={slide.id} className="px-4 py-3 flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0">
                          {slide.slideNumber}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{slide.title || 'Sans titre'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {slide.contentBlocks?.[0] || slide.extractedContent || 'Contenu disponible'}
                          </p>
                        </div>
                        {(slide.images?.length ?? 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {slide.images?.some(img => img?.status === 'streaming')
                              ? 'stream…'
                              : slide.images?.some(img => img?.status === 'pending')
                                ? `${slide.images.length} img`
                                : `${slide.images?.length} img`}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button size="lg" onClick={handleContinue} className="gap-2">
                  Voir l&apos;extraction
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="p-3 rounded-lg border bg-card text-center">
      <div className="flex justify-center text-muted-foreground mb-1">{icon}</div>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
