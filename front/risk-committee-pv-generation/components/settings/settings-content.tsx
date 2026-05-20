'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
        <p className="text-muted-foreground mt-2">
          Configuration du système
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profil Utilisateur</CardTitle>
            <CardDescription>Informations de compte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nom complet</label>
              <p className="text-foreground">Administrateur Système</p>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-foreground">admin@risques.com</p>
            </div>
            <div>
              <label className="text-sm font-medium">Rôle</label>
              <p className="text-foreground">Administrateur</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Préférences Système</CardTitle>
            <CardDescription>Configuration générale</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Langue par défaut</label>
              <p className="text-foreground">Français</p>
            </div>
            <div>
              <label className="text-sm font-medium">Fuseau horaire</label>
              <p className="text-foreground">GMT+1 (Maroc)</p>
            </div>
            <div>
              <label className="text-sm font-medium">Format de date</label>
              <p className="text-foreground">DD/MM/YYYY</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
