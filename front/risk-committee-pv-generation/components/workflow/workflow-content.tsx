'use client';

import { useWorkflow } from '@/contexts/workflow-context';
import { UploadStep } from './steps/upload-step';
import { ExtractStep } from './steps/extract-step';
import { AgendaAnalysisStep } from './steps/agenda-analysis-step';
import { DraftGenerationStep } from './steps/draft-generation-step';
import { MeetingNotesStep } from './steps/meeting-notes-step';
import { FinalPVStep } from './steps/final-pv-step';
import { TranslationStep } from './steps/translation-step';
import { SessionsDashboard } from '@/components/sessions/sessions-dashboard2';
import { LandingPage } from '@/components/landing/landing-page';

export function WorkflowContent() {
  const { currentStep } = useWorkflow();

  const renderStep = () => {
    switch (currentStep) {
      case 'home':
        return <LandingPage />;
      case 'dashboard':
        return <SessionsDashboard />;
      case 'upload':
        return <UploadStep />;
      case 'extract':
        return <ExtractStep />;
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

  const isFullPage = currentStep === 'home';

  return (
    <div className={isFullPage ? '' : 'p-6'}>
      {renderStep()}
    </div>
  );
}
