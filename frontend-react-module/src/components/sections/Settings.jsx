import React, { useState } from 'react';
import { Settings, Save, User, Bell, Shield } from 'lucide-react';

const SettingsSection = () => {
  const [settings, setSettings] = useState({
    notifications: true,
    autoProcess: false,
    theme: 'light',
    language: 'fr'
  });

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fade-in">
      <header className="main-header">
        <h1 className="main-title">Paramètres</h1>
        <p className="main-subtitle">
          Configurez votre expérience utilisateur
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Settings */}
        <div className="card">
          <div className="card-header">
            <User className="card-icon" />
            <h2 className="card-title">Profil</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
                Nom complet
              </label>
              <input
                type="text"
                defaultValue="Utilisateur"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="email"
                defaultValue="user@example.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="card">
          <div className="card-header">
            <Bell className="card-icon" />
            <h2 className="card-title">Notifications</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Activer les notifications</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoProcess}
                onChange={(e) => handleSettingChange('autoProcess', e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Traitement automatique des fichiers</span>
            </label>
          </div>
        </div>

        {/* System Settings */}
        <div className="card">
          <div className="card-header">
            <Shield className="card-icon" />
            <h2 className="card-title">Système</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
                Thème
              </label>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px'
                }}
              >
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
                <option value="auto">Automatique</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '8px' }}>
                Langue
              </label>
              <select
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '14px'
                }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary">
            <Save size={16} />
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsSection;