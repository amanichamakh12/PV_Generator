export interface Slide {
  id: string;
  slideNumber: number;
  title: string;
  content: string;
  rawSlide?: Record<string, any>;
  extractedContent: string;
  analysis: string;
  analysisDetails?: Record<string, any>;
  isAnalyzed: boolean;
  isValidated: boolean;
  agendaItemId: string;
  contentBlocks?: string[];
  tables?: any[];
  charts?: any[];
  images?: any[];
  notes?: string | null;
}

export interface AgendaItem {
  id: string;
  title: string;
  order: number;
  slides: Slide[];
  analysis: string;
  isAnalyzed: boolean;
  isValidated: boolean;
  notes: MeetingNote[];
}

export interface MeetingNote {
  id: string;
  speaker: string;
  content: string;
  timestamp: Date;
}

export interface PVDocument {
  id: string;
  title: string;
  date: Date;
  committeeType: string;
  participants: string[];
  agendaItems: AgendaItem[];
  draftContent: string;
  finalContent: string;
  status: 'draft' | 'in-meeting' | 'reviewing' | 'validated' | 'translated';
  translations: {
    arabic?: string;
    english?: string;
  };
  draftJson?: any;
  finalJson?: any;
}

export type WorkflowStep = 
  | 'upload'
  | 'extract'
  | 'slide-analysis'
  | 'agenda-analysis'
  | 'draft-generation'
  | 'meeting-notes'
  | 'final-pv'
  | 'translation';

export interface WorkflowState {
  currentStep: WorkflowStep;
  document: PVDocument | null;
  slides: Slide[];
  agendaItems: AgendaItem[];
  isProcessing: boolean;
  error: string | null;
  draftContent: string; // affichage UI
  draftJson: any;       // données backend
  finalContent: string;
  finalJson: any;

}
