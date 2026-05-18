const logs = [
  'Extraction du texte — slide 1/11',
  'Décisions détectées',
  'Participants identifiés',
  'Analyse financière détectée',
  'Vote détecté'
];

const PipelineLogs = () => {
  return (
    <div
      style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto'
      }}
    >
      <h1>Analyse du document</h1>

      <div
        style={{
          marginTop: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
                {logs.map((log, index) => (
          <div
            key={index}
            style={{
              background: 'white',
              padding: '16px',
              borderRadius: '14px',
              border: '1px solid #e5e7eb'
            }}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelineLogs;