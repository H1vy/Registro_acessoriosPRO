import React, { useState } from 'react'
import { ClipboardCheck, CheckCircle2, User, PackageSearch } from 'lucide-react'
import ConfirmModal from './ConfirmModal'

export default function PartSales({ movements, setMovements, accessories, responsibles, currentUser }) {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [currentPage, setCurrentPage] = useState(1)
  const [checkinModal, setCheckinModal] = useState({ isOpen: false, movementId: null })
  const itemsPerPage = 10;
  
  // Filtragem por data
  const filteredByDate = movements.filter(m => {
    if (!m || m.isDeleted) return false;
    if (!filterDate) return true;
    
    const mDate = m.timestamp ? new Date(m.timestamp).toISOString().split('T')[0] : null;
    const cDate = (m.checkin?.timestamp || m.checkinAt) ? new Date(m.checkin?.timestamp || m.checkinAt).toISOString().split('T')[0] : null;
    
    // Para pendentes, filtramos pela data da saída
    // Para realizados, filtramos pela data do check-in (conforme lógica de "reset diário")
    return mDate === filterDate || cDate === filterDate;
  });

  // Apenas registros de saída que não foram anulados/retornados
  // REMOÇÃO: Escondemos itens com O.S. da aba Part Sales, pois eles pertencem ao fluxo de Service Orders
  const activeMovements = filteredByDate.filter(m => 
    !m.annulled && !m.checkin && 
    (!m.soNumber || m.soNumber === '-' || m.soNumber.toUpperCase() === 'S/N' || m.soNumber.toUpperCase() === 'AVULSO')
  );
  const checkedInMovements = filteredByDate.filter(m => m.checkin && !m.annulled);

  // Paginação para check-ins realizados
  const totalPages = Math.ceil(checkedInMovements.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCheckedIn = checkedInMovements.slice(indexOfFirstItem, indexOfLastItem);

  const handleCheckin = () => {
    const id = checkinModal.movementId
    setMovements(prev => prev.map(m => 
      m.id === id ? { 
        ...m, 
        checkin: {
          timestamp: new Date().toISOString(),
          author: currentUser?.username || 'Sistema'
        }
      } : m
    ))
    setCheckinModal({ isOpen: false, movementId: null })
  }

  const getAccessoryLabel = (id) => {
    const acc = accessories.find(a => a.id === id)
    return acc ? `${acc.factoryCode} - ${acc.commercialName}` : 'Desconhecido'
  }

  const getResponsibleName = (id) => {
    const resp = responsibles.find(r => r.id === id)
    return resp ? resp.name : 'Desconhecido'
  }

  const formatDate = (isoStr) => {
    if (!isoStr) return '-'
    const date = new Date(isoStr)
    return date.toLocaleString('pt-BR')
  }

  return (
    <div className="tab-content">
      <div className="action-bar" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PackageSearch className="accent" size={28} /> Part Sales - Check-in de Produtos
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Gerencie o check-in dos acessórios que foram retirados. Registros anulados não aparecem nesta lista.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Filtrar Dia:</label>
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value)
              setCurrentPage(1)
            }}
            className="input-search"
            style={{ width: 'auto', padding: '0.4rem' }}
          />
          <button 
            className={`nav-btn ${!filterDate ? 'active' : ''}`} 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={() => {
              if (filterDate) {
                setFilterDate('')
              } else {
                setFilterDate(new Date().toISOString().split('T')[0])
              }
              setCurrentPage(1)
            }}
          >
            {!filterDate ? 'Ver Hoje' : 'Ver Tudo'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardCheck size={20} className="accent" /> Pendentes de Check-in
          </h3>
          <div className="table-container">
            <table className="responsive-table pending-table">
              <thead>
                <tr>
                  <th>Saída</th>
                  <th>Acessório</th>
                  <th>Responsável</th>
                  <th>O.S.</th>
                  <th style={{ textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {activeMovements.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', opacity: 0.5, padding: '3rem' }}>
                      Nenhum pendente {filterDate ? 'nesta data' : 'encontrado'}.
                    </td>
                  </tr>
                ) : (
                  activeMovements.map((m, index) => (
                    <tr 
                      key={m.id} 
                      className="row-animate" 
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', fontWeight: 500 }}>{formatDate(m.timestamp)}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{getAccessoryLabel(m.accessoryId)}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{getResponsibleName(m.responsibleId)}</td>
                      <td><code style={{ background: 'var(--bg-input)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', border: '1px solid var(--border)', fontSize: '0.8rem' }}>{m.soNumber || '-'}</code></td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn-primary" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => setCheckinModal({ isOpen: true, movementId: m.id })}
                        >
                          <CheckCircle2 size={16} /> Validar Check-in
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8 }}>
              <CheckCircle2 size={20} style={{ color: 'var(--success)' }} /> Check-ins Realizados
            </h3>
            {totalPages > 1 && (
              <div className="pagination" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="nav-btn"
                  style={{ padding: '0.2rem 0.5rem' }}
                >
                  &lt;
                </button>
                <span style={{ fontSize: '0.8rem', minWidth: '3rem', textAlign: 'center' }}>
                  {currentPage} / {totalPages}
                </span>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="nav-btn"
                  style={{ padding: '0.2rem 0.5rem' }}
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
          <div className="table-container">
            <table className="responsive-table completed-checkin-table">
              <thead>
                <tr>
                  <th>Acessório</th>
                  <th>Data Check-in</th>
                  <th>Autor</th>
                </tr>
              </thead>
              <tbody>
                {checkedInMovements.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
                      Nenhum check-in {filterDate ? 'nesta data' : 'ainda'}.
                    </td>
                  </tr>
                ) : (
                  currentCheckedIn.map((m, index) => (
                    <tr 
                      key={m.id} 
                      className="row-animate row-checked-in" 
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td style={{ fontWeight: 500, fontSize: '0.85rem', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{getAccessoryLabel(m.accessoryId)}</td>
                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', fontWeight: 500 }}>{formatDate(m.checkin?.timestamp || m.checkinAt)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="badge badge-author">
                          <User size={12} /> {m.checkin?.author || m.checkinBy || 'Sistema'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={checkinModal.isOpen}
        title="Confirmar Check-in"
        message="Deseja confirmar a chegada deste acessório e finalizar este registro de saída?"
        type="success"
        confirmText="Finalizar Check-in"
        onConfirm={handleCheckin}
        onCancel={() => setCheckinModal({ isOpen: false, movementId: null })}
      />
    </div>
  )
}
