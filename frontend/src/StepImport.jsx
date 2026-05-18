import { useState } from "react";
import StepImportFile from "./components/StepImportFile";
import StepImportProcessing from "./components/StepImportProcessing";
import StepImportValidation from "./components/StepImportValidation";
import ImportPipelineHeader from "./components/ImportPipelineHeader";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

const PIPELINE_STEPS = [
  { id: 1, label: "Import", description: "Sélectionner et charger la présentation" },
  { id: 2, label: "Traitement", description: "Extraction des données et structuration" },
  { id: 3, label: "Validation", description: "Vérification et confirmation des données" },
];

export default function StepImport({ state, setState, next }) {
  const [pipelineStep, setPipelineStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [extractedData, setExtractedData] = useState(null);

  const handleFileSelect = (file) => {
    setFileInfo({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });
    setState({ file });
    setError(null);
  };

  const handleExtractFile = async () => {
    if (!state.file) return;

    setLoading(true);
    setError(null);
    setPipelineStep(2);

    const formData = new FormData();
    formData.append("file", state.file);

    try {
      const res = await fetch(`${API_BASE}/api/parse-pptx`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Erreur API (${res.status})`);
      }

      const rawText = await res.text();
      if (!rawText.trim()) {
        throw new Error("Réponse vide de /api/parse-pptx");
      }

      const data = JSON.parse(rawText);
      setExtractedData(data);
      
      setState({
        extracted: data,
        pvDraft: null,
        pvFinal: null,
      });
      
      // Avancer vers la validation après 1s
      setTimeout(() => setPipelineStep(3), 1000);

    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur lors de l'extraction");
      setPipelineStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAndContinue = () => {
    if (extractedData) {
      next();
    }
  };

  const handleRetry = () => {
    setPipelineStep(1);
    setError(null);
    setFileInfo(null);
    setExtractedData(null);
    setState({ file: null, extracted: null, pvDraft: null, pvFinal: null });
  };

  return (
    <div style={s.container}>
      <ImportPipelineHeader steps={PIPELINE_STEPS} currentStep={pipelineStep} />

      <div style={s.content}>
        {/* ── Étape 1 : Import du fichier ── */}
        {pipelineStep >= 1 && (
          <StepImportFile
            fileInfo={fileInfo}
            onFileSelect={handleFileSelect}
            onExtract={handleExtractFile}
            loading={loading && pipelineStep === 2}
            isComplete={pipelineStep > 1}
          />
        )}

        {/* ── Étape 2 : Traitement ── */}
        {pipelineStep >= 2 && (
          <StepImportProcessing
            loading={loading}
            error={error}
            data={extractedData}
            isComplete={pipelineStep > 2}
          />
        )}

        {/* ── Étape 3 : Validation ── */}
        {pipelineStep >= 3 && extractedData && (
          <StepImportValidation
            data={extractedData}
            onContinue={handleValidateAndContinue}
            onRetry={handleRetry}
          />
        )}

        {/* ── Gestion d'erreur ── */}
        {error && (
          <div style={s.errorBox}>
            <p style={s.errorText}>❌ {error}</p>
            <button onClick={handleRetry} style={s.retryBtn}>
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Styles ─── */
const s = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "24px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  errorBox: {
    background: "#FDECEA",
    border: "1px solid #E74C3C",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "#C0392B",
    fontSize: "14px",
    margin: 0,
  },
  retryBtn: {
    padding: "8px 16px",
    background: "#C0392B",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
  },
};