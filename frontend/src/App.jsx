import { useState } from "react";

/* ─── Data ─── */
const steps = [
  { id: 1, label: "Import" },
  { id: 2, label: "Informations" },
  { id: 3, label: "En séance" },
  { id: 4, label: "Génération PV" },
];

const meetingTypes = [
  "Comité de crédit",
  "Comité de direction",
  "Réunion d'équipe",
  "Réunion de projet",
  "Réunion de provisionnement",
];

const allParticipants = [
  { id: 1, initials: "AB", name: "Ahmed B.", full: "Ahmed Bensalem", color: "#1A3A5C" },
  { id: 2, initials: "SM", name: "Sara M.",  full: "Sara Mansouri",  color: "#1A3A5C" },
  { id: 3, initials: "NK", name: "Nour K.",  full: "Nour Karoui",    color: "#1A3A5C" },
];

/* ─── Component ─── */
export default function NewMeeting({ onStartSession }) {
  // ── Tous les hooks en premier, sans condition ──
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    titre:    "",
    type:     "Comité de crédit",
    date:     "2026-04-10",
    heure:    "14:00",
    modalite: "presentiel",
    salle:    "Salle B3",
  });
  const [participants, setParticipants] = useState([1, 2, 3]);
  const [president, setPresident]       = useState("Ahmed Bensalem");
  const [showAddMenu, setShowAddMenu]   = useState(false);
  const [agenda, setAgenda] = useState([
    { id: 1, text: "Validation du bilan Q1" },
    { id: 2, text: "Budget prévisionnel Q2" },
  ]);

  const setField = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const removeParticipant = (id) => setParticipants((p) => p.filter((x) => x !== id));
  const addParticipant    = (id) => { if (!participants.includes(id)) setParticipants((p) => [...p, id]); setShowAddMenu(false); };
  const availableToAdd    = allParticipants.filter((p) => !participants.includes(p.id));
  const selectedParts     = allParticipants.filter((p) => participants.includes(p.id));

  const addAgendaItem    = () => setAgenda((a) => [...a, { id: Date.now(), text: "" }]);
  const removeAgendaItem = (id) => setAgenda((a) => a.filter((x) => x.id !== id));
  const updateAgendaItem = (id, text) => setAgenda((a) => a.map((x) => (x.id === id ? { ...x, text } : x)));

  const handleStartSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Validation simple
      if (!form.titre.trim()) {
        setError("Le titre de la réunion est obligatoire");
        setIsLoading(false);
        return;
      }

      if (selectedParts.length === 0) {
        setError("Au moins un participant est requis");
        setIsLoading(false);
        return;
      }

      // Filtrer les points d'agenda vides
      const validAgenda = agenda
        .filter(item => item.text.trim() !== "")
        .map(item => item.text);

      const payload = {
        titre: form.titre,
        type: form.type,
        date: form.date,
        heure: form.heure,
        modalite: form.modalite,
        salle: form.salle,
        participants: participants,
        president: president,
        agenda: validAgenda,
        createdBy: "Utilisateur"
      };

      const response = await fetch("http://127.0.0.1:9000/api/meetings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        
      });
      console.log(response);
      
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.statusText}`);
      }

      const result = await response.json();

      // Sauvegarder l'ID de la réunion et appeler le callback
      if (onStartSession) {
        onStartSession(result.meetingId, {
          titre: form.titre,
          date: form.date,
          heure: form.heure,
          participants: selectedParts,
          agenda: validAgenda
        });
      }
    } catch (err) {
      setError(`Erreur: ${err.message}`);
      console.error("Erreur création réunion:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={s.page}>

      {/* ══ Stepper ══ */}
      <div style={s.stepper}>
        {steps.map((step, i) => {
          const active = step.id === currentStep;
          const done   = step.id < currentStep;
          return (
            <div key={step.id} style={s.stepRow}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  ...s.stepCircle,
                  background: active || done ? "#1A3A5C" : "#D1D5DB",
                  color:      active || done ? "#fff"    : "#9CA3AF",
                }}>
                  {step.id}
                </div>
                <span style={{
                  ...s.stepLabel,
                  color:      active ? "#1A3A5C" : done ? "#6B7280" : "#9CA3AF",
                  fontWeight: active ? 600 : 400,
                }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && <div style={s.stepLine} />}
            </div>
          );
        })}
      </div>

      {/* ══ Card 1 — Informations générales ══ */}
      <div style={s.card}>
        <h2 style={s.cardTitle}>Informations générales</h2>

        <div style={s.fieldGroup}>
          <label style={s.label}>TITRE DE LA RÉUNION</label>
          <input
            style={s.input}
            placeholder="Ex : Comité de crédit Q2 2026"
            value={form.titre}
            onChange={(e) => setField("titre", e.target.value)}
          />
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>TYPE DE RÉUNION</label>
          <div style={{ position: "relative" }}>
            <select style={s.select} value={form.type} onChange={(e) => setField("type", e.target.value)}>
              {meetingTypes.map((t) => <option key={t}>{t}</option>)}
            </select>
            <span style={s.selectArrow}>▾</span>
          </div>
        </div>

        <div style={s.row}>
          <div style={{ ...s.fieldGroup, flex: 1 }}>
            <label style={s.label}>DATE</label>
            <input type="date" style={s.input} value={form.date} onChange={(e) => setField("date", e.target.value)} />
          </div>
          <div style={{ ...s.fieldGroup, flex: 1 }}>
            <label style={s.label}>HEURE</label>
            <input type="time" style={s.input} value={form.heure} onChange={(e) => setField("heure", e.target.value)} />
          </div>
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>LIEU / MODALITÉ</label>
          <div style={s.radioGroup}>
            {[
              { value: "presentiel", label: "Présentiel" },
              { value: "visio",      label: "Visioconférence" },
              { value: "hybride",    label: "Hybride" },
            ].map((opt) => (
              <label key={opt.value} style={s.radioLabel} onClick={() => setField("modalite", opt.value)}>
                <div style={{ ...s.radioCircle, borderColor: form.modalite === opt.value ? "#1A3A5C" : "#D1D5DB" }}>
                  {form.modalite === opt.value && <div style={s.radioDot} />}
                </div>
                <span style={s.radioText}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>SALLE</label>
          <input style={s.input} value={form.salle} placeholder="Ex : Salle B3" onChange={(e) => setField("salle", e.target.value)} />
        </div>
      </div>

      {/* ══ Card 2 — Participants ══ */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <h2 style={s.cardTitle}>Participants</h2>

        <div style={s.chipsRow}>
          {selectedParts.map((p) => (
            <div key={p.id} style={s.chip}>
              <div style={{ ...s.avatar, background: p.color }}>{p.initials}</div>
              <span style={s.chipName}>{p.name}</span>
              <button style={s.chipRemove} onClick={() => removeParticipant(p.id)}>×</button>
            </div>
          ))}

          <div style={{ position: "relative" }}>
            <button style={s.addBtn} onClick={() => setShowAddMenu((v) => !v)}>
              + Ajouter
            </button>
            {showAddMenu && (
              <div style={s.addMenu}>
                {availableToAdd.length === 0 ? (
                  <div style={s.addMenuItem}>Tous les participants sont ajoutés</div>
                ) : (
                  availableToAdd.map((p) => (
                    <div
                      key={p.id}
                      style={s.addMenuItem}
                      onClick={() => addParticipant(p.id)}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#F9FAFB"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                    >
                      <div style={{ ...s.avatar, background: p.color, width: 28, height: 28, fontSize: 11 }}>
                        {p.initials}
                      </div>
                      {p.full}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ ...s.fieldGroup, marginTop: 20 }}>
          <label style={s.label}>PRÉSIDENT DE SÉANCE</label>
          <div style={{ position: "relative" }}>
            <select style={s.select} value={president} onChange={(e) => setPresident(e.target.value)}>
              {selectedParts.map((p) => (
                <option key={p.id} value={p.full}>{p.full}</option>
              ))}
            </select>
            <span style={s.selectArrow}>▾</span>
          </div>
        </div>
      </div>

      {/* ══ Card 3 — Ordre du jour ══ */}
      <div style={{ ...s.card, marginTop: 16 }}>
        <h2 style={s.cardTitle}>Ordre du jour</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agenda.map((item, idx) => (
            <div key={item.id} style={s.agendaRow}>
              <span style={s.agendaNum}>{idx + 1}.</span>
              <input
                style={{ ...s.input, flex: 1 }}
                value={item.text}
                placeholder="Ajouter un point..."
                onChange={(e) => updateAgendaItem(item.id, e.target.value)}
              />
              <button
                style={s.deleteBtn}
                onClick={() => removeAgendaItem(item.id)}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "#FEF2F2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#9CA3AF"; e.currentTarget.style.background = "none"; }}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>

        <button style={s.addPointBtn} onClick={addAgendaItem}>
          + Ajouter un point
        </button>
      </div>

      {/* ══ Actions ══ */}
      <div style={s.actions}>
        <button style={s.btnGhost}>Annuler</button>
        <div style={{ display: "flex", gap: 12 }}>
          <button style={s.btnSecondary}>Enregistrer le formulaire</button>
          <button 
            style={{ ...s.btnPrimary, opacity: isLoading ? 0.6 : 1, cursor: isLoading ? "not-allowed" : "pointer" }}
            onClick={handleStartSession}
            disabled={isLoading}
          >
            {isLoading ? "Création..." : "Démarrer la séance →"}
          </button>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          background: "#FEE2E2",
          border: "1px solid #FECACA",
          borderRadius: 8,
          padding: "12px 16px",
          color: "#991B1B",
          fontSize: 14,
          maxWidth: 300,
          zIndex: 1000
        }}>
          {error}
        </div>
      )}

    </div>
  );
}

/* ─── Trash SVG ─── */
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}

/* ─── Styles ─── */
const s = {
  page: {
    minHeight: "100vh",
    background: "#F3F4F6",
    padding: "40px 24px 80px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  stepper: {
    display: "flex",
    alignItems: "center",
    marginBottom: 32,
    width: "100%",
    maxWidth: 720,
  },
  stepRow: { display: "flex", alignItems: "center", flex: 1 },
  stepCircle: {
    width: 36, height: 36, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, fontWeight: 600, flexShrink: 0, transition: "all 0.2s",
  },
  stepLabel: { fontSize: 15, whiteSpace: "nowrap", transition: "all 0.2s" },
  stepLine: { flex: 1, height: 1, background: "#D1D5DB", margin: "0 12px" },

  card: {
    background: "#fff",
    borderRadius: 14,
    padding: "28px 32px",
    width: "100%",
    maxWidth: 720,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  cardTitle: { fontSize: 19, fontWeight: 600, color: "#111827", margin: "0 0 24px" },
  fieldGroup: { marginBottom: 20 },
  label: {
    display: "block", fontSize: 11, fontWeight: 600,
    letterSpacing: "0.07em", color: "#6B7280", marginBottom: 8, textTransform: "uppercase",
  },
  input: {
    width: "100%", padding: "11px 14px", fontSize: 15, color: "#111827",
    border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  },
  select: {
    width: "100%", padding: "11px 36px 11px 14px", fontSize: 15, color: "#111827",
    border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff",
    outline: "none", appearance: "none", fontFamily: "inherit", cursor: "pointer",
  },
  selectArrow: {
    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
    color: "#6B7280", pointerEvents: "none", fontSize: 13,
  },
  row: { display: "flex", gap: 16 },
  radioGroup: { display: "flex", gap: 28, alignItems: "center", paddingTop: 4 },
  radioLabel: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  radioCircle: {
    width: 18, height: 18, borderRadius: "50%", border: "2px solid",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "border-color 0.15s", flexShrink: 0,
  },
  radioDot: { width: 8, height: 8, borderRadius: "50%", background: "#1A3A5C" },
  radioText: { fontSize: 15, color: "#374151" },

  chipsRow: { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" },
  chip: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#F9FAFB", border: "1px solid #E5E7EB",
    borderRadius: 50, padding: "5px 12px 5px 6px",
  },
  avatar: {
    width: 32, height: 32, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 600, color: "#fff", flexShrink: 0,
  },
  chipName: { fontSize: 14, color: "#111827", fontWeight: 500 },
  chipRemove: {
    background: "none", border: "none", color: "#9CA3AF",
    fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 0 0 2px",
  },
  addBtn: {
    display: "flex", alignItems: "center", gap: 4,
    background: "#fff", border: "1px dashed #D1D5DB", borderRadius: 50,
    padding: "6px 16px", fontSize: 14, color: "#374151",
    cursor: "pointer", fontFamily: "inherit",
  },
  addMenu: {
    position: "absolute", top: 44, left: 0, zIndex: 10,
    background: "#fff", border: "1px solid #E5E7EB",
    borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
    minWidth: 200, overflow: "hidden",
  },
  addMenuItem: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 14px", fontSize: 14, color: "#111827",
    cursor: "pointer", background: "#fff",
  },

  agendaRow: { display: "flex", alignItems: "center", gap: 12 },
  agendaNum: { fontSize: 15, color: "#6B7280", minWidth: 24, textAlign: "right" },
  deleteBtn: {
    background: "none", border: "none", color: "#9CA3AF",
    cursor: "pointer", padding: 6, borderRadius: 6,
    display: "flex", alignItems: "center", flexShrink: 0,
    transition: "color 0.15s, background 0.15s",
  },
  addPointBtn: {
    background: "none", border: "none", color: "#1D9E75",
    fontSize: 14, fontWeight: 500, cursor: "pointer",
    padding: "12px 0 0", fontFamily: "inherit",
  },

  actions: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    width: "100%", maxWidth: 720, marginTop: 24, padding: "20px 0",
  },
  btnGhost: {
    background: "none", border: "none",
    fontSize: 14, color: "#6B7280", cursor: "pointer",
  },
  btnSecondary: {
    background: "#fff", border: "1px solid #D1D5DB", borderRadius: 8,
    fontSize: 14, color: "#374151", padding: "11px 22px",
    cursor: "pointer", fontFamily: "inherit",
  },
  btnPrimary: {
    background: "#1D9E75", border: "none", borderRadius: 8,
    fontSize: 14, color: "#fff", fontWeight: 500,
    padding: "11px 24px", cursor: "pointer", fontFamily: "inherit",
  },
};