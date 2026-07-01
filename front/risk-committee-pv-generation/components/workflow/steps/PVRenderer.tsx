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
    <div style={{
      fontFamily: '"Times New Roman", "Georgia", serif',
      fontSize: "11pt",
      color: "#000",
      lineHeight: 1.75,
      backgroundColor: "#ffffff",
      padding: "56px 64px",
      maxWidth: "760px",
      margin: "0 auto",
      boxShadow: "0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
    }}>
      {lines.map((rawLine, i) => {
        const line = rawLine.trim();

        if (!line) return <div key={i} style={{ height: "0.7em" }} />;

        // Séparateur ---
        if (line === "---") return (
          <hr key={i} style={{ border: "none", borderTop: "1px solid #888", margin: "18px 0" }} />
        );

        // Ligne de signature ___
        if (/^_{10,}$/.test(line)) return (
          <div key={i} style={{
            display: "inline-block",
            width: "200px",
            borderBottom: "1px solid #000",
            marginTop: "36px",
            marginBottom: "4px",
          }} />
        );

        // # Titre principal
        if (line.startsWith("# ")) return (
          <div key={i} style={{ textAlign: "center", margin: "0 0 20px" }}>
            <div style={{
              fontWeight: "bold",
              fontSize: "16pt",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#000",
              marginBottom: "10px",
            }}>
              {line.replace("# ", "")}
            </div>
            <div style={{ borderBottom: "2.5px solid #000" }} />
          </div>
        );

        // ## Section
        if (line.startsWith("## ")) return (
          <div key={i} style={{ margin: "28px 0 10px" }}>
            <div style={{
              fontWeight: "bold",
              fontSize: "10.5pt",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#000",
              borderBottom: "1.5px solid #000",
              paddingBottom: "5px",
            }}>
              {line.replace("## ", "")}
            </div>
          </div>
        );

        // ### Sous-section / Point ODJ
        if (line.startsWith("### ")) return (
          <div key={i} style={{
            fontWeight: "bold",
            fontSize: "11pt",
            color: "#000",
            marginTop: "18px",
            marginBottom: "6px",
            borderLeft: "3px solid #000",
            paddingLeft: "10px",
          }}>
            {line.replace("### ", "")}
          </div>
        );

        // - Liste
        if (line.startsWith("- ")) return (
          <div key={i} style={{
            paddingLeft: "28px",
            marginBottom: "3px",
            textAlign: "justify" as const,
          }}>
            <span style={{ marginRight: "6px" }}>—</span>
            {renderInline(line.replace("- ", ""))}
          </div>
        );

        // • Bullet
        if (line.startsWith("• ")) return (
          <div key={i} style={{
            paddingLeft: "36px",
            marginBottom: "3px",
            textAlign: "justify" as const,
          }}>
            <span style={{ marginRight: "6px" }}>•</span>
            {renderInline(line.replace("• ", ""))}
          </div>
        );

        // 1. Numérotée
        if (/^\d+\.\s/.test(line)) return (
          <div key={i} style={{ paddingLeft: "28px", marginBottom: "3px" }}>
            {renderInline(line)}
          </div>
        );

        // Paragraphe normal
        return (
          <p key={i} style={{ margin: "4px 0", textAlign: "justify" }}>
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}
