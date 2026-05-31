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
} from '@/lib/pptx-import';

interface WorkflowContextType extends WorkflowState {
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
  addMeetingNote: (agendaItemId: string, note: Omit<MeetingNote, 'id'>) => void;
  updateMeetingNote: (agendaItemId: string, noteId: string, content: string) => void;
  deleteMeetingNote: (agendaItemId: string, noteId: string) => void;
  setDocument: (doc: PVDocument | null) => void;
  updateDocument: (updates: Partial<PVDocument>) => void;
  setProcessing: (isProcessing: boolean) => void;
  setError: (error: string | null) => void;
  resetWorkflow: () => void;
  canProceedToNextStep: () => boolean;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  prepareImageExtraction: (token: string, total: number) => void;
  runSingleImageAnalysis: (slideNumber: number, imageIndex: number) => Promise<void>;
  isImageAnalyzing: (slideNumber: number, imageIndex: number) => boolean;
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
  currentStep: 'upload',
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
  const activeStreamsRef = useRef<Set<string>>(new Set());
  const extractionTokenRef = useRef<string | null>(null);
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

  const addMeetingNote = useCallback((agendaItemId: string, note: Omit<MeetingNote, 'id'>) => {
    const newNote: MeetingNote = {
      ...note,
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === agendaItemId ? { ...item, notes: [...item.notes, newNote] } : item,
      ),
    }));
  }, []);

  const updateMeetingNote = useCallback(
    (agendaItemId: string, noteId: string, content: string) => {
      setState(prev => ({
        ...prev,
        agendaItems: prev.agendaItems.map(item =>
          item.id === agendaItemId
            ? {
                ...item,
                notes: item.notes.map(note =>
                  note.id === noteId ? { ...note, content } : note,
                ),
              }
            : item,
        ),
      }));
    },
    [],
  );

  const deleteMeetingNote = useCallback((agendaItemId: string, noteId: string) => {
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === agendaItemId
          ? { ...item, notes: item.notes.filter(note => note.id !== noteId) }
          : item,
      ),
    }));
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

  const prepareImageExtraction = useCallback((token: string, total: number) => {
    extractionTokenRef.current = token;
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
        await streamSingleImageAnalysis(token, slideNumber, imageIndex, event => {
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

  const canProceedToNextStep = useCallback(() => {
    switch (state.currentStep) {
      case 'upload':
        return state.slides.length > 0;
      case 'extract':
        return state.slides.every(s => s.extractedContent);
      case 'agenda-analysis':
        return state.agendaItems.every(a => a.isValidated);
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
