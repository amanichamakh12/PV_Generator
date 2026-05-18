import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import UploadPage from './components/Pages/UploadPage';
import PipelinePage from './components/Pages/PipelinePage';
import EditorPage from './components/Pages/EditorPage';
import ExportPage from './components/Pages/ExportPage';

function App() {
  return (
    <BrowserRouter>
    <Routes>
      {/* Upload initial */}
      <Route path="/" element={<UploadPage />} />

      {/* Pipeline IA */}
      <Route path="/pipeline" element={<PipelinePage />} />

      {/* Edition humaine */}
      <Route path="/editor" element={<EditorPage />} />

      {/* Export final */}
      <Route path="/export" element={<ExportPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </BrowserRouter>
  );
}

export default App;