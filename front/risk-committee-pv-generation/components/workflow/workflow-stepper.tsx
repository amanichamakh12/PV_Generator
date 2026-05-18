'use client';

import { useWorkflow } from '@/contexts/workflow-context';
import {
  Upload,
  FileSearch,
  Layers,
  ListChecks,
  FileText,
  MessageSquare,
  FileCheck,
  Languages,
  Check,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowStep } from '@/types/pv-generator';

const steps: { id: WorkflowStep; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'upload', label: 'Import', icon: <Upload className="w-5 h-5" />, description: 'Importer le support' },
  { id: 'extract', label: 'Extraction', icon: <FileSearch className="w-5 h-5" />, description: 'Extraire le contenu' },
  { id: 'slide-analysis', label: 'Analyse Slides', icon: <Layers className="w-5 h-5" />, description: 'Analyser par slide' },
  { id: 'agenda-analysis', label: 'Ordre du Jour', icon: <ListChecks className="w-5 h-5" />, description: 'Analyser par ordre' },
  { id: 'draft-generation', label: 'Draft PV', icon: <FileText className="w-5 h-5" />, description: 'Générer le brouillon' },
  { id: 'meeting-notes', label: 'Notes Réunion', icon: <MessageSquare className="w-5 h-5" />, description: 'Prendre les notes' },
  { id: 'final-pv', label: 'PV Final', icon: <FileCheck className="w-5 h-5" />, description: 'Valider le PV' },
  { id: 'translation', label: 'Traduction', icon: <Languages className="w-5 h-5" />, description: 'Traduire le PV' }
];

export function WorkflowStepper() {
  const { currentStep, setCurrentStep } = useWorkflow();
  
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="w-full bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = step.id === currentStep;
            const isClickable = index <= currentStepIndex;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => isClickable && setCurrentStep(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'flex flex-col items-center gap-2 px-3 py-2 rounded-lg transition-all min-w-[90px]',
                    isClickable && 'cursor-pointer hover:bg-secondary',
                    !isClickable && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                      isCompleted && 'bg-accent text-accent-foreground',
                      isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                      !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : step.icon}
                  </div>
                  <div className="text-center">
                    <p
                      className={cn(
                        'text-xs font-semibold',
                        isCurrent && 'text-primary',
                        isCompleted && 'text-accent',
                        !isCurrent && !isCompleted && 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">
                      {step.description}
                    </p>
                  </div>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight
                    className={cn(
                      'w-5 h-5 mx-1 flex-shrink-0',
                      index < currentStepIndex ? 'text-accent' : 'text-muted-foreground/50'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
