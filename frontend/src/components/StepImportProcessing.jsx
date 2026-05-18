export default function StepImportProcessing({ loading, error, data, isComplete }) {
  return (
    <div style={{ ...s.card, ...(isComplete && s.cardComplete) }}>
      <div style={s.cardHeader}>
        <div>
          <h3 style={s.cardTitle}>2. Traitement des données</h3>
          <p style={s.cardDesc}>
            Extraction et structuration du contenu
          </p>
        </div>
        {isComplete && <span style={s.badge}>✓ Complété</span>}
      </div>

      {/* État de chargement */}
      {loading ? (
        <div style={s.loadingContainer}>
          <div style={s.spinner} />
          <p style={s.loadingText}>Extraction en cours...</p>
          <p style={s.loadingSubtext}>
            Veuillez patienter pendant l'analyse de la présentation
          </p>
        </div>
      ) : error ? (
        <div style={s.errorContainer}>
          <div style={s.errorIcon}>⚠️</div>
          <p style={s.errorText}>{error}</p>
        </div>
      ) : data ? (
        <div style={s.dataContainer}>
          {/* Résumé des données extraites */}
          <div style={s.statsGrid}>
            <StatCard
              icon="📄"
              label="Slides"
              value={data.nb_slides || "—"}
            />
            <StatCard
              icon="🖼️"
              label="Graphiques"
              value={data.nb_graphiques_natifs || 0}
            />
            <StatCard
              icon="🖼️"
              label="Images"
              value={data.nb_images_ocr || 0}
            />
            <StatCard
              icon="✓"
              label="Slides vides"
              value={data.nb_slides_vides || 0}
            />
          </div>

          {/* Détails des slides */}
          {data.slides && data.slides.length > 0 && (
            <div style={s.slidesPreview}>
              <h4 style={s.previewTitle}>Aperçu des slides</h4>
              <div style={s.slidesList}>
                {data.slides.slice(0, 3).map((slide, idx) => (
                  <div key={idx} style={s.slideItem}>
                    <span style={s.slideNum}>{idx + 1}</span>
                    <div style={s.slideContent}>
                      <p style={s.slideTitle}>
                        {slide.titre || "(Sans titre)"}
                      </p>
                      {slide.contenu && slide.contenu.length > 0 && (
                        <p style={s.slideContentText}>
                          {slide.contenu[0].substring(0, 60)}...
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {data.slides.length > 3 && (
                <p style={s.moreSlides}>
                  ... et {data.slides.length - 3} autres slides
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={s.statCard}>
      <div style={s.statIcon}>{icon}</div>
      <p style={s.statLabel}>{label}</p>
      <p style={s.statValue}>{value}</p>
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
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    gap: "12px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #E2E6EE",
    borderTop: "3px solid #E8A020",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    margin: 0,
    fontSize: "14px",
    fontWeight: "600",
    color: "#1B3A6B",
  },
  loadingSubtext: {
    margin: 0,
    fontSize: "13px",
    color: "#6B7280",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    gap: "12px",
    background: "#FDECEA",
    borderRadius: "8px",
  },
  errorIcon: {
    fontSize: "32px",
  },
  errorText: {
    margin: 0,
    fontSize: "13px",
    color: "#C0392B",
    textAlign: "center",
  },
  dataContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
  },
  statCard: {
    background: "#F7F8FA",
    border: "1px solid #E2E6EE",
    borderRadius: "8px",
    padding: "16px",
    textAlign: "center",
  },
  statIcon: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  statLabel: {
    margin: "0 0 4px 0",
    fontSize: "12px",
    color: "#6B7280",
    fontWeight: "500",
  },
  statValue: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#1B3A6B",
  },
  slidesPreview: {
    marginTop: "16px",
  },
  previewTitle: {
    margin: "0 0 12px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1B3A6B",
  },
  slidesList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  slideItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    background: "#F7F8FA",
    borderRadius: "6px",
  },
  slideNum: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    background: "#E8A020",
    color: "white",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "600",
    flexShrink: 0,
  },
  slideContent: {
    flex: 1,
    minWidth: 0,
  },
  slideTitle: {
    margin: "0 0 4px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1B3A6B",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  slideContentText: {
    margin: 0,
    fontSize: "12px",
    color: "#6B7280",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  moreSlides: {
    margin: "8px 0 0 0",
    fontSize: "12px",
    color: "#6B7280",
    fontStyle: "italic",
  },
};
