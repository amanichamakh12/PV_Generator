'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, Lock, Zap } from 'lucide-react';

interface HomeHeroProps {
  onViewHistory: () => void;
  onNewSession: () => void;
}

export function HomeHero({ onViewHistory, onNewSession }: HomeHeroProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      {/* Content Container */}
      <div className="max-w-3xl w-full space-y-8 text-center">
      {/* Wifak Badge */}
        <div className="flex justify-center mb-4">
          <span className="text-sm font-semibold text-orange-400 bg-orange-400/10 px-4 py-1.5 rounded-full">
            Wifak Banque
          </span>
        </div>

        {/* Heading */}
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
            PVGenerator
          </h1>
          <p className="text-xl md:text-2xl text-slate-200 font-semibold">
            Transformez vos supports de comités en procès-verbaux professionnels de manière automatisée et sécurisée
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-8">
          {[
            { icon: Zap, label: 'Rapide', desc: 'Génération en secondes' },
            { icon: Lock, label: 'Sécurisé', desc: 'Conforme aux normes' },
            { icon: FileText, label: 'Professionnel', desc: 'Format bancaire' },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="bg-slate-800/50 rounded-xl p-5 border border-orange-500/20 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all group"
            >
              <feature.icon className="w-8 h-8 text-orange-400 mx-auto mb-3 group-hover:text-orange-300 transition-colors" />
              <p className="font-semibold text-white text-sm">{feature.label}</p>
              <p className="text-xs text-slate-400 mt-2">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <Button
            size="lg"
            onClick={onNewSession}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 gap-2 px-8 shadow-lg hover:shadow-orange-500/50 transition-all"
          >
            Générer un Rapport
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onViewHistory}
            className="border-slate-400 text-slate-300 hover:bg-slate-700/50 hover:border-slate-300 dark:hover:bg-slate-700 gap-2 transition-all"
          >
            Consulter l&apos;Historique
          </Button>
        </div>

        {/* Footer Note */}
        <div className="pt-8 border-t border-slate-700 text-sm text-slate-400">
          <p>Trusted by banking professionals</p>
        </div>
      </div>
    </div>
  );
}
