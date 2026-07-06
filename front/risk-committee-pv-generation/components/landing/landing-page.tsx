'use client';

import { useWorkflow } from '@/contexts/workflow-context';
import { Zap, Lock, FileText, ArrowRight, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function LandingPage() {
  const { setCurrentStep, resetWorkflow } = useWorkflow();

  const handleGenerate = () => {
    resetWorkflow();
    setCurrentStep('upload');
  };

  return (
    <div
      className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center bg-sidebar px-6 py-12"
      style={{ fontFamily: 'var(--font-cairo)' }}
    >

      {/* Logo */}
      <div className="mb-8 bg-white rounded-2xl px-8 py-5 shadow-lg">
        <Image
          src="/LogoWifakBank.png"
          alt="Wifak Bank"
          width={220}
          height={70}
          className="h-auto w-[180px] sm:w-[220px]"
          priority
        />
      </div>

<h1
  className="text-5xl sm:text-6xl font-extrabold text-center mb-5 tracking-tight"
  style={{ color: "var(--sidebar-primary)" }}
>
  PVGenerator
</h1>

      {/* Subtitle */}
      <p className="text-sidebar-foreground/75 text-lg sm:text-xl text-center max-w-2xl font-medium leading-relaxed mb-14">
        L'intelligence artificielle au service de vos comités : des procès-verbaux professionnels générés automatiquement, en toute sécurité.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl w-full mb-14">
        <div className="rounded-2xl border border-sidebar-primary/30 bg-sidebar-accent p-7 flex flex-col items-center gap-3 hover:border-sidebar-primary/60 transition-colors">
          <div className="w-12 h-12 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-sidebar-primary" />
          </div>
          <p className="font-bold text-white text-base">Rapide</p>
          <p className="text-sm text-sidebar-primary/60 text-center">Génération rapide</p>
        </div>

        <div className="rounded-2xl border border-sidebar-primary/30 bg-sidebar-accent p-7 flex flex-col items-center gap-3 hover:border-sidebar-primary/60 transition-colors">
          <div className="w-12 h-12 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
            <Lock className="w-6 h-6 text-sidebar-primary" />
          </div>
          <p className="font-bold text-white text-base">Sécurisé</p>
          <p className="text-sm text-sidebar-primary/60 text-center">Conforme aux normes</p>
        </div>

        <div className="rounded-2xl border border-sidebar-primary/30 bg-sidebar-accent p-7 flex flex-col items-center gap-3 hover:border-sidebar-primary/60 transition-colors">
          <div className="w-12 h-12 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-sidebar-primary" />
          </div>
          <p className="font-bold text-white text-base">Professionnel</p>
          <p className="text-sm text-sidebar-primary/60 text-center">Format bancaire</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <Button
          size="lg"
          onClick={handleGenerate}
          className="bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground px-8 gap-2 text-base font-semibold shadow-lg shadow-sidebar-primary/20"
        >
          Générer un Rapport
          <ArrowRight className="w-5 h-5" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setCurrentStep('dashboard')}
          className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:border-sidebar-foreground/30 px-8 gap-2 text-base"
        >
          <History className="w-5 h-5" />
          Consulter l'Historique
        </Button>
      </div>

      {/* Footer */}
      <p className="mt-16 text-xs text-sidebar-foreground/30 border-t border-sidebar-border/40 pt-5 w-full text-center max-w-3xl">
        Trusted by Wifak Bank professionals
      </p>
    </div>
  );
}