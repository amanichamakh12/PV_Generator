import React from 'react';
import { FileText, Upload, BarChart3, Settings, HelpCircle } from 'lucide-react';

const Sidebar = ({ activeSection, onSectionChange }) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: BarChart3,
      section: 'main'
    },
    {
      id: 'upload',
      label: 'Importer PV',
      icon: Upload,
      section: 'main'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      section: 'main'
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: Settings,
      section: 'config'
    },
    {
      id: 'help',
      label: 'Aide',
      icon: HelpCircle,
      section: 'support'
    }
  ];

  const mainNavItems = navItems.filter(item => item.section === 'main');
  const configNavItems = navItems.filter(item => item.section === 'config');
  const supportNavItems = navItems.filter(item => item.section === 'support');

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>PV Automation</h1>
        <p>Système de Procès-Verbaux</p>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Principal</div>
          {mainNavItems.map(item => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href="#"
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSectionChange(item.id);
                }}
              >
                <Icon className="nav-item-icon" size={16} />
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Configuration</div>
          {configNavItems.map(item => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href="#"
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSectionChange(item.id);
                }}
              >
                <Icon className="nav-item-icon" size={16} />
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Support</div>
          {supportNavItems.map(item => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href="#"
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSectionChange(item.id);
                }}
              >
                <Icon className="nav-item-icon" size={16} />
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar1;