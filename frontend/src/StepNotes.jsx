export default function StepNotes({ state, setState, next, back }) {
  const addNote = () => {
    setState({
      notes: [...state.notes, { participant: "", content: "" }],
    });
  };

  const updateNote = (i, field, value) => {
    const notes = [...state.notes];
    notes[i][field] = value;
    setState({ notes });
  };

  return (
    <div>
      <h2>Notes</h2>

      {state.notes.map((n, i) => (
        <div key={i}>
          <input
            placeholder="Participant"
            value={n.participant}
            onChange={(e) =>
              updateNote(i, "participant", e.target.value)
            }
          />
          <input
            placeholder="Note"
            value={n.content}
            onChange={(e) =>
              updateNote(i, "content", e.target.value)
            }
          />
        </div>
      ))}

      <button onClick={addNote}>+ Ajouter</button>

      <button onClick={back}>Retour</button>
      <button onClick={next}>Fusion</button>
    </div>
  );
}