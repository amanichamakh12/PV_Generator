import React from "react";
import "./index.css";

import {
  CheckCircle,
  Circle,
  Clock3,
  FileText,
  Brain,
  TrendingUp,
  AlertCircle,
  Star,
  ChevronRight,
} from "lucide-react";

const steps = [
  { title: "Upload PPTX", completed: true },
  { title: "Extraction des slides", active: true, progress: "1/11" },
  { title: "Analyse slide par slide" },
  { title: "Analyse ordre du jour" },
  { title: "Génération du PV" },
  { title: "Validation humaine", disabled: true },
  { title: "Édition manuelle", disabled: true },
];

const stats = [
  { icon: <FileText size={18} />, title: "Slides analysées", value: "1/11" },
  { icon: <CheckCircle size={18} />, title: "Décisions détectées", value: "0" },
  { icon: <TrendingUp size={18} />, title: "Actions identifiées", value: "0" },
  { icon: <AlertCircle size={18} />, title: "Points critiques", value: "0" },
  { icon: <Star size={18} />, title: "Confiance IA", value: "0%" },
  { icon: <Clock3 size={18} />, title: "Temps restant", value: "~2 min" },
];

export default function PipelineView() {
  const [files, setFiles] = React.useState([]);

  React.useEffect(() => {
    const data = localStorage.getItem("uploadedFiles");
    if (data) setFiles(JSON.parse(data));
  }, []);

  return (
    <div className="shell">
      <Sidebar />
      <MainContent files={files} />
    </div>
  );
}
/* ---------------- SIDEBAR ---------------- */

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <h1>Génération de PV</h1>
        <p>Pipeline automatisé</p>

        <div style={{ marginTop: 30 }}>
          <div className="flex justify-between text-sm mb-2">
            <span>Progression globale</span>
            <span>10%</span>
          </div>

          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="w-[10%] h-full bg-yellow-400" />
          </div>

          <p style={{ marginTop: 10, fontSize: 12 }}>
            Temps restant estimé: ~2 min
          </p>
        </div>
      </div>

      <div className="sidebar-nav">
        {steps.map((step, i) => (
          <Step key={i} {...step} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- STEPS ---------------- */

function Step({ title, completed, active, progress, disabled }) {
  return (
    <div
      className={`nav-item animate-fadeUp ${active ? "active animate-glow" : ""}`}
      style={{
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.3s ease",
        transform: active ? "scale(1.02)" : "scale(1)"
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {completed ? (
          <CheckCircle size={18} className="text-green-400 animate-float" />
        ) : active ? (
          <Clock3 size={18} className="text-yellow-400 animate-spin" />
        ) : (
          <Circle size={18} />
        )}

        <div style={{ flex: 1 }}>
          <div>{title}</div>

          {progress && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "#aaa",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>{progress}</span>
              <ChevronRight size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- MAIN ---------------- */

function MainContent({ files }) {
  const completedFiles = files.filter(
    (f) => f.status === "completed" && f.parsedData
  );

  return (
    <div className="main">
      <div className="main-header">
        <h2 className="main-title">Extraction des slides</h2>
        <p className="main-subtitle">
          Slides extraites et analysées par l’IA
        </p>
      </div>

      {/* PIPELINE STATUS */}
      <div className="card">
        <span>Analyse en cours...</span>
      </div>

      {/* SLIDES VIEWER */}
      <div style={{ marginTop: 30 }}>
        {completedFiles.map((file, i) => (
          <div key={i}>
            {file.parsedData.slides.map((slide, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "20px",
                  padding: "20px",
                  background: "white",
                  borderRadius: "12px",
                  border: "1px solid #ddd"
                }}
              >
                {/* TITRE SLIDE */}
                <h3 style={{ color: "#7c5cff" }}>
                  Slide {slide.index} — {slide.titre}
                </h3>

                {/* CONTENU */}
                <ul>
                  {slide.contenu?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>

                {/* TABLEAUX */}
                {slide.tableaux?.map((table, tIndex) => (
                  <div key={tIndex}>
                    <table style={{ width: "100%" }}>
                      <tbody>
                        {table.lignes.map((row, rIndex) => (
                          <tr key={rIndex}>
                            {row.map((cell, cIndex) => (
                              <td
                                key={cIndex}
                                style={{
                                  border: "1px solid #ccc",
                                  padding: "8px"
                                }}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* NOTES */}
                {slide.notes?.length > 0 && (
                  <div>
                    <strong>Notes:</strong>
                    <ul>
                      {slide.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- BOTTOM STATS ---------------- */

export function BottomStats() {
  return (
    <div className="grid grid-cols-6 gap-4 p-4 bg-white border-t">
      {stats.map((s, i) => (
        <div key={i} className="card flex items-center gap-3">
          <div>{s.icon}</div>
          <div>
            <div className="text-sm text-gray-500">{s.title}</div>
            <div className="font-semibold">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}