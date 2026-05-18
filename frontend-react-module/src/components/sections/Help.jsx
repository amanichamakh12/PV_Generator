import React from 'react';
import { HelpCircle, FileText, Upload, Settings, MessageCircle, Zap, AlertTriangle } from 'lucide-react';
import APIConfigTest from '../APIConfigTest';

const Help = () => {
  const faqs = [
    {
      question: "Comment importer un document ?",
      answer: "Glissez-déposez votre fichier dans la zone d'import ou cliquez pour sélectionner un fichier. Les formats PDF, DOCX, PPTX et TXT sont supportés."
    },
    {
      question: "Quels sont les formats de fichiers acceptés ?",
      answer: "Le système accepte les fichiers PDF, Microsoft Word (.docx), PowerPoint (.pptx) et texte brut (.txt) jusqu'à 10MB."
    },
    {
      question: "Comment consulter mes PV générés ?",
      answer: "Accédez à la section 'Documents' pour voir tous vos procès-verbaux générés et documents sources."
    },
    {
      question: "Puis-je modifier les paramètres de traitement ?",
      answer: "Oui, allez dans 'Paramètres' pour configurer les notifications, le traitement automatique et les préférences d'interface."
    }
  ];

  const quickActions = [
    {
      icon: Upload,
      title: "Importer un document",
      description: "Commencez par importer votre premier document",
      action: "Aller à l'import"
    },
    {
      icon: FileText,
      title: "Voir les documents",
      description: "Consultez vos PV et documents existants",
      action: "Voir les documents"
    },
    {
      icon: Settings,
      title: "Configurer le système",
      description: "Ajustez les paramètres selon vos besoins",
      action: "Ouvrir les paramètres"
    }
  ];

  return (
    <div className="fade-in">
      <header className="main-header">
        <h1 className="main-title">Centre d'aide</h1>
        <p className="main-subtitle">
          Trouvez des réponses à vos questions et apprenez à utiliser le système
        </p>
      </header>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <HelpCircle className="card-icon" />
          <h2 className="card-title">Actions rapides</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <div key={index} style={{
                padding: '20px',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                textAlign: 'center',
                transition: 'var(--transition)',
                cursor: 'pointer'
              }}>
                <Icon size={32} color="var(--accent)" style={{ marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 8px 0', fontWeight: '600', color: 'var(--text)' }}>
                  {action.title}
                </h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--muted)' }}>
                  {action.description}
                </p>
                <button className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
                  {action.action}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="card">
        <div className="card-header">
          <MessageCircle className="card-icon" />
          <h2 className="card-title">Questions fréquentes</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {faqs.map((faq, index) => (
            <details key={index} style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg)',
              border: '1px solid var(--border)'
            }}>
              <summary style={{
                fontWeight: '600',
                color: 'var(--text)',
                cursor: 'pointer',
                listStyle: 'none'
              }}>
                {faq.question}
              </summary>
              <p style={{
                margin: '12px 0 0 0',
                color: 'var(--muted)',
                lineHeight: '1.5'
              }}>
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="card">
        <div className="card-header">
          <MessageCircle className="card-icon" />
          <h2 className="card-title">Besoin d'aide supplémentaire ?</h2>
        </div>

        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ margin: '0 0 20px 0', color: 'var(--muted)' }}>
            Notre équipe de support est là pour vous aider
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-primary">
              Contacter le support
            </button>
            <button className="btn btn-secondary">
              Documentation complète
            </button>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="card">
        <div className="card-header">
          <Zap className="card-icon" />
          <h2 className="card-title">Configuration de l'API</h2>
        </div>

        <APIConfigTest />

        <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)' }}>
            <AlertTriangle size={16} color="var(--warn)" />
            Variables d'environnement requises
          </h4>
          <pre style={{
            background: 'var(--surface)',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '12px',
            overflow: 'auto',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            margin: '0'
          }}>
{`# .env.local
VITE_API_BASE_URL=http://localhost:8001/api
VITE_API_TIMEOUT=30000

# Puis redémarrez le serveur de développement
npm run dev`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default Help;