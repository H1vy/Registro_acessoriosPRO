import React, { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft, ClipboardCheck, Trash2, User, XCircle, RotateCcw, X, Info, History, Clock } from 'lucide-react'
import CustomSelect from './CustomSelect'
import ConfirmModal from './ConfirmModal'

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
    returnedById: '',
    returnReason: '',
    annulReason: '',
    hasCheckin: false
  })
  const [removeModal, setRemoveModal] = useState({ isOpen: false, movementId: null, reason: '' })
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [historyModal, setHistoryModal] = useState({ isOpen: false, movement: null })

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
      checkin: null,
      attachmentStatus: 'pending' // Novo status inicial para conciliação
    }

    setMovements(prev => [newMovement, ...prev])
    setFormData({ ...formData, accessoryId: '', soNumber: '' })
  }
  const handleAnnulleOpen = (id) => {
    const movement = movements.find(m => m.id === id)
    setModalState({ 
      isOpen: true, 
      movementId: id, 
      type: null, 
      returnedBy: '', 
      returnedById: '',
      returnReason: '', 
      annulReason: '',
      hasCheckin: !!movement.checkin
    })
  }

  const handleModalSubmit = async () => {
    const { movementId, type, returnedBy, returnReason, annulReason, hasCheckin } = modalState
    
    if (type === 'return' && hasCheckin) {
      showAlert('Ação Negada', 'Este item já possui check-in realizado e não pode ser retornado.', 'danger');
      return;
    }
    if (type === 'return') {
      if (!returnedBy.trim() || !returnReason.trim()) {
        showAlert('Campos Obrigatórios', 'Por favor, preencha quem está devolvendo e o motivo do retorno.', 'warning')
        return
      }
      setMovements(prev => prev.map(m => 
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
      ))
      setModalState({ ...modalState, isOpen: false })
    } else if (type === 'annul') {
      if (!annulReason.trim()) {
        showAlert('Justificativa Obrigatória', 'Por favor, forneça o motivo da anulação para prosseguir.', 'warning')
        return
      }
      setMovements(prev => prev.map(m => 
        m.id === movementId ? { ...m, annulled: true, isReturn: false, reason: annulReason.trim() } : m
      ))
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

    setMovements(prev => prev.map(m => 
      m.id === movementId ? { 
        ...m, 
        isDeleted: true, 
        deletionReason: reason.trim(),
        deletionTimestamp: new Date().toISOString(),
        deletedBy: currentUser.username
      } : m
    ))
    setRemoveModal({ isOpen: false, movementId: null, reason: '' })
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

  // Função para compilar a timeline da movimentação em ordem decrescente
  const getMovementLog = (m) => {
    const log = []

    // 1. Saída original
    log.push({
      type: 'saida',
      label: 'Saída Registrada',
      at: m.timestamp,
      by: m.author,
      desc: `Acessório retirado para O.S: ${m.soNumber || 'Não informada'}`
    })

    // 2. Registro de Retorno
    if (m.isReturn && m.returnInfo) {
      log.push({
        type: 'retorno',
        label: 'Retorno ao Estoque',
        at: m.returnInfo.timestamp,
        by: m.returnInfo.author,
        desc: `Devolvido por: ${m.returnInfo.returnedBy}. Motivo: ${m.returnInfo.returnReason}`
      })
    }

    // 3. Anulação (se não for retorno)
    if (m.annulled && !m.isReturn) {
      log.push({
        type: 'anulacao',
        label: 'Registro Anulado',
        at: m.timestamp, // m.timestamp é usado aqui ou deveríamos ter m.annulledAt? Vou usar o timestamp do registro por enquanto ou assumir agora
        by: m.author,
        desc: `Motivo: ${m.reason}`
      })
    }

    // 4. Check-in
    if (m.checkin) {
      log.push({
        type: 'checkin',
        label: 'Check-in Realizado',
        at: m.checkin.timestamp,
        by: m.checkin.author,
        desc: 'Produto validado pelo setor responsável.'
      })
    }

    // 5. Registro de Anexo (Conciliação)
    if (m.attachmentStatus === 'ok' && m.attachedAt) {
      log.push({
        type: 'checkin', // Reaproveitando estilo de checkin (verde/ok)
        label: 'Anexo Vinculado',
        at: m.attachedAt,
        by: m.attachedBy || 'Sistema',
        desc: `Documento de comprovante validado e vinculado à O.S: ${m.soNumber || 'S/N'}`
      })
    }

    // Ordenar: mais recente primeiro
    return log.sort((a, b) => new Date(b.at) - new Date(a.at))
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
              {modalState.hasCheckin && (
                <div className="checkin-warning-alert">
                  <Info size={14} />
                  <span>Este registro já possui <strong>Check-in</strong>. O retorno foi bloqueado; utilize a Anulação se houver erro.</span>
                </div>
              )}
            </div>
            
            <div className="action-buttons-grid">
              <button 
                className={`action-card-btn ${modalState.type === 'return' ? 'active is-success' : ''} ${modalState.hasCheckin ? 'disabled' : ''}`}
                onClick={() => !modalState.hasCheckin && setModalState({ ...modalState, type: 'return' })}
                type="button"
                disabled={modalState.hasCheckin}
              >
                <div style={{ background: modalState.type === 'return' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '50%', color: modalState.type === 'return' ? '#10b981' : (modalState.hasCheckin ? '#4a5568' : '#94a3b8'), opacity: modalState.hasCheckin ? 0.3 : 1 }}>
                  <RotateCcw size={28} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '1.05rem', marginBottom: '2px', opacity: modalState.hasCheckin ? 0.5 : 1 }}>Retorno</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', opacity: 0.8 }}>
                    {modalState.hasCheckin ? 'Bloqueado pós Check-in' : 'Produto voltando ao estoque'}
                  </span>
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
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                  <CustomSelect 
                    label="Quem está devolvendo?"
                    value={modalState.returnedById || ''}
                    onChange={(e) => {
                      const rName = responsibles.find(r => r.id === e.target.value)?.name || ''
                      setModalState({ ...modalState, returnedById: e.target.value, returnedBy: rName })
                    }}
                    options={responsibles.map(resp => ({
                      value: resp.id,
                      label: resp.name
                    }))}
                    placeholder="Selecione o responsável..."
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
              {[...movements]
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
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
                    <div className="movement-accessory-cell">
                      <span>{getAccessoryLabel(m.accessoryId)}</span>
                      {(m.checkin || m.annulled || m.isReturn) && (
                        <button 
                          className="btn-history-trigger-v2" 
                          title="Ver Timeline Completa"
                          onClick={() => setHistoryModal({ isOpen: true, movement: m })}
                        >
                          <Clock size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{getResponsibleName(m.responsibleId)}</td>
                  <td>
                    <code className={`
                      ${m.attachmentStatus === 'ok' ? 'os-code-linked' : 'os-code-standard'} 
                      ${(m.attachmentStatus !== 'ok' && m.soNumber && m.soNumber !== '-') ? 'os-code-pulse' : ''}
                    `}>
                      {m.soNumber || '-'}
                    </code>
                  </td>
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

      {/* Modal de Timeline de Movimentação */}
      {historyModal.isOpen && historyModal.movement && (
        <div className="modal-backdrop">
          <div className="modal-card timeline-modal glass-effect">
            <button className="modal-close-btn" onClick={() => setHistoryModal({ isOpen: false, movement: null })}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <div className="header-icon-title">
                <History className="accent" size={24} />
                <h3>Linha do Tempo</h3>
              </div>
              <p className="subtitle">Histórico completo: <strong>{getAccessoryLabel(historyModal.movement.accessoryId)}</strong></p>
            </div>
            
            <div className="modal-timeline-container">
              {getMovementLog(historyModal.movement).map((entry, eIdx) => (
                <div key={eIdx} className={`log-entry ${entry.type} large`}>
                  <div className="entry-header">
                    <span className="label">{entry.label}</span>
                    <span className="date">{formatDate(entry.at)}</span>
                  </div>
                  <p className="desc">{entry.desc}</p>
                  <div className="entry-footer">
                    <span className="author-badge">
                      <User size={12} />
                      {entry.by}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="btn-primary" 
              style={{ width: '100%', marginTop: '1.5rem' }}
              onClick={() => setHistoryModal({ isOpen: false, movement: null })}
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
