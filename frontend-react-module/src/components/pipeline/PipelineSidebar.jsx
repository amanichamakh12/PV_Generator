const steps = [
  'Upload PPTX',
  'Extraction slides',
  'Analyse slide par slide',
  'Analyse ordre du jour',
  'Génération du PV',
  'Validation humaine'
];

const PipelineSidebar = () => {
  return (
    <div
      style={{
        background: 'white',
        borderRight: '1px solid #e5e7eb',
        padding: '24px'
      }}
    >
      <h2>Pipeline IA</h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginTop: '32px'
        }}
      >
        {steps.map((step, index) => (
          <div
            key={index}
            style={{
              padding: '14px',
              borderRadius: '12px',
              background:
                index === 2
                  ? '#ede9fe'
                  : '#f8fafc'
            }}
          >
            {index < 2 ? '✓' : index === 2 ? '⟳' : '○'} {step}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelineSidebar;