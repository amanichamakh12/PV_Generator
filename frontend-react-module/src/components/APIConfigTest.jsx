import React, { useState, useEffect } from 'react';
import PVAPIClient from '../utils/api';

/**
 * Composant de test pour vérifier la configuration de l'API
 */
export function APIConfigTest() {
  const [testResults, setTestResults] = useState({
    apiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api',
    healthCheck: 'pending',
    parsePPTX: 'not tested',
    errors: []
  });

  useEffect(() => {
    const runTests = async () => {
      const errors = [];
      let healthCheckStatus = 'pending';

      try {
        // Test 1: Health Check
        console.log('🧪 Test 1: Health Check...');
        const isHealthy = await PVAPIClient.healthCheck();
        healthCheckStatus = isHealthy ? 'success' : 'failed';
        console.log(`✅ Health Check: ${healthCheckStatus}`);

        if (!isHealthy) {
          errors.push('❌ API Health Check échoué - L\'API n\'est pas accessible');
        }
      } catch (error) {
        healthCheckStatus = 'error';
        errors.push(`❌ Health Check Error: ${error.message}`);
        console.error('Health Check Error:', error);
      }

      setTestResults(prev => ({
        ...prev,
        healthCheck: healthCheckStatus,
        errors
      }));
    };

    runTests();
  }, []);

  return (
    <div style={{
      padding: '20px',
      background: '#f5f5f5',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <h3>🔍 API Configuration Test</h3>

      <div style={{ marginBottom: '12px' }}>
        <strong>API Base URL:</strong>
        <div style={{ color: '#0066cc', marginTop: '4px' }}>
          {testResults.apiUrl}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <strong>Health Check:</strong>
        <div style={{
          marginTop: '4px',
          color: testResults.healthCheck === 'success' ? '#00aa00' :
                 testResults.healthCheck === 'failed' ? '#cc0000' :
                 testResults.healthCheck === 'pending' ? '#aa8800' : '#cc0000'
        }}>
          {testResults.healthCheck === 'success' ? '✅ En ligne' :
           testResults.healthCheck === 'failed' ? '❌ Hors ligne' :
           testResults.healthCheck === 'pending' ? '⏳ Vérification...' :
           '❌ Erreur'}
        </div>
      </div>

      {testResults.errors.length > 0 && (
        <div style={{ marginTop: '12px', color: '#cc0000' }}>
          <strong>Erreurs:</strong>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {testResults.errors.map((error, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: '#ffffcc',
        borderRadius: '4px',
        fontSize: '11px'
      }}>
        <strong>ℹ️ Assurez-vous que:</strong>
        <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
          <li>Le backend s'exécute sur <code>localhost:8001</code></li>
          <li>Le fichier <code>.env.local</code> existe et est correctement configuré</li>
          <li>Les CORS sont activés sur l'API backend</li>
        </ul>
      </div>
    </div>
  );
}

export default APIConfigTest;
