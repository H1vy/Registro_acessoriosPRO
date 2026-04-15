import React, { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft, ClipboardCheck, Trash2, User, XCircle, RotateCcw, X, Info } from 'lucide-react'
import CustomSelect from './CustomSelect'
import ConfirmModal from './ConfirmModal'
import { saveData } from '../utils/db'

export default function Movements({ movements, setMovements, accessories, responsibles, currentUser, showAlert }) {
  const [formData, setFormData] = useState({
    accessoryId: '',
    responsibleId: '',
    type: 'checkout',
    soNumber: ''
  })
  const [modalState, setModalState] = useState({
    isOpen: false,
    movementId: null,
    type: null,
    returnedBy: '',
    returnReason: '',
    annulReason: ''
  })
  const [removeModal, setRemoveModal] = useState({ isOpen: false, movementId: null, reason: '' })
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.accessoryId || !formData.responsibleId) {
      showAlert('Campos Obrigatórios', 'Por favor, selecione tanto o acessório quanto o responsável pela saída.', 'warning')
      return
    }

    const newMovement = {
      ...formData,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      author: currentUser?.username || 'Sistema',
      annulled: false,
      checkin: null // Para a futura aba Pate sales
    }

    setMovements([newMovement, ...movements])
    setFormData({ ...formData, accessoryId: '', soNumber: '' })
  }

  const handleAnnulleOpen = (id) => {
    setModalState({ 
      isOpen: true, 
      movementId: id, 
      type: null, 
      returnedBy: '', 
      returnReason: '', 
      annulReason: '' 
    })
  }

  const handleModalSubmit = async () => {
    const { movementId, type, returnedBy, returnReason, annulReason } = modalState
    
    if (type === 'return') {
      if (!returnedBy.trim() || !returnReason.trim()) {
        showAlert('Campos Obrigatórios', 'Por favor, preencha quem está devolvendo e o motivo do retorno.', 'warning')
        return
      }
      const updatedMovements = movements.map(m => 
        m.id === movementId ? { 
          ...m, 
          annulled: true, 
          isReturn: true,
          returnInfo: {
            returnedBy: returnedBy.trim(),
            returnReason: returnReason.trim(),
            timestamp: new Date().toISOString(),
            author: currentUser?.username || 'Sistema'
          }
        } : m
      )
      // Persiste no Firebase para que o onValue do App.jsx coordene a atualização
      await saveData('movements', updatedMovements)
      setModalState({ ...modalState, isOpen: false })
    } else if (type === 'annul') {
      if (!annulReason.trim()) {
        showAlert('Justificativa Obrigatória', 'Por favor, forneça o motivo da anulação para prosseguir.', 'warning')
        return
      }
      const updatedMovements = movements.map(m => 
        m.id === movementId ? { ...m, annulled: true, isReturn: false, reason: annulReason.trim() } : m
      )
      // Persiste no Firebase para que o onValue do App.jsx coordene a atualização
      await saveData('movements', updatedMovements)
      setModalState({ ...modalState, isOpen: false })
    }
  }

  const handleRemoveClick = (id) => {
    if (currentUser?.role !== 'admin') return
    
    const movement = movements.find(m => m.id === id)
    if (!movement.annulled && !movement.checkin) {
      showAlert('Ação Não Permitida', 'Apenas registros que já foram ANULADOS ou FINALIZADOS (via Check-in ou Retorno) podem ser removidos do histórico.', 'danger')
      return
    }

    setRemoveModal({
      isOpen: true,
      movementId: id,
      reason: ''
    })
  }

  const handleConfirmRemove = async () => {
    const { movementId, reason } = removeModal
    
    if (!reason.trim()) {
      showAlert('Campo Obrigatório', 'A justificativa é obrigatória para realizar a remoção lógica deste registro.', 'warning')
      return
    }

    const updatedMovements = movements.map(m => 
      m.id === movementId ? { 
        ...m, 
        isDeleted: true, 
        deletionReason: reason.trim(),
        deletionTimestamp: new Date().toISOString(),
        deletedBy: currentUser.username
      } : m
    )
    // Persiste no Firebase — o onValue no App.jsx vai atualizar o estado global automaticamente
    try {
      await saveData('movements', updatedMovements)
      setRemoveModal({ isOpen: false, movementId: null, reason: '' })
    } catch (err) {
      console.error('Erro ao remover registro:', err)
      showAlert('Erro', 'Não foi possível remover o registro. Tente novamente.', 'danger')
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
    if (!isoStr) return '-'
    const date = new Date(isoStr)
    return date.toLocaleString('pt-BR')
  }

  return (
    <div className="tab-content relative">
      <ConfirmModal 
        isOpen={removeModal.isOpen}
        title="Remover Registro"
        message="JUSTIFIQUE O MOTIVO DA REMOÇÃO: (Este registro será ocultado daqui, mas permanecerá no banco de dados e relatório Excel por segurança)"
        type="danger"
        confirmText="Remover"
        showInput={true}
        inputValue={removeModal.reason}
        onInputChange={(val) => setRemoveModal({ ...removeModal, reason: val })}
        inputPlaceholder="Ex: Registro duplicado, erro no sistema..."
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveModal({ isOpen: false, movementId: null, reason: '' })}
      />
      {/* Modal Sobreposto */}
      {modalState.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <button className="modal-close-btn" onClick={() => setModalState({ ...modalState, isOpen: false })}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <h3>Ação no Registro</h3>
              <p>O que você deseja fazer com este registro de saída?</p>
            </div>
            
            <div className="action-buttons-grid">
              <button 
                className={`action-card-btn ${modalState.type === 'return' ? 'active is-success' : ''}`}
                onClick={() => setModalState({ ...modalState, type: 'return' })}
                type="button"
              >
                <div style={{ background: modalState.type === 'return' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '50%', color: modalState.type === 'return' ? '#10b981' : '#94a3b8' }}>
                  <RotateCcw size={28} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>Retorno</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', opacity: 0.8 }}>Produto voltando ao estoque</span>
                </div>
              </button>

              <button 
                className={`action-card-btn ${modalState.type === 'annul' ? 'active is-danger' : ''}`}
                onClick={() => setModalState({ ...modalState, type: 'annul' })}
                type="button"
              >
                <div style={{ background: modalState.type === 'annul' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '50%', color: modalState.type === 'annul' ? '#ef4444' : '#94a3b8' }}>
                  <XCircle size={28} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px' }}>Anulação</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', opacity: 0.8 }}>Cancelar registro incorreto</span>
                </div>
              </button>
            </div>

            {modalState.type === 'return' && (
              <div className="modal-form-area" style={{ animation: 'fadeIn 0.3s' }}>
                <div className="input-group">
                  <label>Quem está devolvendo?</label>
                  <input 
                    type="text" 
                    placeholder="Nome do cliente/funcionário" 
                    value={modalState.returnedBy}
                    onChange={(e) => setModalState({ ...modalState, returnedBy: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label>Motivo do Retorno</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Produto com defeito, Cancelamento..." 
                    value={modalState.returnReason}
                    onChange={(e) => setModalState({ ...modalState, returnReason: e.target.value })}
                  />
                </div>
              </div>
            )}

            {modalState.type === 'annul' && (
              <div className="modal-form-area" style={{ animation: 'fadeIn 0.3s' }}>
                <div className="input-group">
                  <label>Justificativa da Anulação</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Lançado errado, equipamento duplicado..." 
                    value={modalState.annulReason}
                    onChange={(e) => setModalState({ ...modalState, annulReason: e.target.value })}
                    autoFocus
                  />
                </div>
              </div>
            )}

            <button 
              className="btn-primary" 
              style={{ width: '100%', marginTop: '1rem', opacity: !modalState.type ? 0.5 : 1 }}
              onClick={handleModalSubmit}
              disabled={!modalState.type}
            >
              Confirmar {modalState.type === 'return' ? 'Retorno' : modalState.type === 'annul' ? 'Anulação' : 'Ação'}
            </button>
          </div>
        </div>
      )}

      <div className="form-card card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <ClipboardCheck className="accent" /> Registrar Saída de Acessório
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
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
                label="Responsável pela Saída"
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
            Confirmar Saída
          </button>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, opacity: 0.8 }}>Histórico de Movimentações</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Filtrar por Data:</label>
            <input 
              type="date" 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
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
              }}
            >
              {!filterDate ? 'Ver Hoje' : 'Ver Tudo'}
            </button>
          </div>
        </div>
        <div className="table-container">
          <table className="responsive-table movement-table">
            <thead>
              <tr>
                <th>Data / Hora Saída</th>
                <th>Acessório</th>
                <th>Responsável</th>
                <th>O.S.</th>
                <th>Autor</th>
                <th>Status / Retorno</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {movements
                .filter(m => {
                  if (m.isDeleted) return false 
                  if (!filterDate) return true
                  const mDate = new Date(m.timestamp).toISOString().split('T')[0]
                  return mDate === filterDate
                })
                .map((m, index) => (
                <tr 
                  key={m.id} 
                  className={`row-animate ${m.annulled ? 'row-annulled' : ''} ${m.checkin ? 'row-checked-in' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(m.timestamp)}</td>
                  <td style={{ fontWeight: 500 }}>
                    <div style={{ color: 'var(--text-primary)' }}>{getAccessoryLabel(m.accessoryId)}</div>
                    {m.annulled && !m.isReturn && (
                      <div className="record-detail-block annulment-reason">
                         <strong>Motivo Anulação:</strong> {m.reason}
                      </div>
                    )}
                    {m.isReturn && (
                      <div className="record-detail-block return-details">
                         <strong>Retornado por:</strong> {m.returnInfo?.returnedBy} <br/>
                         <strong>Motivo:</strong> {m.returnInfo?.returnReason || 'Não especificado'} <br/>
                         <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                           Recebido em {formatDate(m.returnInfo?.timestamp)} por {m.returnInfo?.author}
                         </span>
                      </div>
                    )}
                    {m.checkin && (
                      <div className="record-detail-block checkin-details">
                         <strong>Check-in realizado:</strong> <br/>
                         <span style={{ opacity: 0.8 }}>{formatDate(m.checkin.timestamp)} por {m.checkin.author}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{getResponsibleName(m.responsibleId)}</td>
                  <td><code style={{ background: 'var(--bg-input)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid var(--border)' }}>{m.soNumber || '-'}</code></td>
                  <td>
                    <div className="badge badge-author">
                      <User size={12} /> {m.author || 'Sistema'}
                    </div>
                  </td>
                  <td>
                    {m.isReturn ? (
                      <span className="badge badge-return">RETORNO</span>
                    ) : (
                      <span className="badge badge-checkout">SAÍDA</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', alignItems: 'center' }}>
                      {!m.annulled ? (
                        <button 
                          onClick={() => handleAnnulleOpen(m.id)} 
                          className="btn-icon-danger"
                          title="Anular ou Registrar Retorno"
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : (
                        <span className="status-annulled-tag">{m.isReturn ? 'FINALIZADO' : 'ANULADO'}</span>
                      )}

                      {currentUser?.role === 'admin' && (
                        <button 
                          onClick={() => handleRemoveClick(m.id)} 
                          className="btn-icon-danger"
                          title="Remover Registro do Histórico"
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', alignItems: 'center' }}
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
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
