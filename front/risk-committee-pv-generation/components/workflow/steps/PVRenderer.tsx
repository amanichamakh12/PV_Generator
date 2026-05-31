export function PVRenderer({ content }: { content: string }) {
const lines = content.replace(/\\n/g, '\n').split(/\r?\n/);
  const renderInline = (text: string, key?: number) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={key}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: "Calibri, sans-serif", fontSize: "11pt", color: "#000", lineHeight: 1.6 }}>
      {lines.map((rawLine, i) => {
        const line = rawLine.trim();

        if (!line) return <div key={i} style={{ height: "0.5em" }} />;

        // Séparateur ---
        if (line === "---") {
          return <hr key={i} style={{ borderTop: "1px solid #ccc", margin: "16px 0" }} />;
        }

        // # Titre principal
        if (line.startsWith("# ")) {
          return (
            <div key={i}>
              <h1 style={{
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "18pt",
                color: "#000",
                margin: "24px 0 8px",
              }}>
                {line.replace("# ", "")}
              </h1>
              <hr style={{ borderTop: "2px solid #000", margin: "0 0 16px" }} />
            </div>
          );
        }

        // ## Section
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} style={{
              fontWeight: "bold",
              fontSize: "14pt",
              color: "#000",
              borderLeft: "4px solid #000",
              paddingLeft: "12px",
              margin: "20px 0 8px",
            }}>
              {line.replace("## ", "")}
            </h2>
          );
        }

        // ### Sous-section
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} style={{
              fontWeight: "bold",
              fontStyle: "italic",
              fontSize: "12pt",
              color: "#000",
              margin: "16px 0 6px",
            }}>
              {line.replace("### ", "")}
            </h3>
          );
        }

        // - Liste
        if (line.startsWith("- ")) {
          return (
            <div key={i} style={{ paddingLeft: "24px", marginBottom: "4px" }}>
              – {renderInline(line.replace("- ", ""))}
            </div>
          );
        }

        // • Remarque (bullet point groq)
        if (line.startsWith("• ")) {
          return (
            <div key={i} style={{
              paddingLeft: "32px",
              marginBottom: "4px",
              fontSize: "11pt",
              color: "#222",
            }}>
              • {renderInline(line.replace("• ", ""))}
            </div>
          );
        }

        // 1. Liste numérotée
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={i} style={{ paddingLeft: "24px", marginBottom: "4px" }}>
              {renderInline(line)}
            </div>
          );
        }

        // Paragraphe normal
        return (
          <p key={i} style={{ margin: "4px 0", fontSize: "11pt" }}>
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}