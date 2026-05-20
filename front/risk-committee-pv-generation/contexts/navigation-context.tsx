'use client';

import React, { createContext, useContext, useState } from 'react';

export type NavigationModule = 'pv-generator' | 'client-staging' | 'analytics' | 'settings';

interface NavigationContextType {
  activeModule: NavigationModule;
  setActiveModule: (module: NavigationModule) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] = useState<NavigationModule>('pv-generator');

  return (
    <NavigationContext.Provider value={{ activeModule, setActiveModule }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
