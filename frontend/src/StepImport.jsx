import { useState } from "react";

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
      const res = await fetch("http://localhost:8001/api/parse-pptx", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

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