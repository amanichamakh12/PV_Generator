import PipelineSidebar from './PipelineSidebar';
import PipelineLogs from './PipelineLogs';
import PipelineSummary from './PipelineSummary';
const PipelineLayout = () => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        height: '100vh',
        background: '#f8fafc'
      }}
    >
      {/* LEFT */}
      <PipelineSidebar />

      {/* RIGHT */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh'
        }}
      >
        <PipelineLogs />

        <PipelineSummary />
      </div>
    </div>
  );
};

export default PipelineLayout;