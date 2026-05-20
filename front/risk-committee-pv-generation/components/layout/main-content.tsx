'use client';

import { useNavigation } from '@/contexts/navigation-context';
import { WorkflowContent } from '@/components/workflow/workflow-content';
import { ClientStagingContent } from '@/components/client-staging/client-staging-content';
import { AnalyticsContent } from '@/components/analytics/analytics-content';
import { SettingsContent } from '@/components/settings/settings-content';

export function MainContent() {
  const { activeModule } = useNavigation();

  return (
    <main className="flex-1 overflow-auto p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {activeModule === 'pv-generator' && <WorkflowContent />}
        {activeModule === 'client-staging' && <ClientStagingContent />}
        {activeModule === 'analytics' && <AnalyticsContent />}
        {activeModule === 'settings' && <SettingsContent />}
      </div>
    </main>
  );
}
