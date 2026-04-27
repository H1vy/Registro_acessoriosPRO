import React, { useState } from 'react'
import { Package, ArrowUpRight, ArrowDownLeft, Calendar, User, Search, Filter, FileDown, Eye, ChevronDown, ChevronUp, History, ClipboardCheck, Trash2, XCircle, AlertCircle, AlertTriangle, PackageSearch, CheckCircle2, RotateCcw, X, Info, Clock, EyeOff } from 'lucide-react'
import CustomSelect from './CustomSelect'
import ConfirmModal from './ConfirmModal'

export default function Movements({ movements, setMovements, accessories, responsibles, currentUser, showAlert }) {
  const [formData, setFormData] = useState({
    accessoryId: '',
    responsibleId: '',
    type: 'checkout',
    soNumber: '',
    quantity: 1
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
  const [removeModal, setRemoveModal] = useState({ isOpen: false, movementId: null, soNumber: null, reason: '' })
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [historyModal, setHistoryModal] = useState({ isOpen: false, movement: null })
  const [groupVisibility, setGroupVisibility] = useState({}) // Controla quais O.S. estão expandidas

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
    setFormData({ ...formData, accessoryId: '', soNumber: '', quantity: 1 })
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
      setMovements(prev => prev.map(m => {
        const isTarget = Array.isArray(movementId) ? movementId.includes(m.id) : m.id === movementId;
        return isTarget ? { 
          ...m, 
          annulled: true, 
          isReturn: true,
          returnInfo: {
            returnedBy: returnedBy.trim(),
            returnReason: returnReason.trim(),
            timestamp: new Date().toISOString(),
            author: currentUser?.username || 'Sistema'
          }
        } : m;
      }))
      setModalState({ ...modalState, isOpen: false })
    } else if (type === 'annul') {
      if (!annulReason.trim()) {
        showAlert('Justificativa Obrigatória', 'Por favor, forneça o motivo da anulação para prosseguir.', 'warning')
        return
      }
      setMovements(prev => prev.map(m => {
        const isTarget = Array.isArray(movementId) ? movementId.includes(m.id) : m.id === movementId;
        return isTarget ? { ...m, annulled: true, isReturn: false, reason: annulReason.trim() } : m;
      }))
      setModalState({ ...modalState, isOpen: false })
    }
  }

  const isAdmin = currentUser?.role === 'admin'
  const isEstoque = currentUser?.sector === 'estoque'
  const canManageMovements = isAdmin || isEstoque

  const handleActionOpen = (id, hasCheckin = false) => {
    setModalState({ 
      isOpen: true, 
      movementId: id, 
      type: null, 
      hasCheckin,
      annulReason: '',
      returnReason: '',
      returnedBy: '',
      returnedById: ''
    })
  }

  const handleRemoveClick = (id) => {
    if (!isAdmin) return
    
    const ids = Array.isArray(id) ? id : [id];
    const targets = movements.filter(m => ids.includes(m.id));
    
    if (targets.length === 0) return;

    const allRemovable = targets.every(m => m.annulled || m.checkin);
    if (!allRemovable) {
      showAlert('Ação Não Permitida', 'Apenas registros que já foram ANULADOS ou FINALIZADOS (via Check-in ou Retorno) podem ser removidos do histórico.', 'danger')
      return
    }

    setRemoveModal({
      isOpen: true,
      movementId: id,
      soNumber: null,
      reason: ''
    })
  }

  const handleRemoveGroupClick = (soNumber) => {
    if (currentUser?.role !== 'admin') return
    
    const groupItems = movements.filter(m => m.soNumber === soNumber && !m.isDeleted)
    const canRemoveAll = groupItems.every(m => m.annulled || m.checkin)
    
    if (!canRemoveAll) {
      showAlert('Ação Não Permitida', 'Para remover a O.S. inteira do histórico, todos os seus registros individuais devem estar ANULADOS ou FINALIZADOS.', 'danger')
      return
    }

    setRemoveModal({
      isOpen: true,
      movementId: null,
      soNumber: soNumber,
      reason: ''
    })
  }

  const handleConfirmRemove = async () => {
    const { movementId, soNumber, reason } = removeModal
    
    if (!reason.trim()) {
      showAlert('Campo Obrigatório', 'A justificativa é obrigatória para realizar a remoção lógica deste registro.', 'warning')
      return
    }

    setMovements(prev => prev.map(m => {
      const isTargetId = Array.isArray(movementId) ? movementId.includes(m.id) : m.id === movementId;
      if ((soNumber && m.soNumber === soNumber) || (movementId && isTargetId)) {
        return { 
          ...m, 
          isDeleted: true, 
          deletionReason: reason.trim(),
          deletionTimestamp: new Date().toISOString(),
          deletedBy: currentUser.username
        }
      }
      return m
    }))
    setRemoveModal({ isOpen: false, movementId: null, soNumber: null, reason: '' })
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
      desc: `Acessório retirado para O.S: ${m.soNumber || 'Não informada'} | Qtd: ${m.quantity || 1}`
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

  const toggleOSVisibility = (osNumber) => {
    setGroupVisibility(prev => ({ ...prev, [osNumber]: !prev[osNumber] }))
  }

  // Agrupamento de Movimentações por O.S. com Unificação de Itens
  const groupedMovements = React.useMemo(() => {
    const groups = []
    const osMap = {}

    // 1. Filtrar e Ordenar a base toda
    const sortedAndFiltered = [...movements]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter(m => {
        if (m.isDeleted) return false 
        if (!filterDate) return true
        const mDate = new Date(m.timestamp).toISOString().split('T')[0]
        return mDate === filterDate
      })

    // 2. Agrupar por O.S.
    sortedAndFiltered.forEach(m => {
      const soNumber = (m.soNumber || '').trim()
      if (soNumber && soNumber !== '-') {
        if (!osMap[soNumber]) {
          osMap[soNumber] = {
            isGroup: true,
            id: `group-${soNumber}`,
            soNumber: soNumber,
            timestamp: m.timestamp, // Guarda o mais recente
            author: m.author, // Pega o autor da primeira iteração (mais recente)
            items: []
          }
          groups.push(osMap[soNumber])
        }
        osMap[soNumber].items.push(m)
      } else {
        groups.push({
          isGroup: false,
          id: m.id,
          timestamp: m.timestamp,
          author: m.author,
          items: [m]
        })
      }
    })

    // 3. Unificar itens idênticos dentro de cada grupo para visualização
    groups.forEach(group => {
      const unified = {};
      group.items.forEach(item => {
        // Chave de unificação: Acessório + Status (Checkin, Anulado, Retorno, Vínculo)
        const key = `${item.accessoryId}-${item.isReturn ? 'R' : 'C'}-${item.annulled ? 'A' : 'V'}-${item.checkin ? 'Y' : 'N'}-${item.attachmentStatus}`;
        
        if (!unified[key]) {
          unified[key] = { ...item, originalIds: [item.id] };
        } else {
          unified[key].quantity = (unified[key].quantity || 1) + (item.quantity || 1);
          unified[key].originalIds.push(item.id);
          // Manter o timestamp mais recente para exibição
          if (new Date(item.timestamp) > new Date(unified[key].timestamp)) {
            unified[key].timestamp = item.timestamp;
          }
        }
      });
      group.unifiedItems = Object.values(unified);
    });

    return groups;
  }, [movements, filterDate]);

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
        onCancel={() => setRemoveModal({ isOpen: false, movementId: null, soNumber: null, reason: '' })}
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

            <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: 0 }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', opacity: !modalState.type ? 0.5 : 1 }}
                onClick={handleModalSubmit}
                disabled={!modalState.type}
              >
                Confirmar {modalState.type === 'return' ? 'Retorno' : modalState.type === 'annul' ? 'Anulação' : 'Ação'}
              </button>
              <button className="btn-cancel" style={{ width: '100%' }} onClick={() => setModalState({ ...modalState, isOpen: false })}>
                Cancelar
              </button>
            </div>
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

          <div className="grid-2">
            <div className="input-group">
              <label>Ordem de Serviço (Opcional)</label>
              <input 
                type="text" 
                value={formData.soNumber}
                onChange={(e) => setFormData({ ...formData, soNumber: e.target.value })}
                placeholder="Ex: OS-9988"
              />
            </div>
            <div className="input-group">
              <label>Quantidade de Itens</label>
              <input 
                type="number" 
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                placeholder="Padrão: 1"
              />
            </div>
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
              {groupedMovements.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              ) : (
                groupedMovements.map((group, index) => {
                  const groupResps = [...new Set(group.items.map(m => getResponsibleName(m.responsibleId)))];
                  const groupAuthors = [...new Set(group.items.map(m => m.author || 'Sistema'))];
                  
                  return (
                    <React.Fragment key={group.id}>
                    {/* Linha Mestre da Movimentação / O.S. */}
                    <tr 
                      className={`row-animate ${
                        group.items.every(m => m.annulled && !m.isReturn) ? 'row-annulled' : 
                        group.items.every(m => m.isReturn) ? 'row-returned' : 
                        group.items.every(m => m.checkin) ? 'row-finalized' : ''
                      }`}
                      style={{ 
                        animationDelay: `${index * 40}ms`, 
                        background: group.isGroup ? 'rgba(56, 189, 248, 0.03)' : undefined,
                        borderLeft: group.isGroup ? '3px solid var(--accent)' : undefined
                      }}
                    >
                      <td style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(group.timestamp)}</td>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ color: group.unifiedItems.length > 1 ? 'var(--accent)' : 'inherit' }}>
                            {group.unifiedItems.length === 1 
                              ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>[{group.unifiedItems[0].quantity || 1}x]</strong>
                                  {getAccessoryLabel(group.unifiedItems[0].accessoryId)}
                                  {/* Alerta de Divergência de Quantidade */}
                                  {group.unifiedItems[0].attachmentStatus === 'mismatch' && (
                                    <AlertTriangle size={16} style={{ color: '#fbbf24' }} title="Quantidade no anexo diverge do registro" />
                                  )}
                                </span>
                              )
                              : `${group.unifiedItems.length} Itens (Unificados)`
                            }
                          </span>
                          {group.unifiedItems.length === 1 && (group.unifiedItems[0].checkin || group.unifiedItems[0].annulled || group.unifiedItems[0].isReturn) && (
                            <button 
                              className="btn-history-trigger-v2" 
                              title="Ver Timeline Completa"
                              onClick={() => setHistoryModal({ isOpen: true, movement: group.unifiedItems[0] })}
                            >
                              <Clock size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {groupResps.length > 1 
                          ? <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Vários Responsáveis</span>
                          : groupResps[0]
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {group.items.length > 1 && (
                            <button 
                              onClick={() => toggleOSVisibility(group.id)} 
                              title="Ocultar/Exibir Detalhes" 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                            >
                              { (groupVisibility[group.id] !== undefined ? groupVisibility[group.id] : false) ? <EyeOff size={14}/> : <Eye size={14}/> }
                            </button>
                          )}
                          {group.soNumber && group.soNumber !== '-' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <code className={`
                                ${group.items.every(m => m.checkin) ? 'os-code-linked' : 'os-code-standard'} 
                                ${group.items.some(m => m.attachmentStatus !== 'ok') ? 'os-code-pulse' : ''}
                              `}>
                                {group.soNumber}
                              </code>
                              {group.items.every(m => m.attachmentStatus === 'ok') && (
                                <ClipboardCheck size={14} style={{ color: '#10b981' }} title="Anexo Vinculado" />
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Avulso</span>
                              {group.items.every(m => m.attachmentStatus === 'ok') && (
                                <ClipboardCheck size={14} style={{ color: '#10b981' }} title="Anexo Vinculado" />
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="badge badge-author">
                          <User size={12} /> {groupAuthors.length > 1 ? 'Múltiplos' : groupAuthors[0]}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {group.isGroup && group.items.length > 1 ? 'Agrupamento O.S.' : 'Saída Individual'}
                          </span>
                          {group.items.every(item => item.checkin) && !group.items[0].annulled && (
                            <span className="status-checkin-tag">
                              <CheckCircle2 size={12} /> Check-in
                            </span>
                          )}
                          {group.isGroup && group.items.length > 1 && group.items.some(item => item.checkin) && !group.items.every(item => item.checkin) && (
                            <span className="status-checkin-tag" style={{ opacity: 0.7, background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
                              {group.items.filter(item => item.checkin).length}/{group.items.length} Check-ins
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', alignItems: 'center' }}>
                            <button 
                              onClick={() => {
                                // Se for um registro individual ou um grupo unificado em uma única linha
                                if (!group.isGroup || group.unifiedItems.length === 1) {
                                  const m = group.unifiedItems[0];
                                  const hasCheckin = movements.some(mov => mov.type === 'checkin' && m.originalIds.includes(mov.originalCheckoutId) && !mov.annulled);
                                  handleActionOpen(m.originalIds, hasCheckin);
                                } else {
                                  showAlert('Ação em Bloco', 'Para anular ou registrar retorno de uma O.S. completa com múltiplos acessórios, expanda os detalhes e realize a ação por item.', 'info');
                                }
                              }}
                              className="btn-icon" 
                              title="Ação (Retorno ou Anulação)"
                            >
                              <XCircle size={18} />
                            </button>
                          {isAdmin && (
                            <button 
                              onClick={() => {
                                if (group.isGroup && group.unifiedItems.length > 1) {
                                  handleRemoveGroupClick(group.soNumber);
                                } else {
                                  handleRemoveClick(group.unifiedItems[0].originalIds);
                                }
                              }} 
                              className="btn-icon-danger"
                              title={(group.isGroup && group.unifiedItems.length > 1) ? "Remover O.S. Completa do Histórico" : "Remover Registro(s)"}
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Sub-linhas detalhadas (exibe itens unificados para maior clareza) */}
                    {group.unifiedItems.length > 0 && group.unifiedItems.map((m, i) => {
                      const isExpanded = (groupVisibility[group.id] !== undefined ? groupVisibility[group.id] : false);
                      if (!isExpanded) return null;

                      return (
                        <tr 
                          key={m.id} 
                          className={`row-animate ${m.annulled && !m.isReturn ? 'row-annulled' : ''} ${m.isReturn ? 'row-returned' : ''} ${(m.checkin || m.attachmentStatus === 'ok') ? 'row-finalized' : ''}`}
                          style={{ 
                            animationDelay: `${(index * 50) + (i * 20)}ms`,
                            background: 'rgba(255,255,255,0.01)',
                            borderBottom: i === group.unifiedItems.length - 1 ? '2px solid var(--border)' : '1px dotted var(--border)'
                          }}
                        >
                          <td style={{ paddingLeft: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '12px', height: '12px', borderLeft: '2px solid var(--border)', borderBottom: '2px solid var(--border)', borderRadius: '0 0 0 4px', marginTop: '-12px' }} />
                              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatDate(m.timestamp)}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            <div className="movement-accessory-cell">
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>[{m.quantity || 1}x]</strong>
                                {getAccessoryLabel(m.accessoryId)}
                                {m.attachmentStatus === 'mismatch' && (
                                  <AlertTriangle size={14} style={{ color: '#fbbf24' }} title="Quantidade no anexo diverge do registro" />
                                )}
                              </span>
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
                           <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                             {groupResps.length > 1 ? getResponsibleName(m.responsibleId) : <span style={{ opacity: 0.15 }}>-</span>}
                           </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <code className={`
                                ${m.checkin ? 'os-code-linked' : 'os-code-standard'} 
                                ${(m.attachmentStatus !== 'ok' && m.soNumber && m.soNumber !== '-' && m.soNumber !== 'S/N') ? 'os-code-pulse' : ''}
                              `}>
                                {m.soNumber && m.soNumber !== '-' ? m.soNumber : 'Avulso'}
                              </code>
                              {m.attachmentStatus === 'ok' && <ClipboardCheck size={14} style={{ color: '#10b981' }} title="Anexo Vinculado" />}
                            </div>
                          </td>
                           <td>
                             <div className="badge badge-author" style={{ opacity: groupAuthors.length > 1 ? 1 : 0.4 }}>
                               <User size={12} /> {groupAuthors.length > 1 ? (m.author || 'Sistema') : '-'}
                             </div>
                           </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {m.isReturn ? (
                                <span className="badge badge-return">RETORNO</span>
                              ) : (
                                <span className="badge badge-checkout">SAÍDA</span>
                              )}
                              {m.checkin && !m.annulled && (
                                <span className="status-checkin-tag">
                                  <CheckCircle2 size={12} /> Check-in
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', alignItems: 'center' }}>
                              {canManageMovements && !m.annulled ? (
                                <button 
                                  onClick={() => {
                                    const hasCheckin = movements.some(mov => mov.type === 'checkin' && m.originalIds.includes(mov.originalCheckoutId) && !mov.annulled);
                                    handleActionOpen(m.originalIds, hasCheckin);
                                  }} 
                                  className="btn-icon-danger"
                                  title="Anular ou Registrar Retorno"
                                >
                                  <XCircle size={18} />
                                </button>
                              ) : (
                                m.annulled && <span className="status-annulled-tag">{m.isReturn ? 'FINALIZADO' : 'ANULADO'}</span>
                              )}

                              {currentUser?.role === 'admin' && (
                                <button 
                                  onClick={() => handleRemoveClick(m.originalIds)} 
                                  className="btn-icon-danger"
                                  title="Remover Registro Unificado"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                    )
                })
              )}
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
