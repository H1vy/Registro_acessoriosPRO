import React from 'react'
import { ClipboardCheck, CheckCircle2, User, PackageSearch } from 'lucide-react'

export default function PartSales({ movements, setMovements, accessories, responsibles, currentUser }) {
  
  // Apenas registros de saída que não foram anulados/retornados
  const activeMovements = movements.filter(m => !m.annulled && !m.checkin);
  const checkedInMovements = movements.filter(m => m.checkin && !m.annulled);

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
      <div className="action-bar" style={{ marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <PackageSearch className="accent" size={28} /> Part Sales - Check-in de Produtos
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Gerencie o check-in dos acessórios que foram retirados (Saída). Registros anulados não aparecem nesta lista.
        </p>
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
                      Nenhum produto pendente de check-in.
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
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8 }}>
            <CheckCircle2 size={20} style={{ color: 'var(--success)' }} /> Check-ins Realizados
          </h3>
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
                      Nenhum check-in realizado ainda.
                    </td>
                  </tr>
                ) : (
                  checkedInMovements.map(m => (
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
