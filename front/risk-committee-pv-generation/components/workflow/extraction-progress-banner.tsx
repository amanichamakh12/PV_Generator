'use client';

import { useEffect, useRef } from 'react';
import { Loader2, ImageIcon, Sparkles, Play, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ImageExtractionState } from '@/types/pv-generator';

export function ImageAnalysisSummary({
  imageExtraction,
  className,
}: {
  imageExtraction: ImageExtractionState;
  className?: string;
}) {
  const { total, completed } = imageExtraction;
  if (total === 0) return null;

  return (
    <div className={cn('text-xs text-muted-foreground', className)}>
      {completed}/{total} image{total > 1 ? 's' : ''} analysée{completed > 1 ? 's' : ''} — lancez
      chaque analyse individuellement ci-dessous.
    </div>
  );
}

export function PendingImageCard({
  index,
  onAnalyze,
  canAnalyze = true,
  isDone = false,
}: {
  index: number;
  onAnalyze?: () => void;
  canAnalyze?: boolean;
  isDone?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-xl bg-muted/20 border-dashed">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <ImageIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Image {index + 1}</p>
          <p className="text-xs text-muted-foreground">
            {isDone
              ? 'Analyse terminée — vous pouvez relancer si besoin'
              : 'Graphique détecté — lancez l\'analyse Ollama pour cette image uniquement'}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={isDone ? 'outline' : 'default'}
        className="gap-2 shrink-0"
        disabled={!canAnalyze}
        onClick={onAnalyze}
      >
        {isDone ? (
          <>
            <RotateCcw className="w-4 h-4" />
            Ré-analyser
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Analyser
          </>
        )}
      </Button>
    </div>
  );
}

function formatStreamPreview(text: string) {
  if (!text) return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function StreamingImageCard({
  index,
  streamText,
  statusMessage,
  starting = false,
}: {
  index: number;
  streamText: string;
  statusMessage?: string;
  starting?: boolean;
}) {
  const display = formatStreamPreview(streamText);
  const scrollRef = useRef<HTMLDivElement>(null);
  const subtitle =
    statusMessage ||
    (starting && !streamText
      ? 'Connexion à Ollama…'
      : 'Réponse en cours — affichage progressif');

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [display]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card border-info/30">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-info/5">
        <Sparkles className="w-4 h-4 text-info animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Image {index + 1}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant="secondary" className="text-xs shrink-0 gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Stream
        </Badge>
      </div>
      <div ref={scrollRef} className="p-4 bg-muted/20 max-h-64 overflow-auto min-h-[80px]">
        {display ? (
          <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-foreground">
            {display}
            <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-info animate-pulse" />
          </pre>
        ) : (
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              {statusMessage || 'En attente des premiers tokens…'}
            </div>
            {!display && (
              <p className="text-[11px] leading-relaxed pl-6 opacity-80">
                Sur CPU avec le modèle 3b, comptez ~30 s avant le premier token
                (chargement + analyse de l&apos;image).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
