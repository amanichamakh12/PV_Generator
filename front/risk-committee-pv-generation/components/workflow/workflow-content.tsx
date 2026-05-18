'use client';

import { useWorkflow } from '@/contexts/workflow-context';
import { UploadStep } from './steps/upload-step';
import { ExtractStep } from './steps/extract-step';
import { SlideAnalysisStep } from './steps/slide-analysis-step';
import { AgendaAnalysisStep } from './steps/agenda-analysis-step';
import { DraftGenerationStep } from './steps/draft-generation-step';
import { MeetingNotesStep } from './steps/meeting-notes-step';
import { FinalPVStep } from './steps/final-pv-step';
import { TranslationStep } from './steps/translation-step';

export function WorkflowContent() {
  const { currentStep } = useWorkflow();

  const renderStep = () => {
    switch (currentStep) {
      case 'upload':
        return <UploadStep />;
      case 'extract':
        return <ExtractStep />;
      case 'slide-analysis':
        return <SlideAnalysisStep />;
      case 'agenda-analysis':
        return <AgendaAnalysisStep />;
      case 'draft-generation':
        return <DraftGenerationStep />;
      case 'meeting-notes':
        return <MeetingNotesStep />;
      case 'final-pv':
        return <FinalPVStep />;
      case 'translation':
        return <TranslationStep />;
      default:
        return <UploadStep />;
    }
  };

  return (
    <div className="p-6">
      {renderStep()}
    </div>
  );
}
