import { useState, useCallback } from 'react';
import PVAPIClient from '../utils/api';

/**
 * Hook pour gérer le pipeline de traitement PV
 */
export const usePVPipeline = () => {
  const [apiStatus, setApiStatus] = useState('checking');
  const [files, setFiles] = useState([]);
  const [currentProcessingFile, setCurrentProcessingFile] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState('idle'); // idle, processing, completed, error

  // Vérifier la santé de l'API
  const checkAPIStatus = useCallback(async () => {
    setApiStatus('checking');
    const isHealthy = await PVAPIClient.healthCheck();
    setApiStatus(isHealthy ? 'online' : 'offline');
    return isHealthy;
  }, []);

  // Ajouter des fichiers
  const addFiles = useCallback((newFiles) => {
    const processedFiles = Array.from(newFiles).map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      rawFile: file,
      status: 'pending', // pending, uploading, parsing, completed, error
      progress: 0,
      error: null,
      parsedData: null,
      timestamp: new Date()
    }));

    setFiles(prev => [...prev, ...processedFiles]);
    return processedFiles;
  }, []);

  // Traiter un fichier PPTX
  const processPPTXFile = useCallback(async (fileId) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    setCurrentProcessingFile(fileId);
    setPipelineStatus('processing');

    try {
      // Mettre à jour le statut
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId ? { ...f, status: 'uploading', progress: 0 } : f
        )
      );

      // Appeler l'API
      const result = await PVAPIClient.parsePPTX(file.rawFile, (event) => {
        if (event.type === 'upload') {
          setFiles(prev =>
            prev.map(f =>
              f.id === fileId
                ? { ...f, progress: Math.min(event.progress, 99) } // Max 99% pendant le traitement
                : f
            )
          );
        }
      });

      // Succès
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? {
              ...f,
              status: 'completed',
              progress: 100,
              parsedData: result
            }
            : f
        )
      );

      setCurrentProcessingFile(null);
      setPipelineStatus('completed');
      return result;
    } catch (error) {
      // Erreur
      setFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? {
              ...f,
              status: 'error',
              error: error.message,
              progress: 0
            }
            : f
        )
      );

      setCurrentProcessingFile(null);
      setPipelineStatus('error');
      throw error;
    }
  }, [files]);

  // Traiter tous les fichiers
  const processAllFiles = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    const results = [];

    for (const file of pendingFiles) {
      try {
        const result = await processPPTXFile(file.id);
        results.push({ fileId: file.id, success: true, data: result });
      } catch (error) {
        results.push({ fileId: file.id, success: false, error: error.message });
      }
    }

    return results;
  }, [files, processPPTXFile]);

  // Réinitialiser
  const reset = useCallback(() => {
    setFiles([]);
    setCurrentProcessingFile(null);
    setPipelineStatus('idle');
  }, []);

  // Supprimer un fichier
  const removeFile = useCallback((fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Réessayer un fichier en erreur
  const retryFile = useCallback((fileId) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'pending', error: null, progress: 0 }
          : f
      )
    );
    return processPPTXFile(fileId);
  }, [processPPTXFile]);

  return {
    // État
    apiStatus,
    files,
    currentProcessingFile,
    pipelineStatus,

    // Méthodes
    checkAPIStatus,
    addFiles,
    processPPTXFile,
    processAllFiles,
    reset,
    removeFile,
    retryFile
  };
};
