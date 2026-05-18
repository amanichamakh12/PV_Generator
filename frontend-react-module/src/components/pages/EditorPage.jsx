const EditorPage = () => {
  return (
    <div style={{ padding: '40px' }}>
      <h1>Validation humaine</h1>

      <div
        contentEditable
        suppressContentEditableWarning
        style={{
          marginTop: '24px',
          background: 'white',
          padding: '32px',
          borderRadius: '20px',
          minHeight: '500px',
          border: '1px solid #e5e7eb'
        }}
      >
        Procès-verbal généré automatiquement...
      </div>
    </div>
  );
};

export default EditorPage;