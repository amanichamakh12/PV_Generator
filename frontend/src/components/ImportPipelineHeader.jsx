export default function ImportPipelineHeader({ steps, currentStep }) {
  return (
    <div style={s.header}>
      <div style={s.title}>
        <h1 style={s.heading}>Import de Présentation</h1>
        <p style={s.subtitle}>Pipeline d'extraction et de validation</p>
      </div>

      <div style={s.stepsContainer}>
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isDone = step.id < currentStep;
          const isNext = step.id === currentStep + 1;

          return (
            <div key={step.id} style={s.stepWrapper}>
              <div
                style={{
                  ...s.stepItem,
                  ...(isDone && s.stepItemDone),
                  ...(isActive && s.stepItemActive),
                }}
              >
                <div
                  style={{
                    ...s.stepCircle,
                    background: isDone
                      ? "#0F6E56"
                      : isActive
                      ? "#E8A020"
                      : isNext
                      ? "#D1D5DB"
                      : "#E2E6EE",
                    color: isDone || isActive ? "white" : "#9CA3AF",
                  }}
                >
                  {isDone ? "✓" : step.id}
                </div>
                <div>
                  <p style={s.stepLabel}>{step.label}</p>
                  <p style={s.stepDesc}>{step.description}</p>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div
                  style={{
                    ...s.connector,
                    background:
                      step.id < currentStep
                        ? "#0F6E56"
                        : step.id === currentStep
                        ? "#E8A020"
                        : "#E2E6EE",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  header: {
    paddingBottom: "24px",
    borderBottom: "1px solid #E2E6EE",
  },
  title: {
    marginBottom: "24px",
  },
  heading: {
    margin: 0,
    fontSize: "28px",
    fontFamily: "'DM Serif Display', serif",
    color: "#1B3A6B",
    fontWeight: 400,
  },
  subtitle: {
    margin: "6px 0 0 0",
    fontSize: "14px",
    color: "#6B7280",
  },
  stepsContainer: {
    display: "flex",
    alignItems: "stretch",
    gap: "0",
  },
  stepWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "stretch",
    position: "relative",
  },
  stepItem: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    borderRadius: "8px",
    background: "#F7F8FA",
    border: "1px solid #E2E6EE",
    transition: "all 0.3s ease",
  },
  stepItemActive: {
    background: "#FDF3E0",
    border: "1px solid #E8A020",
  },
  stepItemDone: {
    background: "#E1F5EE",
    border: "1px solid #0F6E56",
  },
  stepCircle: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    fontSize: "16px",
    flexShrink: 0,
    transition: "all 0.3s ease",
  },
  stepLabel: {
    margin: "0 0 4px 0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1B3A6B",
  },
  stepDesc: {
    margin: 0,
    fontSize: "12px",
    color: "#6B7280",
  },
  connector: {
    position: "absolute",
    right: "-8px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "16px",
    height: "3px",
    zIndex: 1,
    transition: "all 0.3s ease",
  },
};
