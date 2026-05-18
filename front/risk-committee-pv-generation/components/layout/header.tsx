'use client';

import { Shield, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkflow } from '@/contexts/workflow-context';

export function Header() {
  const { document, resetWorkflow, currentStep } = useWorkflow();

  return (
    <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">PV Generator</h1>
              <p className="text-xs text-sidebar-foreground/70">Comité des Risques</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {document && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-sidebar-accent rounded-lg">
                <FileText className="w-4 h-4 text-sidebar-primary" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {document.title}
                </span>
              </div>
            )}

            {currentStep !== 'upload' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetWorkflow}
                className="text-sidebar-foreground hover:bg-sidebar-accent gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Nouveau</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
