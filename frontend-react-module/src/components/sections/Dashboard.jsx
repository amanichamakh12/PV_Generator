import React from 'react';
import { BarChart3, FileText, Upload, CheckCircle } from 'lucide-react';

const Dashboard = () => {
  const stats = [
    {
      title: 'PV Traité',
      value: '24',
      icon: FileText,
      color: 'var(--accent)',
      bgColor: 'var(--accent-light)'
    },
    {
      title: 'En cours',
      value: '3',
      icon: Upload,
      color: 'var(--navy)',
      bgColor: 'rgba(27,58,107,0.1)'
    },
    {
      title: 'Terminé',
      value: '21',
      icon: CheckCircle,
      color: 'var(--success)',
      bgColor: 'var(--success-bg)'
    },
    {
      title: 'Taux de succès',
      value: '87%',
      icon: BarChart3,
      color: 'var(--navy-light)',
      bgColor: 'rgba(41,82,163,0.1)'
    }
  ];

  const recentActivities = [
    { id: 1, action: 'PV importé', file: 'reunion_2024_01.pdf', time: '2h ago', status: 'success' },
    { id: 2, action: 'Traitement terminé', file: 'meeting_q1.pptx', time: '4h ago', status: 'success' },
    { id: 3, action: 'Erreur de format', file: 'notes.doc', time: '6h ago', status: 'error' },
    { id: 4, action: 'PV généré', file: 'synthese_fevrier.pdf', time: '1j ago', status: 'success' }
  ];

  return (
    <div className="fade-in">
      <header className="main-header">
        <h1 className="main-title">Tableau de bord</h1>
        <p className="main-subtitle">
          Vue d'ensemble de vos procès-verbaux et activités récentes
        </p>
      </header>

      {/* Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="card">
              <div className="card-header">
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: stat.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px'
                }}>
                  <Icon size={20} color={stat.color} />
                </div>
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: '600', margin: '0', color: 'var(--text)' }}>
                    {stat.value}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '4px 0 0 0' }}>
                    {stat.title}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activities */}
      <div className="card">
        <div className="card-header">
          <FileText className="card-icon" />
          <h2 className="card-title">Activités récentes</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {recentActivities.map(activity => (
            <div key={activity.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              borderRadius: '8px',
              background: 'var(--bg)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: activity.status === 'success' ? 'var(--success)' : 'var(--danger)'
                }}></div>
                <div>
                  <p style={{ fontWeight: '500', margin: '0', color: 'var(--text)' }}>
                    {activity.action}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '2px 0 0 0' }}>
                    {activity.file}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;