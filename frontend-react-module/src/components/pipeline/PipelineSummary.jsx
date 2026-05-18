import { useNavigate } from 'react-router-dom';

const PipelineSummary = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        borderTop: '1px solid #e5e7eb',
        background: 'white',
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div>
        <div>11 slides analysées</div>
        <div>3 décisions détectées</div>
        <div>Temps restant estimé : 38 sec</div>
      </div>

      <button
        onClick={() => navigate('/editor')}
        style={{
          background: '#7c5cff',
          color: 'white',
          border: 'none',
          padding: '14px 20px',
            borderRadius: '12px',
          cursor: 'pointer'
        }}
      >
        Ouvrir le PV
      </button>
    </div>
  );
};

export default PipelineSummary;