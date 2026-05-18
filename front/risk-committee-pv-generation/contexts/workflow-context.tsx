'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { WorkflowStep, WorkflowState, Slide, AgendaItem, PVDocument, MeetingNote } from '@/types/pv-generator';

interface WorkflowContextType extends WorkflowState {
  setCurrentStep: (step: WorkflowStep) => void;
  setSlides: (slides: Slide[]) => void;
  updateSlide: (slideId: string, updates: Partial<Slide>) => void;
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
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

const WORKFLOW_STEPS: WorkflowStep[] = [
  'upload',
  'extract',
  'slide-analysis',
  'agenda-analysis',
  'draft-generation',
  'meeting-notes',
  'final-pv',
  'translation'
];

const initialState: WorkflowState = {
  currentStep: 'upload',
  document: null,
  slides: [],
  agendaItems: [],
  isProcessing: false,
  error: null
};

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkflowState>(initialState);

  const setCurrentStep = useCallback((step: WorkflowStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const setSlides = useCallback((slides: Slide[]) => {
    setState(prev => ({ ...prev, slides }));
  }, []);

  const updateSlide = useCallback((slideId: string, updates: Partial<Slide>) => {
    setState(prev => ({
      ...prev,
      slides: prev.slides.map(slide =>
        slide.id === slideId ? { ...slide, ...updates } : slide
      )
    }));
  }, []);

  const setAgendaItems = useCallback((agendaItems: AgendaItem[]) => {
    setState(prev => ({ ...prev, agendaItems }));
  }, []);

  const deleteSlide = useCallback((slideId: string) => {
    setState(prev => ({
      ...prev,
      slides: prev.slides.filter(slide => slide.id !== slideId),
      agendaItems: prev.agendaItems.map(item => ({
        ...item,
        slides: item.slides.filter(slide => slide.id !== slideId)
      }))
    }));
  }, []);

  const updateAgendaItem = useCallback((itemId: string, updates: Partial<AgendaItem>) => {
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    }));
  }, []);

  const addMeetingNote = useCallback((agendaItemId: string, note: Omit<MeetingNote, 'id'>) => {
    const newNote: MeetingNote = {
      ...note,
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === agendaItemId
          ? { ...item, notes: [...item.notes, newNote] }
          : item
      )
    }));
  }, []);

  const updateMeetingNote = useCallback((agendaItemId: string, noteId: string, content: string) => {
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === agendaItemId
          ? {
              ...item,
              notes: item.notes.map(note =>
                note.id === noteId ? { ...note, content } : note
              )
            }
          : item
      )
    }));
  }, []);

  const deleteMeetingNote = useCallback((agendaItemId: string, noteId: string) => {
    setState(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map(item =>
        item.id === agendaItemId
          ? { ...item, notes: item.notes.filter(note => note.id !== noteId) }
          : item
      )
    }));
  }, []);

  const setDocument = useCallback((document: PVDocument | null) => {
    setState(prev => ({ ...prev, document }));
  }, []);

  const updateDocument = useCallback((updates: Partial<PVDocument>) => {
    setState(prev => ({
      ...prev,
      document: prev.document ? { ...prev.document, ...updates } : null
    }));
  }, []);

  const setProcessing = useCallback((isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const resetWorkflow = useCallback(() => {
    setState(initialState);
  }, []);

  const canProceedToNextStep = useCallback(() => {
    switch (state.currentStep) {
      case 'upload':
        return state.slides.length > 0;
      case 'extract':
        return state.slides.every(s => s.extractedContent);
      case 'slide-analysis':
        return state.slides.every(s => s.isValidated);
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
        goToPreviousStep
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
