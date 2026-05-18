import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';

import PVAPIClient from '../../utils/api';
const UploadSection = () => {
  const navigate = useNavigate();

  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [apiStatus, setApiStatus] = useState('checking');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // =========================
  // API HEALTH
  // =========================
  useEffect(() => {
    const checkAPI = async () => {
      const isHealthy = await PVAPIClient.healthCheck();

      setApiStatus(isHealthy ? 'online' : 'offline');
    };

    checkAPI();
  }, []);

  // =========================
  // DRAG EVENTS
  // =========================
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      e.type === 'dragenter' ||
      e.type === 'dragover'
    ) {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // =========================
  // DROP
  // =========================
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setDragActive(false);

    if (
      e.dataTransfer.files &&
      e.dataTransfer.files[0]
    ) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // =========================
  // HANDLE FILES
  // =========================
  const handleFiles = (files) => {
    const newFiles = Array.from(files).map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      progress: 0,
      rawFile: file,
      error: null,
      parsedData: null
    }));

    setUploadedFiles((prev) => [
      ...prev,
      ...newFiles
    ]);

    newFiles.forEach((file) => {
      processPPTX(file.id, file.rawFile);
    });
  };

  // =========================
  // PROCESS PPTX
  // =========================
  const processPPTX = async (fileId, file) => {
    try {
      const result = await PVAPIClient.parsePPTX(
        file,
        (event) => {
          if (event.type === 'upload') {
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === fileId
                  ? {
                      ...f,
                      progress: event.progress
                    }
                  : f
              )
            );
          }
        }
      );

      setUploadedFiles((prev) =>
        prev.map((f) =>
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
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((f) =>
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
    }
  };

  // =========================
  // DELETE FILE
  // =========================
  const removeFile = (id) => {
    setUploadedFiles((prev) =>
      prev.filter((file) => file.id !== id)
    );
  };

  // =========================
  // FORMAT FILE SIZE
  // =========================
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;

    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(
      Math.log(bytes) / Math.log(k)
    );

    return (
      parseFloat(
        (bytes / Math.pow(k, i)).toFixed(2)
      ) +
      ' ' +
      sizes[i]
    );
  };

  // =========================
  // ANALYZE
  // =========================
  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);

      const completedFiles =
        uploadedFiles.filter(
          (f) => f.status === 'completed'
        );

      if (completedFiles.length === 0) {
        alert(
          'Veuillez telecharger un fichier'
        );
        return;
      }
const handleAnalyze = async () => {
  try {
    setIsAnalyzing(true);

    // Optionnel:
    // sauvegarder les fichiers dans localStorage
    localStorage.setItem(
      'uploadedFiles',
      JSON.stringify(uploadedFiles)
    );

    // Redirection vers pipeline
    navigate('/pipeline');
  } catch (error) {
    console.error(error);
  }
};
      setTimeout(() => {
        setIsAnalyzing(false);
        navigate('/pipeline');
      }, 1500);
    } catch (error) {
      alert(error.message);
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px'
        }}
      >
        {/* ICON */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background:
              'linear-gradient(135deg,#7c5cff,#6b4eff)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '0 auto 24px auto'
          }}
        >
          <FileText
            size={30}
            color="white"
          />
        </div>

        {/* TITLE */}
        <h1
          style={{
            textAlign: 'center',
            fontSize: '40px',
            fontWeight: '700',
            marginBottom: '16px',
            color: '#111827'
          }}
        >
          Génération Automatique de PV
        </h1>

        <p
          style={{
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '18px',
            lineHeight: '30px',
            marginBottom: '48px'
          }}
        >
          Importez votre présentation PowerPoint
          pour générer automatiquement un
          procès-verbal professionnel
        </p>

        {/* DROPZONE */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() =>
            document
              .getElementById('file-input')
              .click()
          }
          style={{
            border: '2px dashed #10b981',
            borderRadius: '24px',
            padding: '32px',
            background: '#eefaf5',
            transition: '0.2s ease',
            cursor: 'pointer'
          }}
        >
          {/* FILES */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  border:
                    '1px solid #e5e7eb'
                }}
              >
                {/* LEFT */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '14px',
                      background: '#d1fae5',
                      display: 'flex',
                      justifyContent:
                        'center',
                      alignItems: 'center'
                    }}
                  >
                    <FileText
                      size={24}
                      color="#10b981"
                    />
                  </div>

                  <div>
                    <div
                      style={{
                        fontWeight: '600',
                        color: '#111827'
                      }}
                    >
                      {file.name}
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        color: '#6b7280',
                        fontSize: '14px'
                      }}
                    >
                      {formatFileSize(
                        file.size
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}
                >
                  {file.status ===
                    'uploading' && (
                    <div
                      style={{
                        width: '120px',
                        height: '6px',
                        borderRadius: '999px',
                        background: '#e5e7eb',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${file.progress}%`,
                          height: '100%',
                          background:
                            '#7c5cff',
                          transition:
                            'width .2s ease'
                        }}
                      />
                    </div>
                  )}

                  {file.status ===
                    'completed' && (
                    <CheckCircle
                      size={22}
                      color="#10b981"
                    />
                  )}

                  {file.status ===
                    'error' && (
                    <AlertCircle
                      size={22}
                      color="#ef4444"
                    />
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X
                      size={18}
                      color="#ef4444"
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* EMPTY STATE */}
          {uploadedFiles.length === 0 && (
            <>
              <Upload
                size={48}
                color="#10b981"
                style={{
                  marginBottom: '20px'
                }}
              />

              <h3
                style={{
                  marginBottom: '8px',
                  color: '#111827'
                }}
              >
                Glissez-déposez vos fichiers
              </h3>

              <p
                style={{
                  color: '#6b7280'
                }}
              >
                ou cliquez pour sélectionner un
                fichier
              </p>
            </>
          )}

          <input
            id="file-input"
            type="file"
            multiple
            accept=".pptx"
            style={{ display: 'none' }}
            onChange={(e) =>
              handleFiles(e.target.files)
            }
          />
        </div>

        {/* CTA */}
        {uploadedFiles.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '32px'
            }}
          >
            <button
              onClick={handleAnalyze}
              disabled={
                uploadedFiles.some(
                  (f) =>
                    f.status === 'uploading'
                ) ||
                apiStatus !== 'online' ||
                isAnalyzing
              }
              style={{
                background:
                  'linear-gradient(135deg,#7c5cff,#8b5cf6)',
                color: 'white',
                border: 'none',
                padding:
                  '16px 32px',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                minWidth: '280px',
                boxShadow:
                  '0 10px 30px rgba(124,92,255,.25)'
              }}
            >
              {isAnalyzing
                ? 'Analyse en cours...'
                : 'Démarrer la génération du PV'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadSection;