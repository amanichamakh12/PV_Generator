'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import type {
  WorkflowStep,
  WorkflowState,
  Slide,
  AgendaItem,
  PVDocument,
  MeetingNote,
  ImageExtractionState,
} from '@/types/pv-generator';
import {
  normalizeStreamImageResult,
  streamSingleImageAnalysis,
  getApiBaseUrl,
} from '@/lib/pptx-import';

interface WorkflowContextType extends WorkflowState {
  sessionId: number | null;
  setSessionId: (id: number | null) => void;
  setCurrentStep: (step: WorkflowStep) => void;
  setSlides: (slides: Slide[]) => void;
  updateSlide: (slideId: string, updates: Partial<Slide>) => void;
  updateSlideImage: (slideNumber: number, imageIndex: number, result: unknown) => void;
  startSlideImageStream: (slideNumber: number, imageIndex: number) => void;
  appendSlideImageStream: (slideNumber: number, imageIndex: number, delta: string) => void;
  finishSlideImageStream: (slideNumber: number, imageIndex: number, result: unknown) => void;
  failSlideImageStream: (slideNumber: number, imageIndex: number, error: string) => void;
  deleteSlide: (slideId: string) => void;
  setAgendaItems: (items: AgendaItem[]) => void;
  updateAgendaItem: (itemId: string, updates: Partial<AgendaItem>) => void;
  addMeetingNote: (agendaItemId: string, note: Omit<MeetingNote, 'id'>, agendaItemDbId?: number) => void;
  updateMeetingNote: (agendaItemId: string, noteId: string, content: string) => void;
  deleteMeetingNote: (agendaItemId: string, noteId: string, noteDbId?: number) => void;
  setDocument: (doc: PVDocument | null) => void;
  updateDocument: (updates: Partial<PVDocument>) => void;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
  resetWorkflow: () => void;
  canProceedToNextStep: () => boolean;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  prepareImageExtraction: (token: string, total: number, sessionId?: string) => void;
  runSingleImageAnalysis: (slideNumber: number, imageIndex: number) => Promise<void>;
  isImageAnalyzing: (slideNumber: number, imageIndex: number) => boolean;
  loadSession: (sessionId: number) => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

const WORKFLOW_STEPS: WorkflowStep[] = [
  'upload',
  'extract',
  'agenda-analysis',
  'draft-generation',
  'meeting-notes',
  'final-pv',
  'translation',
];

const initialImageExtraction: ImageExtractionState = {
  token: null,
  total: 0,
  completed: 0,
  error: null,
};

function imageStreamKey(slideNumber: number, imageIndex: number) {
  return `${slideNumber}:${imageIndex}`;
}

const initialState: WorkflowState = {
  currentStep: 'home',
  document: null,
  slides: [],
  agendaItems: [],
  isProcessing: false,
  error: null,
  draftContent: '',
  draftJson: null,
  finalContent: '',
  finalJson: null,
  imageExtraction: initialImageExtraction,
};

function syncAgendaSlides(slides: Slide[], agendaItems: AgendaItem[]) {
  return agendaItems.map(item => ({
    ...item,
    slides: slides.filter(s => s.agendaItemId === item.id),
  }));
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkflowState>(initialState);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const activeStreamsRef = useRef<Set<string>>(new Set());
  const extractionTokenRef = useRef<string | null>(null);
  const extractionSessionIdRef = useRef<string>('');
  const [, forceStreamTick] = useState(0);

  const setCurrentStep = useCallback((step: WorkflowStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const setSlides = useCallback((slides: Slide[]) => {
    setState(prev => ({
      ...prev,
      slides,
      agendaItems: syncAgendaSlides(slides, prev.agendaItems),
    }));
  }, []);

  const updateSlide = useCallback((slideId: string, updates: Partial<Slide>) => {
    setState(prev => {
      const slides = prev.slides.map(slide =>
        slide.id === slideId ? { ...slide, ...updates } : slide,
      );
      return {
        ...prev,
        slides,
        agendaItems: syncAgendaSlides(slides, prev.agendaItems),
      };
    });
  }, []);

  const updateSlideImage = useCallback(
    (slideNumber: number, imageIndex: number, result: unknown) => {
      const normalized = normalizeStreamImageResult(result);
      setState(prev => {
        const slides = prev.slides.map(slide => {
          if (slide.slideNumber !== slideNumber) return slide;
          const images = [...(slide.images || [])];
          images[imageIndex] = normalized;
          return { ...slide, images };
        });
        return {
          ...prev,
          slides,
          agendaItems: syncAgendaSlides(slides, prev.agendaItems),
        };
      });
    },
    [],
  );

  const patchSlideImage = useCallback(
    (
      slideNumber: number,
      imageIndex: number,
      patch: Record<string, unknown>,
    ) => {
      setState(prev => {
        const slides = prev.slides.map(slide => {
          if (slide.slideNumber !== slideNumber) return slide;
          const images = [...(slide.images || [])];
          images[imageIndex] = { ...(images[imageIndex] || {}), ...patch };
          return { ...slide, images };
        });
        return {
          ...prev,
          slides,
          agendaItems: syncAgendaSlides(slides, prev.agendaItems),
        };
      });
    },
    [],
  );

  const startSlideImageStream = useCallback(
    (slideNumber: number, imageIndex: number) => {
      patchSlideImage(slideNumber, imageIndex, {
        status: 'streaming',
        streamText: '',
        streamStatus: 'Connexion au serveur…',
      });
    },
    [patchSlideImage],
  );

  const updateSlideImageStreamStatus = useCallback(
    (slideNumber: number, imageIndex: number, message: string) => {
      patchSlideImage(slideNumber, imageIndex, {
        status: 'streaming',
        streamStatus: message,
      });
    },
    [patchSlideImage],
  );

  const appendSlideImageStream = useCallback(
    (slideNumber: number, imageIndex: number, delta: string) => {
      setState(prev => {
        const slides = prev.slides.map(slide => {
          if (slide.slideNumber !== slideNumber) return slide;
          const images = [...(slide.images || [])];
          const current = (images[imageIndex] || {}) as Record<string, unknown>;
          images[imageIndex] = {
            ...current,
            status: 'streaming',
            streamText: `${current.streamText || ''}${delta}`,
          };
          return { ...slide, images };
        });
        return {
          ...prev,
          slides,
          agendaItems: syncAgendaSlides(slides, prev.agendaItems),
        };
      });
    },
    [],
  );

  const finishSlideImageStream = useCallback(
    (slideNumber: number, imageIndex: number, result: unknown) => {
      updateSlideImage(slideNumber, imageIndex, result);
    },
    [updateSlideImage],
  );

  const failSlideImageStream = useCallback(
    (slideNumber: number, imageIndex: number, error: string) => {
      patchSlideImage(slideNumber, imageIndex, {
        status: 'error',
        error,
        description: error,
      });
    },
    [patchSlideImage],
  );

  const setAgendaItems = useCallback((agendaItems: AgendaItem[]) => {
    setState(prev => ({ ...prev, agendaItems }));
  }, []);

  const deleteSlide = useCallback((slideId: string) => {
    setState(prev => {
      const slides = prev.slides.filter(slide => slide.id !== slideId);
      return {
        ...prev,
        slides,
        agendaItems: syncAgendaSlides(slides, prev.agendaItems),
      };
    });
  }, []);

  const updateAgendaItem = useCallback((itemId: string, updates: Partial<AgendaItem>) => {
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    }));
  }, []);

  const addMeetingNote = useCallback((
    agendaItemId: string,
    note: Omit<MeetingNote, 'id'>,
    agendaItemDbId?: number,
  ) => {
    const newNote: MeetingNote = {
      ...note,
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    };

    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === agendaItemId ? { ...item, notes: [...item.notes, newNote] } : item,
      ),
    }));

    if (sessionId) {
      fetch(`${getApiBaseUrl()}/api/meeting-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant: note.speaker,
          content: note.content,
          agenda_item_index: agendaItemDbId ?? null,
          type: note.type ?? 'note',
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.id) return;
          setState(prev => ({
            ...prev,
            agendaItems: prev.agendaItems.map(item =>
              item.id === agendaItemId
                ? {
                    ...item,
                    notes: item.notes.map(n =>
                      n.id === newNote.id ? { ...n, db_id: data.id } : n,
                    ),
                  }
                : item,
            ),
          }));
        })
        .catch(() => {});
    }
  }, [sessionId]);

  const updateMeetingNote = useCallback(
    (agendaItemId: string, noteId: string, content: string) => {
      let noteDbId: number | undefined;
      setState(prev => {
        const updated = {
          ...prev,
          agendaItems: prev.agendaItems.map(item =>
            item.id === agendaItemId
              ? {
                  ...item,
                  notes: item.notes.map(note => {
                    if (note.id === noteId) {
                      noteDbId = note.db_id;
                      return { ...note, content };
                    }
                    return note;
                  }),
                }
              : item,
          ),
        };
        return updated;
      });

      if (noteDbId) {
        fetch(`${getApiBaseUrl()}/api/meeting-notes/${noteDbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }).catch(() => {});
      }
    },
    [],
  );

  const deleteMeetingNote = useCallback((agendaItemId: string, noteId: string, noteDbId?: number) => {
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === agendaItemId
          ? { ...item, notes: item.notes.filter(note => note.id !== noteId) }
          : item,
      ),
    }));

    if (noteDbId) {
      fetch(`${getApiBaseUrl()}/api/meeting-notes/${noteDbId}`, { method: 'DELETE' })
        .catch(() => {});
    }
  }, []);

  const setDocument = useCallback((document: PVDocument | null) => {
    setState(prev => ({ ...prev, document }));
  }, []);

  const updateDocument = useCallback((updates: Partial<PVDocument>) => {
    setState(prev => ({
      ...prev,
      document: prev.document ? { ...prev.document, ...updates } : null,
    }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const resetWorkflow = useCallback(() => {
    activeStreamsRef.current.clear();
    extractionTokenRef.current = null;
    setState(initialState);
  }, []);

  const prepareImageExtraction = useCallback((token: string, total: number, sessionId = '') => {
    extractionTokenRef.current = token;
    extractionSessionIdRef.current = sessionId;
    setState(prev => ({
      ...prev,
      imageExtraction: {
        token,
        total,
        completed: 0,
        error: null,
      },
    }));
  }, []);

  const bumpCompleted = useCallback(() => {
    setState(prev => ({
      ...prev,
      imageExtraction: {
        ...prev.imageExtraction,
        completed: Math.min(prev.imageExtraction.completed + 1, prev.imageExtraction.total),
      },
    }));
  }, []);

  const isImageAnalyzing = useCallback((slideNumber: number, imageIndex: number) => {
    return activeStreamsRef.current.has(imageStreamKey(slideNumber, imageIndex));
  }, []);

  const runSingleImageAnalysis = useCallback(
    async (slideNumber: number, imageIndex: number) => {
      const token = extractionTokenRef.current;
      if (!token) return;

      const key = imageStreamKey(slideNumber, imageIndex);
      if (activeStreamsRef.current.has(key)) return;

      activeStreamsRef.current.add(key);
      forceStreamTick(n => n + 1);

      setState(prev => {
        const slide = prev.slides.find(s => s.slideNumber === slideNumber);
        const img = slide?.images?.[imageIndex] as { status?: string } | undefined;
        if (img?.status === 'done') {
          return {
            ...prev,
            imageExtraction: {
              ...prev.imageExtraction,
              completed: Math.max(0, prev.imageExtraction.completed - 1),
            },
          };
        }
        return prev;
      });

      startSlideImageStream(slideNumber, imageIndex);

      try {
        await streamSingleImageAnalysis(token, slideNumber, imageIndex, extractionSessionIdRef.current, event => {
          if (event.type === 'image_status') {
            updateSlideImageStreamStatus(
              event.slide_index,
              event.image_index,
              event.message,
            );
            return;
          }
          if (event.type === 'image_chunk') {
            appendSlideImageStream(event.slide_index, event.image_index, event.delta);
            return;
          }
          if (event.type === 'image_done') {
            finishSlideImageStream(event.slide_index, event.image_index, event.result);
            bumpCompleted();
            return;
          }
          if (event.type === 'image_error') {
            failSlideImageStream(event.slide_index, event.image_index, event.error);
          }
        });
      } catch (err: any) {
        failSlideImageStream(
          slideNumber,
          imageIndex,
          err?.message || 'Erreur lors de l analyse de l image',
        );
        setState(prev => ({
          ...prev,
          imageExtraction: {
            ...prev.imageExtraction,
            error: err?.message || 'Erreur lors de l analyse de l image',
          },
        }));
      } finally {
        activeStreamsRef.current.delete(key);
        forceStreamTick(n => n + 1);
      }
    },
    [
      startSlideImageStream,
      updateSlideImageStreamStatus,
      appendSlideImageStream,
      finishSlideImageStream,
      failSlideImageStream,
      bumpCompleted,
    ],
  );

  const loadSession = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/sessions/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Build agenda ordre map: agenda_item.id → ordre
      const agendaOrdreMap: Record<number, number> = {};
      for (const a of data.agenda_items ?? []) {
        agendaOrdreMap[a.id] = a.ordre;
      }

      const mappedSlides: Slide[] = (data.slides ?? []).map((s: any) => {
        const smolvlmImages = (s.charts ?? [])
          .filter((c: any) => c.extraction_method === 'smolvlm')
          .map((c: any) => ({
            db_id: c.id,
            status: 'done',
            ...(c.chart_data ?? {}),
          }));



        const nativeCharts = (s.charts ?? []).filter((c: any) => c.extraction_method !== 'smolvlm');

        console.log(`Slide ${s.slide_number} — SmolVLM images (normalized):`, smolvlmImages);
        console.log(`Slide ${s.slide_number} — charts natifs:`, nativeCharts);

        return {
          id: `slide-${s.id}`,
          db_id: s.id,
          slideNumber: s.slide_number,
          title: s.titre ?? '',
          content: s.contenu ?? '',
          extractedContent: s.contenu ?? '',
          analysis: '',
          isAnalyzed: false,
          isValidated: false,
          agendaItemId: s.agenda_item_index != null
            ? `agenda-${agendaOrdreMap[s.agenda_item_index] ?? s.agenda_item_index}`
            : '',
          tables: (s.tables ?? []).map((t: any) => ({
            db_id: t.id,
            ...(t.table_data && typeof t.table_data === 'object' ? t.table_data : {}),
          })),
          images: smolvlmImages,
          charts: nativeCharts,
        };
      });
      
      // Group meeting notes by their agenda item DB id
      const notesByAgendaDbId: Record<number, MeetingNote[]> = {};
      for (const n of data.meeting_notes ?? []) {
        const key = n.agenda_item_index as number;
        if (key == null) continue;
        if (!notesByAgendaDbId[key]) notesByAgendaDbId[key] = [];
        notesByAgendaDbId[key].push({
          id: `note-${n.id}`,
          db_id: n.id,
          speaker: n.participant ?? '',
          content: n.content ?? '',
          timestamp: n.created_at ? new Date(n.created_at) : new Date(),
          type: (n.type === 'recommendation' ? 'recommendation' : 'note') as 'note' | 'recommendation',
        });
      }

      const mappedAgenda: AgendaItem[] = (data.agenda_items ?? []).map((a: any) => ({
        id: `agenda-${a.ordre}`,
        db_id: a.id,
        title: a.titre ?? '',
        order: a.ordre,
        slides: [],
        analysis: a.analysis ?? '',
        isAnalyzed: !!a.analysis,
        isValidated: !!a.analysis,
        notes: notesByAgendaDbId[a.id] ?? [],
        reformulatedNotes: a.reformulated_notes ?? undefined,
      }));

      const draft = data.draft ?? null;
      // participants may be strings ("nom — role") or legacy objects {nom, role}
      const participantsList: string[] = (data.participants ?? []).map((p: any) => {
        if (typeof p === 'string') return p;
        return p.role ? `${p.nom} — ${p.role}` : (p.nom ?? '');
      }).filter(Boolean);

      // Inject ORDRE DU JOUR if missing from saved draft (older sessions)
      const injectOrdreduJour = (content: string): string => {
        if (!content || content.includes('## ORDRE DU JOUR')) return content;
        const items = mappedAgenda.length > 0
          ? mappedAgenda.map((a, i) => `${i + 1}. ${a.title}`).join('\n')
          : "1. Confirmation de l'ordre du jour";
        const section = `\n## ORDRE DU JOUR\n\n${items}\n`;
        if (content.includes('## ÉTAIENT PRÉSENTS')) {
          return content.replace('## ÉTAIENT PRÉSENTS', `${section}\n## ÉTAIENT PRÉSENTS`);
        }
        if (content.includes('## COMPTE RENDU')) {
          return content.replace('## COMPTE RENDU', `${section}\n## COMPTE RENDU`);
        }
        return content + section;
      };

      const rawDraftContent = draft?.draft_content ?? '';
      const patchedDraftContent = injectOrdreduJour(rawDraftContent);

      const sessionStatus: string = data.status ?? '';
      const hasFinalContent = !!data.final_content;
      const restoredDocument: PVDocument | null = draft
        ? {
            id: String(draft.id),
            title: draft.titre ?? '',
            date: draft.date_reunion ? new Date(draft.date_reunion) : new Date(),
            committeeType: draft.comite_type ?? '',
            participants: participantsList,
            agendaItems: [],
            draftContent: patchedDraftContent,
            finalContent: data.final_content ?? '',
            status: (hasFinalContent || sessionStatus === 'pv_final_generated' || sessionStatus === 'pv_final_translated') ? 'validated' : 'draft',
            translations: data.translations ?? {},
            db_draft_id: draft.id,
          }
        : null;

      setSessionId(id);
      setState(prev => ({
        ...prev,
        slides: mappedSlides,
        agendaItems: syncAgendaSlides(mappedSlides, mappedAgenda),
        document: restoredDocument,
        draftContent: patchedDraftContent,
        currentStep: (() => {
          const status: string = data.status ?? data.session?.status ?? '';
          if (status === 'pv_final_translated') return 'translation';
          if (status === 'pv_final_generated') return 'final-pv';
          if (status === 'draft_generated') return 'meeting-notes';
          if (status === 'agenda_analyzed') return 'draft-generation';
          // For early statuses, infer step from available data
          if (patchedDraftContent) return 'meeting-notes';
          const agendaWithAnalysis = (data.agenda_items ?? []).filter((a: any) => !!a.analysis);
          if (agendaWithAnalysis.length > 0 && agendaWithAnalysis.length === (data.agenda_items ?? []).length) {
            return 'draft-generation';
          }
          if (agendaWithAnalysis.length > 0) return 'agenda-analysis';
          return 'extract';
        })() as WorkflowStep,
      }));
    } catch (err) {
      console.error('loadSession error:', err);
    }
  }, [setSessionId]);

  const canProceedToNextStep = useCallback(() => {
    switch (state.currentStep) {
      case 'upload':
        return state.slides.length > 0;
      case 'extract':
        return state.slides.every(s => s.extractedContent);
      case 'agenda-analysis':
        return state.agendaItems.some(a => a.isAnalyzed && a.isValidated);
      case 'draft-generation':
        return state.document?.draftContent !== undefined;
      case 'meeting-notes':
        return state.agendaItems.some(a => a.notes.length > 0);
      case 'final-pv':
        return state.document?.status === 'validated';
      case 'translation':
        return true;
      default:
        return false;
    }
  }, [state]);

  const goToNextStep = useCallback(() => {
    const currentIndex = WORKFLOW_STEPS.indexOf(state.currentStep);
    if (currentIndex < WORKFLOW_STEPS.length - 1 && canProceedToNextStep()) {
      setState(prev => ({ ...prev, currentStep: WORKFLOW_STEPS[currentIndex + 1] }));
    }
  }, [state.currentStep, canProceedToNextStep]);

  const goToPreviousStep = useCallback(() => {
    const currentIndex = WORKFLOW_STEPS.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setState(prev => ({ ...prev, currentStep: WORKFLOW_STEPS[currentIndex - 1] }));
    }
  }, [state.currentStep]);

  return (
    <WorkflowContext.Provider
      value={{
        ...state,
        sessionId,
        setSessionId,
        setCurrentStep,
        setSlides,
        updateSlide,
        updateSlideImage,
        startSlideImageStream,
        appendSlideImageStream,
        finishSlideImageStream,
        failSlideImageStream,
        deleteSlide,
        setAgendaItems,
        updateAgendaItem,
        addMeetingNote,
        updateMeetingNote,
        deleteMeetingNote,
        setDocument,
        updateDocument,
        setProcessing,
        setError,
        resetWorkflow,
        canProceedToNextStep,
        goToNextStep,
        goToPreviousStep,
        prepareImageExtraction,
        runSingleImageAnalysis,
        isImageAnalyzing,
        loadSession,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
