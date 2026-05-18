import React, { useState } from 'react';
import { FileText, Search, Filter, Download, Eye } from 'lucide-react';

const Documents = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const documents = [
    {
      id: 1,
      name: 'PV_Réunion_Conseil_2024_01.pdf',
      type: 'PV Généré',
      date: '2024-01-15',
      size: '2.4 MB',
      status: 'completed'
    },
    {
      id: 2,
      name: 'Réunion_technique_Q1.pptx',
      type: 'Document source',
      date: '2024-01-10',
      size: '15.8 MB',
      status: 'processed'
    },
    {
      id: 3,
      name: 'PV_Assemblée_Générale.pdf',
      type: 'PV Généré',
      date: '2024-01-08',
      size: '1.9 MB',
      status: 'completed'
    },
    {
      id: 4,
      name: 'Notes_réunion_commerciale.docx',
      type: 'Document source',
      date: '2024-01-05',
      size: '856 KB',
      status: 'processing'
    }
  ];

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || doc.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="fade-in">
      <header className="main-header">
        <h1 className="main-title">Documents</h1>
        <p className="main-subtitle">
          Gérez vos procès-verbaux et documents sources
        </p>
      </header>

      {/* Search and Filter */}
      <div className="card">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)'
            }} />
            <input
              type="text"
              placeholder="Rechercher des documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                background: 'var(--surface)'
              }}
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '12px 16px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              background: 'var(--surface)',
              minWidth: '150px'
            }}
          >
            <option value="all">Tous les statuts</option>
            <option value="completed">Terminé</option>
            <option value="processing">En cours</option>
            <option value="processed">Traité</option>
          </select>
        </div>

        {/* Documents List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredDocuments.map(doc => (
            <div key={doc.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              transition: 'var(--transition)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <FileText size={24} color="var(--accent)" />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontWeight: '500', color: 'var(--text)' }}>
                    {doc.name}
                  </h4>
                  <p style={{ margin: '0', fontSize: '12px', color: 'var(--muted)' }}>
                    {doc.type} • {doc.date} • {doc.size}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`status ${
                  doc.status === 'completed' ? 'status-success' :
                  doc.status === 'processing' ? 'status-warning' :
                  'status-success'
                }`}>
                  {doc.status === 'completed' ? 'Terminé' :
                   doc.status === 'processing' ? 'En cours' :
                   'Traité'}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ padding: '8px' }}>
                    <Eye size={14} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '8px' }}>
                    <Download size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredDocuments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>Aucun document trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;