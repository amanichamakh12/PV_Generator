'use client';

import { FileText, BarChart3, Settings, Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/contexts/navigation-context';
import type { NavigationModule } from '@/contexts/navigation-context';
import { useState } from 'react';

const menuItems: { label: string; module: NavigationModule; icon: React.ReactNode }[] = [
  { label: 'Générateur de PV', module: 'pv-generator', icon: <FileText className="w-5 h-5" /> },
  { label: 'Client Staging', module: 'client-staging', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Analytique', module: 'analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { label: 'Paramètres', module: 'settings', icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar() {
  const { activeModule, setActiveModule } = useNavigation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-primary text-white hover:bg-primary-dark"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-40 h-screen w-64 bg-gradient-to-b from-primary to-primary-dark text-white transition-transform duration-300 flex flex-col shadow-xl`}
      >
        {/* Logo/Brand */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Risk Pilot</h1>
              <p className="text-xs text-white/70">Pilotage des Risques</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.module}
              onClick={() => {
                setActiveModule(item.module);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeModule === item.module
                  ? 'bg-white/20 font-semibold'
                  : 'hover:bg-white/10'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-4 py-2 text-xs text-white/70">
            <p className="font-semibold">Utilisateur</p>
            <p>admin@risques.com</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
