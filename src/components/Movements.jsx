import React, { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft, ClipboardCheck, Trash2 } from 'lucide-react'
import CustomSelect from './CustomSelect'

export default function Movements({ movements, setMovements, accessories, responsibles }) {
  const [formData, setFormData] = useState({
    accessoryId: '',
    responsibleId: '',
    type: 'checkout',
    soNumber: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.accessoryId || !formData.responsibleId) {
      alert('Selecione o acessório e o responsável')
      return
    }

    const newMovement = {
      ...formData,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    }

    setMovements([newMovement, ...movements])
    setFormData({ ...formData, accessoryId: '', soNumber: '' })
  }

  const handleDelete = (id) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      const filteredMovements = movements.filter(m => m.id !== id)
      setMovements(filteredMovements)
    }
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
    const date = new Date(isoStr)
    return date.toLocaleString('pt-BR')
  }

  return (
    <div className="tab-content">
      <div className="form-card card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <ClipboardCheck className="accent" /> Registrar Movimentação
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Tipo de Operação</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button"
                className={`nav-btn ${formData.type === 'checkout' ? 'active checkout' : ''}`}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => setFormData({ ...formData, type: 'checkout' })}
              >
                <ArrowUpRight size={18} /> Saída
              </button>
              <button 
                type="button"
                className={`nav-btn ${formData.type === 'return' ? 'active return' : ''}`}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => setFormData({ ...formData, type: 'return' })}
              >
                <ArrowDownLeft size={18} /> Retorno
              </button>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="input-group">
              <CustomSelect 
                label="Acessório"
                value={formData.accessoryId}
                onChange={(e) => setFormData({ ...formData, accessoryId: e.target.value })}
                options={accessories.map(acc => ({
                  value: acc.id,
                  label: `${acc.factoryCode} - ${acc.commercialName}`
                }))}
                placeholder="Selecione..."
              />
            </div>
            <div className="input-group">
              <CustomSelect 
                label="Responsável"
                value={formData.responsibleId}
                onChange={(e) => setFormData({ ...formData, responsibleId: e.target.value })}
                options={responsibles.map(resp => ({
                  value: resp.id,
                  label: resp.name
                }))}
                placeholder="Selecione..."
              />
            </div>
          </div>

          <div className="input-group">
            <label>Ordem de Serviço (Opcional)</label>
            <input 
              type="text" 
              value={formData.soNumber}
              onChange={(e) => setFormData({ ...formData, soNumber: e.target.value })}
              placeholder="Ex: OS-9988"
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Confirmar Registro
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1.5rem', opacity: 0.8 }}>Histórico de Movimentações</h3>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Tipo</th>
                <th>Acessório</th>
                <th>Responsável</th>
                <th>O.S.</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(m.timestamp)}</td>
                  <td>
                    <span className={`badge badge-${m.type}`}>
                      {m.type === 'checkout' ? 'Saída' : 'Retorno'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{getAccessoryLabel(m.accessoryId)}</td>
                  <td>{getResponsibleName(m.responsibleId)}</td>
                  <td><code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{m.soNumber || '-'}</code></td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(m.id)} 
                      className="btn-icon-danger"
                      title="Excluir Registro"
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', transition: 'transform 0.2s' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
