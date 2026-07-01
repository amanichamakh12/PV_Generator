'use client';

import { ChevronDown, Phone, Mail, MapPin, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkflow } from '@/contexts/workflow-context';
import { useState, useRef, useEffect } from 'react';

export function Header() {
  const { setCurrentStep, resetWorkflow, currentStep } = useWorkflow();
  const [supportOpen, setSupportOpen] = useState(false);
  const supportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (supportRef.current && !supportRef.current.contains(e.target as Node)) {
        setSupportOpen(false);
      }
    }
    if (supportOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [supportOpen]);

  const handleGenerate = () => {
    resetWorkflow();
    setCurrentStep('upload');
  };

  const navItem = (_label: string, active: boolean) =>
    `flex items-center gap-1 text-sm font-semibold transition-colors ${
      active
        ? 'text-sidebar-primary border-b-2 border-sidebar-primary pb-0.5'
        : 'text-sidebar-foreground/80 hover:text-sidebar-foreground'
    }`;

  return (
    <header
      className="border-b"
      style={{ backgroundColor: "var(--sidebar-primary)", borderColor: "var(--sidebar-primary)" }}
>     
     <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">

        {/* Logo + Nom */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setCurrentStep('home')}
        >
          <div className="bg-white rounded-lg p-2">
            <img src="/LogoWifakBank.png" alt="Wifak Bank" className="h-7 w-auto" />
          </div>
          <span className="text-xl font-extrabold text-sidebar-primary-foreground tracking-tight">
            PVGenerator
          </span>
        </div>

        {/* Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          <button
            onClick={() => setCurrentStep('home')}
            className={navItem('ACCUEIL', currentStep === 'home')}
            style={{ color: currentStep === 'home' ? 'var(--sidebar-accent)' : 'var(--sidebar-primary-foreground)' }}
          >
            ACCUEIL
          </button>

          <button
            onClick={handleGenerate}
            className={navItem('GÉNÉRER', ['upload','extract','agenda-analysis','draft-generation','meeting-notes','final-pv','translation'].includes(currentStep))}
            style={{ color: ['upload','extract','agenda-analysis','draft-generation','meeting-notes','final-pv','translation'].includes(currentStep) ? 'var(--sidebar-accent)' : 'var(--sidebar-primary-foreground)' }}
          >
            GÉNÉRER
            <ChevronDown className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentStep('dashboard')}
            className={navItem('HISTORIQUE', currentStep === 'dashboard')}
            style={{ color: currentStep === 'dashboard' ? 'var(--sidebar-accent)' : 'var(--sidebar-primary-foreground)' }}
          >
            HISTORIQUE
          </button>

          {/* Support avec popover */}
          <div className="relative" ref={supportRef}>
            <button
              onClick={() => setSupportOpen(prev => !prev)}
              className={navItem('SUPPORT', supportOpen)}
              style={{ color: supportOpen ? 'var(--sidebar-accent)' : 'var(--sidebar-primary-foreground)' }}
            >
              SUPPORT
              <ChevronDown className={`w-4 h-4 transition-transform ${supportOpen ? 'rotate-180' : ''}`} />
            </button>

            {supportOpen && (
              <div className="absolute top-full right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                {/* Header bulle */}
                <div className="bg-sidebar-foreground px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">Support Wifak Bank</p>
                    <p className="text-sidebar-primary-foreground/60 text-xs mt-0.5">PV Generator — Comité des Risques</p>
                  </div>
                  <button
                    onClick={() => setSupportOpen(false)}
                    className="text-sidebar-primary-foreground/50 hover:text-sidebar-primary-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Infos */}
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone className="w-4 h-4 text-sidebar" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Téléphone</p>
                      <p className="text-sm font-medium text-gray-800">+216 29 530 765</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mail className="w-4 h-4 text-sidebar" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</p>
                      <p className="text-sm font-medium text-gray-800">chamakhamani10@gmail.com</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-sidebar" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LinkedIn</p>
 <a
    href="https://www.linkedin.com/in/amani-chamakh-aa3715226"
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm font-medium text-blue-600 hover:underline"
  >
    Profil LinkedIn
  </a>                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-sidebar/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-sidebar" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Disponibilité</p>
                      <p className="text-sm font-medium text-gray-800">Lun – Ven : 08h00 – 17h00</p>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-4">
                  <div className="h-px bg-gray-100 mb-3" />
                  <p className="text-xs text-gray-400 text-center">
                    Version 1.0.0 · Wifak Bank © {new Date().getFullYear()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </nav>

      
      </div>
    </header>
  );
}
