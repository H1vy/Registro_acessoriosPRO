import React, { useState } from 'react'
import { ClipboardCheck, CheckCircle2, User, PackageSearch } from 'lucide-react'

export default function PartSales({ movements, setMovements, accessories, responsibles, currentUser }) {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10;
  
  // Filtragem por data
  const filteredByDate = movements.filter(m => {
    if (!filterDate) return true;
    const mDate = new Date(m.timestamp).toISOString().split('T')[0];
    const cDate = m.checkin ? new Date(m.checkin.timestamp).toISOString().split('T')[0] : null;
    
    // Para pendentes, filtramos pela data da saída
    // Para realizados, filtramos pela data do check-in (conforme lógica de "reset diário")
    return mDate === filterDate || cDate === filterDate;
  });

  // Apenas registros de saída que não foram anulados/retornados
  const activeMovements = filteredByDate.filter(m => !m.annulled && !m.checkin);
  const checkedInMovements = filteredByDate.filter(m => m.checkin && !m.annulled);

  // Paginação para check-ins realizados
  const totalPages = Math.ceil(checkedInMovements.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCheckedIn = checkedInMovements.slice(indexOfFirstItem, indexOfLastItem);

  const handleCheckin = (id) => {
    const updatedMovements = movements.map(m => 
      m.id === id ? { 
        ...m, 
        checkin: {
          timestamp: new Date().toISOString(),
          author: currentUser?.username || 'Sistema'
        }
      } : m
    )
    setMovements(updatedMovements)
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

      <div className="grid">
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardCheck size={20} className="accent" /> Pendentes de Check-in
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
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
                  activeMovements.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(m.timestamp)}</td>
                      <td style={{ fontWeight: 600 }}>{getAccessoryLabel(m.accessoryId)}</td>
                      <td>{getResponsibleName(m.responsibleId)}</td>
                      <td><code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px' }}>{m.soNumber || '-'}</code></td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn-primary" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                          onClick={() => handleCheckin(m.id)}
                        >
                          <CheckCircle2 size={16} /> Check-in
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
          <div style={{ overflowX: 'auto' }}>
            <table>
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
                  currentCheckedIn.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{getAccessoryLabel(m.accessoryId)}</td>
                      <td style={{ fontSize: '0.85rem' }}>{formatDate(m.checkin.timestamp)}</td>
                      <td>
                        <div className="badge-author" style={{ fontSize: '0.75rem' }}>
                          <User size={12} /> {m.checkin.author}
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
    </div>
  )
}
