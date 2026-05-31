import type { AgendaItem, Slide } from '@/types/pv-generator';

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
}

export function normalizeStreamImageResult(result: unknown) {
  if (!result || typeof result !== 'object') {
    return {
      status: 'done',
      description: String(result ?? ''),
    };
  }

  const payload = result as Record<string, unknown>;
  if (payload.erreur) {
    return {
      status: 'error',
      description: String(payload.erreur),
      error: String(payload.erreur),
    };
  }

  if (typeof payload.description === 'string') {
    return { status: 'done', ...payload };
  }

  return {
    status: 'done',
    description: JSON.stringify(payload),
    ...payload,
  };
}

export function mapRawSlidesToWorkflow(rawSlides: any[]): {
  slides: Slide[];
  agendaItems: AgendaItem[];
} {
  const agendaMap = new Map<string, string>();

  const slides: Slide[] = rawSlides.map((s, idx) => {
    const agendaTitle = (s['ordre du jour'] || s.ordre_du_jour || '').toString().trim();
    let agendaId = '';
    if (agendaTitle) {
      if (!agendaMap.has(agendaTitle)) {
        agendaMap.set(agendaTitle, `agenda-${agendaMap.size + 1}`);
      }
      agendaId = agendaMap.get(agendaTitle) as string;
    }

    const title = (s.titre || s.title || '').toString();
    const contentField = s.contenu || s.content || [];
    const content = Array.isArray(contentField)
      ? contentField.join('\n')
      : (contentField || '').toString();
    const extractedContent = (s.texte || s.extracted_text || content).toString();

    const rawImages = s.images || [];
    const images = rawImages.map((img: any) => {
      if (img?.status === 'pending') {
        return { status: 'pending' as const };
      }
      return normalizeStreamImageResult(img);
    });

    return {
      id: `slide-${idx + 1}`,
      slideNumber: s.index || s.slide_index || idx + 1,
      title,
      content,
      extractedContent,
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      agendaItemId: agendaId,
      contentBlocks: Array.isArray(s.contenu) ? s.contenu : [],
      tables: s.tableaux || [],
      charts: s.graphiques || [],
      images,
      notes: s.notes || null,
      rawSlide: s,
    };
  });

  const agendaItems: AgendaItem[] = Array.from(agendaMap.keys()).map((title, i) => {
    const id = `agenda-${i + 1}`;
    return {
      id,
      title,
      order: i + 1,
      slides: slides.filter(s => s.agendaItemId === id),
      analysis: '',
      isAnalyzed: false,
      isValidated: false,
      notes: [],
    };
  });

  return { slides, agendaItems };
}

export type ImageStreamEvent =
  | { type: 'image_start'; slide_index: number; image_index: number }
  | {
      type: 'image_status';
      slide_index: number;
      image_index: number;
      phase: string;
      message: string;
      elapsed_seconds?: number;
    }
  | { type: 'image_chunk'; slide_index: number; image_index: number; delta: string }
  | { type: 'image_done'; slide_index: number; image_index: number; result: unknown }
  | { type: 'image_error'; slide_index: number; image_index: number; error: string }
  | { type: 'done'; done: true; reason?: string }
  | { type: 'error'; erreur: string };

async function consumeImageSSE(
  res: Response,
  onEvent: (event: ImageStreamEvent) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Flux SSE indisponible');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;

      try {
        const data = JSON.parse(line.slice(5).trim()) as ImageStreamEvent & Record<string, unknown>;
        if (data.type === 'done' || data.done) return;
        if (data.type === 'error' || data.erreur) {
          throw new Error(String(data.erreur || 'Erreur stream image'));
        }
        if (data.type) {
          onEvent(data as ImageStreamEvent);
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Erreur stream')) throw err;
      }
    }
  }
}

export async function streamSingleImageAnalysis(
  token: string,
  slideIndex: number,
  imageIndex: number,
  onEvent: (event: ImageStreamEvent) => void,
): Promise<void> {
  const apiUrl = getApiBaseUrl();
  const res = await fetch(`${apiUrl}/api/parse-pptx/analyze-image-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      slide_index: slideIndex,
      image_index: imageIndex,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Erreur analyse image (${res.status})`);
  }

  await consumeImageSSE(res, onEvent);
}
