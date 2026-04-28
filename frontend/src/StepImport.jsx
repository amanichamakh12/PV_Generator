import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

export default function StepImport({ state, setState, next }) {
  const [loading, setLoading] = useState(false);

  const handleFile = (file) => {
    setState({ file });
  };

  const extractFile = async () => {
    if (!state.file) return;

    setLoading(true);

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

      setState({
        extracted: data,
        pvDraft: null,
        pvFinal: null,
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Import de la présentation</h2>

      <input
        type="file"
        accept=".pptx,.pdf"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {state.file && <p>{state.file.name}</p>}

      <button onClick={extractFile} disabled={!state.file}>
        Extraire
      </button>

      {loading && <p>Extraction...</p>}

      {state.extracted && (
        <button onClick={next}>Continuer</button>
      )}
    </div>
  );
}