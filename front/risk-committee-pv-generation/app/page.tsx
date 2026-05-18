'use client';

import { WorkflowProvider } from '@/contexts/workflow-context';
import { Header } from '@/components/layout/header';
import { WorkflowStepper } from '@/components/workflow/workflow-stepper';
import { WorkflowContent } from '@/components/workflow/workflow-content';

export default function Home() {
  return (
    <WorkflowProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <WorkflowStepper />
        <main className="flex-1 overflow-auto">
          <WorkflowContent />
        </main>
      </div>
    </WorkflowProvider>
  );
}
