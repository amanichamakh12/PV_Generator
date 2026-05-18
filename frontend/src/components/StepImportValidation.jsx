export default function StepImportValidation({
  data,
  onContinue,
  onRetry,
}) {
  return (
    <div style={{ ...s.card }}>
      <div style={s.cardHeader}>
        <div>
          <h3 style={s.cardTitle}>3. Validation</h3>
          <p style={s.cardDesc}>
            Vérification et confirmation des données extraites
          </p>
        </div>
        <span style={s.badge}>Prêt</span>
      </div>

      {/* Checklist de validation */}
      <div style={s.checklist}>
        <ValidationItem
          label="Fichier importé avec succès"
          status="success"
        />
        <ValidationItem
          label={`${data.nb_slides || 0} slides analysées`}
          status="success"
        />
        <ValidationItem
          label={`${data.nb_graphiques_natifs || 0} graphiques détectés`}
          status="success"
        />
        <ValidationItem
          label={`${data.nb_images_ocr || 0} images traitées`}
          status="success"
        />
      </div>

      {/* Résumé */}
      <div style={s.summaryBox}>
        <h4 style={s.summaryTitle}>Résumé de l'extraction</h4>
        <div style={s.summaryContent}>
          <p style={s.summaryItem}>
            <strong>Total slides :</strong> {data.nb_slides || 0}
          </p>
          <p style={s.summaryItem}>
            <strong>Slides avec contenu :</strong>{" "}
            {(data.nb_slides || 0) - (data.nb_slides_vides || 0)}
          </p>
          <p style={s.summaryItem}>
            <strong>Slides vides :</strong> {data.nb_slides_vides || 0}
          </p>
          <p style={s.summaryItem}>
            <strong>Éléments détectés :</strong>{" "}
            {(data.nb_graphiques_natifs || 0) +
              (data.nb_images_ocr || 0)}{" "}
            (graphiques + images)
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={s.actions}>
        <button onClick={onRetry} style={s.buttonSecondary}>
          ← Recommencer
        </button>
        <button onClick={onContinue} style={s.buttonPrimary}>
          Continuer vers la génération →
        </button>
      </div>
    </div>
  );
}

function ValidationItem({ label, status }) {
  const isSuccess = status === "success";

  return (
    <div style={s.validationItem}>
      <div
        style={{
          ...s.validationIcon,
          color: isSuccess ? "#0F6E56" : "#E8A020",
        }}
      >
        {isSuccess ? "✓" : "⏳"}
      </div>
      <span style={s.validationLabel}>{label}</span>
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
    background: "#FDF3E0",
    color: "#E8A020",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  checklist: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "20px",
  },
  validationItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "#F7F8FA",
    borderRadius: "6px",
  },
  validationIcon: {
    fontSize: "18px",
    fontWeight: "600",
    width: "24px",
    textAlign: "center",
    flexShrink: 0,
  },
  validationLabel: {
    fontSize: "13px",
    color: "#1B3A6B",
    fontWeight: "500",
  },
  summaryBox: {
    background: "#FDF3E0",
    border: "1px solid #E8A020",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  },
  summaryTitle: {
    margin: "0 0 12px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1B3A6B",
  },
  summaryContent: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  summaryItem: {
    margin: 0,
    fontSize: "12px",
    color: "#6B7280",
    lineHeight: "1.5",
  },
  actions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  buttonPrimary: {
    padding: "12px 20px",
    background: "#1B3A6B",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  buttonSecondary: {
    padding: "12px 20px",
    background: "white",
    color: "#1B3A6B",
    border: "1px solid #E2E6EE",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};
