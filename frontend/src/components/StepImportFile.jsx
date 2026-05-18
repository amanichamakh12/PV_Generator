export default function StepImportFile({
  fileInfo,
  onFileSelect,
  onExtract,
  loading,
  isComplete,
}) {
  return (
    <div style={{ ...s.card, ...(isComplete && s.cardComplete) }}>
      <div style={s.cardHeader}>
        <div>
          <h3 style={s.cardTitle}>1. Sélectionner le fichier</h3>
          <p style={s.cardDesc}>
            Chargez une présentation PowerPoint (.pptx) ou PDF
          </p>
        </div>
        {isComplete && <span style={s.badge}>✓ Complété</span>}
      </div>

      {/* Zone de glisser-déposer */}
      <div
        style={s.dropZone}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.background = "#FDF3E0";
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.background = "#F7F8FA";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.background = "#F7F8FA";
          const file = e.dataTransfer.files[0];
          if (file && (file.name.endsWith(".pptx") || file.name.endsWith(".pdf"))) {
            onFileSelect(file);
          }
        }}
      >
        <div style={s.dropContent}>
          <div style={s.uploadIcon}>📁</div>
          <p style={s.dropText}>
            Glissez-déposez votre fichier ici
          </p>
          <p style={s.dropSubtext}>ou cliquez pour sélectionner</p>
          <input
            type="file"
            accept=".pptx,.pdf"
            onChange={(e) => {
              if (e.target.files[0]) {
                onFileSelect(e.target.files[0]);
              }
            }}
            style={s.hiddenInput}
          />
        </div>
      </div>

      {/* Fichier sélectionné */}
      {fileInfo && (
        <div style={s.fileInfo}>
          <div style={s.fileIcon}>📄</div>
          <div>
            <p style={s.fileName}>{fileInfo.name}</p>
            <p style={s.fileSize}>
              {(fileInfo.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      )}

      {/* Bouton d'extraction */}
      {fileInfo && (
        <button
          onClick={onExtract}
          disabled={loading}
          style={{
            ...s.button,
            ...(loading && s.buttonLoading),
          }}
        >
          {loading ? "Extraction en cours..." : "Extraire les données"}
        </button>
      )}
    </div>
  );
}

const s = {
  card: {
    background: "white",
    border: "1px solid #E2E6EE",
    borderRadius: "12px",
    padding: "24px",
    transition: "all 0.3s ease",
  },
  cardComplete: {
    opacity: 0.6,
    background: "#F7F8FA",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  cardTitle: {
    margin: "0 0 4px 0",
    fontSize: "16px",
    fontWeight: "600",
    color: "#1B3A6B",
  },
  cardDesc: {
    margin: 0,
    fontSize: "13px",
    color: "#6B7280",
  },
  badge: {
    background: "#E1F5EE",
    color: "#0F6E56",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  dropZone: {
    border: "2px dashed #E8A020",
    borderRadius: "8px",
    background: "#F7F8FA",
    padding: "40px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: "20px",
    position: "relative",
  },
  dropContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  uploadIcon: {
    fontSize: "32px",
    marginBottom: "8px",
  },
  dropText: {
    margin: 0,
    fontSize: "14px",
    fontWeight: "500",
    color: "#1B3A6B",
  },
  dropSubtext: {
    margin: 0,
    fontSize: "12px",
    color: "#6B7280",
  },
  hiddenInput: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "#FDF3E0",
    border: "1px solid #E8A020",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "16px",
  },
  fileIcon: {
    fontSize: "24px",
  },
  fileName: {
    margin: "0 0 2px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1B3A6B",
  },
  fileSize: {
    margin: 0,
    fontSize: "12px",
    color: "#6B7280",
  },
  button: {
    width: "100%",
    padding: "12px 16px",
    background: "#E8A020",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  buttonLoading: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};
