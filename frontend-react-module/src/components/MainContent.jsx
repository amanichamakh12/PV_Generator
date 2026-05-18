import React from 'react';
import Dashboard from './sections/Dashboard';
import UploadSection from './sections/UploadSection';
import Documents from './sections/Documents';
import Settings from './sections/Settings';
import Help from './sections/Help';

const MainContent = ({ activeSection }) => {
  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'upload':
        return <UploadSection />;
      case 'documents':
        return <Documents />;
      case 'settings':
        return <Settings />;
      case 'help':
        return <Help />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <main className="main">
      {renderContent()}
    </main>
  );
};

export default MainContent;