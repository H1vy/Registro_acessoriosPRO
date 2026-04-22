import React, { useState } from 'react'
import {
  Package, Plus, Clock, UserCheck,
  Trash2, XCircle, Info, Search, AlertOctagon
} from 'lucide-react'
import CustomSelect from './CustomSelect'
import ConfirmModal from './ConfirmModal'

export default function Orders({ orders, setOrders, accessories, responsibles, movements, setMovements, currentUser, showAlert }) {
  const [formData, setFormData] = useState({ osNumber: '', clientName: '', accessoryId: '' })
  const [modalState, setModalState] = useState({
    isOpen: false, orderId: null, action: null,
    withdrawnById: '',   // ID do responsável selecionado na retirada
    annulledReason: '', removeReason: ''
  })
  const [pendingOrder, setPendingOrder] = useState(null)   // pedido aguardando confirmação
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedOrders, setExpandedOrders] = useState({})

  const toggleDetails = (id) => {
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Permissões por setor ───────────────────────────────────────────────────
  const canAdvanceStatus = currentUser?.role === 'admin' || currentUser?.sector === 'estoque'
  const canRequestOrder = currentUser?.role === 'admin' || currentUser?.sector === 'atendimento'
  const isAdmin = currentUser?.role === 'admin'

  // ── Cálculo de previsão de chegada (15 dias úteis) ────────────────────────
  const calculateEstimatedArrival = () => {
    const today = new Date()
    let businessDays = 0
    let arrivalDate = new Date(today)
    while (businessDays < 15) {
      arrivalDate.setDate(arrivalDate.getDate() + 1)
      const day = arrivalDate.getDay()
      if (day !== 0 && day !== 6) businessDays++
    }
    return arrivalDate.toISOString()
  }

  // ── Submissão do formulário — abre pré-confirmação ────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.osNumber.trim() || !formData.clientName.trim() || !formData.accessoryId) {
      showAlert('Campos Obrigatórios', 'Por favor, preencha O.S., cliente e acessório.', 'warning')
      return
    }
    if (formData.clientName.trim().length < 3) {
      showAlert('Campo Inválido', 'O nome do cliente deve ter ao menos 3 caracteres.', 'warning')
      return
    }
    const osExists = orders.some(
      o => o.osNumber === formData.osNumber.trim() && !o.annulled && !o.removed && o.status !== 4
    )
    if (osExists) {
      showAlert('O.S. Duplicada', 'Esta Ordem de Serviço já está vinculada a um pedido ativo.', 'warning')
      return
    }

    const accessoryName = accessories.find(a => a.id === formData.accessoryId)?.commercialName || 'Desconhecido'

    // Armazena o pedido pendente e abre modal de confirmação
    setPendingOrder({
      id: Date.now().toString(),
      osNumber: formData.osNumber.trim(),
      clientName: formData.clientName.trim(),
      accessoryId: formData.accessoryId,
      accessoryName,
      status: 1,
      requestedBy: currentUser?.username || 'Sistema',
      requestedAt: new Date().toISOString(),
      annulled: false,
      removed: false
    })
  }

  // ── Confirmar criação efetiva do pedido ───────────────────────────────────
  const handleConfirmOrder = () => {
    if (!pendingOrder) return
    setOrders(prev => [pendingOrder, ...prev])
    setFormData({ osNumber: '', clientName: '', accessoryId: '' })
    setPendingOrder(null)
    showAlert('Sucesso', 'Pedido solicitado! O Estoque irá avançar o status conforme andamento.', 'success')
  }

  const handleCancelOrder = () => setPendingOrder(null)

  // ── Abrir modal de ação ────────────────────────────────────────────────────
  const handleActionOpen = (id, action) => {
    const order = orders.find(o => o.id === id)
    if (!order) return

    if (action === 'create' && order.status !== 1) {
      showAlert('Ação Inválida', 'Somente pedidos pendentes podem ser criados.', 'warning'); return
    }
    if (action === 'arrive' && order.status !== 2) {
      showAlert('Ação Inválida', 'Somente pedidos criados podem ter chegada registrada.', 'warning'); return
    }
    if (action === 'withdraw' && order.status !== 3) {
      showAlert('Ação Inválida', 'Somente pedidos prontos podem ser retirados.', 'warning'); return
    }
    if (action === 'annul' && order.annulled) {
      showAlert('Ação Inválida', 'Este pedido já está anulado.', 'warning'); return
    }

    setModalState({ isOpen: true, orderId: id, action, withdrawnBy: '', annulledReason: '', removeReason: '' })
  }

  const handleModalSubmit = async () => {
    const { orderId, action, annulledReason } = modalState
    const now = new Date().toISOString()
    
    setOrders(prev => {
      const orderIndex = prev.findIndex(o => o.id === orderId)
      if (orderIndex === -1) return prev
      
      const updatedOrders = [...prev]
      const order = updatedOrders[orderIndex]

      if (action === 'create') {
        updatedOrders[orderIndex] = {
          ...order, status: 2,
          createdBy: currentUser?.username,
          createdAt: now,
          estimatedArrival: calculateEstimatedArrival(),
          updatedAt: now
        }
      } else if (action === 'arrive') {
        updatedOrders[orderIndex] = {
          ...order, status: 3,
          readyRegisteredBy: currentUser?.username,
          readyRegisteredAt: now,
          updatedAt: now
        }
      } else if (action === 'withdraw') {
        const resp = (responsibles || []).find(r => r.id === modalState.withdrawnById)
        if (!resp) return prev // Já validado antes, mas por segurança
        
        updatedOrders[orderIndex] = {
          ...order, status: 4,
          withdrawnBy: resp.name,
          withdrawnById: resp.id,
          withdrawnAt: now,
          withdrawalRegisteredBy: currentUser?.username,
          updatedAt: now
        }

        // Se retirou, cria o registro de movimento
        if (setMovements) {
          const updatedOrder = updatedOrders[orderIndex]
          const movRecord = {
            id: `order-${order.id}-${Date.now()}`,
            timestamp: now,
            accessoryId: order.accessoryId,
            responsibleId: resp.id,
            soNumber: order.osNumber,
            author: currentUser?.username,
            isOrderWithdrawal: true,
            isReturn: false,
            annulled: false,
            isDeleted: false,
            orderWithdrawalInfo: {
              orderId: order.id,
              clientName: order.clientName,
              withdrawnBy: updatedOrder.withdrawnBy,
              withdrawalRegisteredBy: currentUser?.username,
              osNumber: order.osNumber,
              accessoryName: order.accessoryName
            }
          }
          setMovements(mPrev => [movRecord, ...(mPrev || [])])
        }
      } else if (action === 'annul') {
        if (!annulledReason.trim()) return prev
        updatedOrders[orderIndex] = {
          ...order, annulled: true,
          annulledReason: annulledReason.trim(),
          annulledBy: currentUser?.username,
          annulledAt: now,
          updatedAt: now
        }
      }
      return updatedOrders
    })
    setModalState({ ...modalState, isOpen: false })
  }

  // ── Remover pedido (Admin) — soft delete com rastreamento ─────────────────
  const handleRemoveOrder = (orderId) => {
    setModalState({
      isOpen: true, orderId, action: 'remove',
      withdrawnBy: '', annulledReason: '', removeReason: ''
    })
  }

  const handleRemoveConfirm = async () => {
    if (!modalState.removeReason.trim()) {
      showAlert('Campo Obrigatório', 'Informe o motivo da remoção do registro.', 'warning'); return
    }
    const now = new Date().toISOString()
    setOrders(prev => prev.map(o => {
      if (o.id !== modalState.orderId) return o
      return {
        ...o,
        removed: true,
        removedBy: currentUser?.username,
        removedReason: modalState.removeReason.trim(),
        removedAt: now
      }
    }))
    setModalState({ ...modalState, isOpen: false })
  }

  // ── Utilitários ────────────────────────────────────────────────────────────
  const getStatusLabel = (status) => {
    switch (status) {
      case 1: return 'Pendente'
      case 2: return 'Criado'
      case 3: return 'Pronto'
      case 4: return 'Retirado'
      default: return '-'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 1: return '#eab308'
      case 2: return '#3b82f6'
      case 3: return '#22c55e'
      case 4: return '#a855f7'
      default: return '#6b7280'
    }
  }

  const formatDate = (isoStr) => {
    if (!isoStr) return '-'
    return new Date(isoStr).toLocaleString('pt-BR')
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filteredOrders = orders.filter(order => {
    if (filterStatus === 'removed') return order.removed === true
    if (order.removed) return false
    if (filterStatus === 'annulled') return order.annulled
    if (order.annulled) return false
    if (filterStatus !== 'all' && order.status !== Number(filterStatus)) return false
    if (filterDate) {
      const orderDate = new Date(order.requestedAt).toISOString().split('T')[0]
      if (orderDate !== filterDate) return false
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        order.osNumber.toLowerCase().includes(term) ||
        order.clientName.toLowerCase().includes(term) ||
        order.accessoryName.toLowerCase().includes(term) ||
        order.requestedBy.toLowerCase().includes(term)
      )
    }
    return true
  })

  // ── Contadores por status ──────────────────────────────────────────────────
  const activeOrders = orders.filter(o => !o.annulled && !o.removed)
  const countByStatus = (s) => activeOrders.filter(o => o.status === s).length
  const isRemoveAction = modalState.action === 'remove'

  return (
    <div className="tab-content relative">

      {/* ── Modal de PRÉ-CONFIRMAÇÃO da solicitação ── */}
      <ConfirmModal
        isOpen={!!pendingOrder}
        title="📋 Confirmar Solicitação"
        message={
          pendingOrder && (
            <div>
              <p style={{ marginBottom: '1rem' }}>
                Revise os dados antes de enviar ao Estoque:
              </p>
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.85rem'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>Acessório:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{pendingOrder.accessoryName}</strong>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>O.S.:</span>
                  <code style={{
                    background: 'var(--bg-card)', padding: '1px 8px',
                    borderRadius: '4px', fontWeight: 700,
                    color: 'var(--accent)', border: '1px solid var(--border)'
                  }}>
                    {pendingOrder.osNumber}
                  </code>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>Cliente:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{pendingOrder.clientName}</strong>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>Solicitante:</span>
                  <span>{pendingOrder.requestedBy}</span>
                </div>
              </div>
              <p style={{ marginTop: '0.85rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                Após confirmar, o pedido ficará com status <strong style={{ color: '#eab308' }}>Pendente</strong> até o Estoque registrá-lo.
              </p>
            </div>
          )
        }
        type="warning"
        confirmText="Confirmar Solicitação"
        cancelText="Cancelar"
        onConfirm={handleConfirmOrder}
        onCancel={handleCancelOrder}
      />

      {/* ── Modal de ação (criar, chegada, retirada, anular) ── */}
      <ConfirmModal
        isOpen={modalState.isOpen && !isRemoveAction}
        title={
          modalState.action === 'create' ? '📋 Criar Pedido' :
            modalState.action === 'arrive' ? '📦 Registrar Chegada' :
              modalState.action === 'withdraw' ? '✅ Registrar Retirada' :
                '⛔ Anular Pedido'
        }
        message={
          modalState.action === 'create' ? 'Confirmar a criação do pedido? A previsão de chegada será de 15 dias úteis a partir de hoje.' :
            modalState.action === 'arrive' ? 'Confirmar o registro de chegada do acessório? O cliente poderá ser avisado para retirada.' :
              modalState.action === 'withdraw' ? 'Selecione o responsável que está retirando o acessório da lista abaixo:' :
                'Informe o motivo da anulação do pedido:'
        }
        type={modalState.action === 'annul' ? 'danger' : 'warning'}
        confirmText={
          modalState.action === 'create' ? 'Confirmar Criação' :
            modalState.action === 'arrive' ? 'Confirmar Chegada' :
              modalState.action === 'withdraw' ? 'Confirmar Retirada' :
                'Anular Pedido'
        }
        cancelText="Cancelar"
        showSelect={modalState.action === 'withdraw'}
        selectLabel="Responsável pela retirada"
        selectPlaceholder="Selecione o responsável..."
        selectOptions={(responsibles || []).map(r => ({ value: r.id, label: r.name }))}
        selectValue={modalState.withdrawnById}
        onSelectChange={(val) => setModalState({ ...modalState, withdrawnById: val })}
        showInput={modalState.action === 'annul'}
        inputValue={modalState.annulledReason}
        onInputChange={(val) => { if (modalState.action === 'annul') setModalState({ ...modalState, annulledReason: val }) }}
        inputPlaceholder="Motivo da anulação..."
        onConfirm={handleModalSubmit}
        onCancel={() => setModalState({ ...modalState, isOpen: false, withdrawnById: '' })}
      />

      {/* ── Modal de remoção (apenas Admin, com rastreamento) ── */}
      <ConfirmModal
        isOpen={modalState.isOpen && isRemoveAction}
        title="🗑️ Remover Registro (Admin)"
        message="Esta ação irá marcar o pedido como removido. O registro será preservado no arquivo Excel com data, hora e seu usuário identificados."
        type="danger"
        confirmText="Confirmar Remoção"
        cancelText="Cancelar"
        showInput={true}
        inputValue={modalState.removeReason}
        onInputChange={(val) => setModalState({ ...modalState, removeReason: val })}
        inputPlaceholder="Informe o motivo da remoção..."
        onConfirm={handleRemoveConfirm}
        onCancel={() => setModalState({ ...modalState, isOpen: false })}
      />

      {/* ── Cards de resumo por status ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem'
      }}>
        {[
          { label: 'Pendentes', status: 1, color: '#eab308', emoji: '⏳' },
          { label: 'Criados', status: 2, color: '#3b82f6', emoji: '🔄' },
          { label: 'Prontos', status: 3, color: '#22c55e', emoji: '📦' },
          { label: 'Retirados', status: 4, color: '#a855f7', emoji: '✅' },
        ].map((item) => (
          <div
            key={item.label}
            className="card"
            style={{
              cursor: 'pointer',
              borderTop: `3px solid ${item.color}`,
              padding: '1rem',
              textAlign: 'center',
              transition: 'transform 0.15s, box-shadow 0.15s',
              userSelect: 'none'
            }}
            onClick={() =>
              setFilterStatus(f =>
                f === String(item.status) ? 'all' : String(item.status)
              )
            }
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{item.emoji}</div>
            <div style={{
              fontSize: '1.8rem', fontWeight: 800,
              color: item.color, lineHeight: 1
            }}>
              {countByStatus(item.status)}
            </div>
            <div style={{
              fontSize: '0.75rem', fontWeight: 600, marginTop: '0.3rem',
              color: filterStatus === String(item.status) ? item.color : 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              {item.label}
              {filterStatus === String(item.status) && (
                <span style={{ display: 'block', fontSize: '0.65rem', marginTop: '2px' }}>
                  filtrado
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Formulário de solicitação ── */}
      {canRequestOrder && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem', fontSize: '1.1rem'
          }}>
            <Package size={20} className="accent" />
            Solicitação de Pedido de Acessório
          </h2>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
            padding: '0.7rem 1rem',
            background: 'rgba(56, 189, 248, 0.07)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '8px', marginBottom: '1.25rem',
            fontSize: '0.83rem', color: 'var(--text-secondary)'
          }}>
            <Info size={15} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
            <span>
              Campos marcados com <strong>*</strong> são obrigatórios.
              Após a solicitação, o <strong>Estoque</strong> será responsável por avançar o status.
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="input-group">
                <CustomSelect
                  label="Acessório *"
                  value={formData.accessoryId}
                  onChange={(e) => setFormData({ ...formData, accessoryId: e.target.value })}
                  options={accessories.map(acc => ({
                    value: acc.id,
                    label: `${acc.factoryCode} - ${acc.commercialName}`
                  }))}
                  placeholder="Selecione o acessório..."
                />
              </div>
              <div className="input-group">
                <label>Ordem de Serviço (O.S.) *</label>
                <input
                  type="text"
                  value={formData.osNumber}
                  onChange={(e) => setFormData({ ...formData, osNumber: e.target.value })}
                  placeholder="Ex: OS-9988"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Nome do Cliente *</label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                placeholder="Nome completo do cliente (mín. 3 caracteres)"
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              <Package size={17} /> Solicitar Pedido
            </button>
          </form>
        </div>
      )}

      {/* ── Lista de pedidos ── */}
      <div className="card">
        {/* Barra de filtros refinada */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          padding: '0.85rem 1rem',
          background: 'var(--bg-input)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          marginBottom: '1.5rem'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
            Lista de Pedidos
          </span>

          {/* Divisor */}
          <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '0.35rem 0.7rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            >
              <option value="all">Todos</option>
              <option value="1">Pendente</option>
              <option value="2">Criado</option>
              <option value="3">Pronto</option>
              <option value="4">Retirado</option>
              <option value="annulled">Anulados</option>
              {isAdmin && <option value="removed">Removidos</option>}
            </select>
          </div>

          {/* Data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Data</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{
                padding: '0.35rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
            <button
              onClick={() =>
                filterDate
                  ? setFilterDate('')
                  : setFilterDate(new Date().toISOString().split('T')[0])
              }
              style={{
                padding: '0.35rem 0.7rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                background: filterDate ? 'var(--accent)' : 'var(--bg-card)',
                color: filterDate ? '#020617' : 'var(--text-secondary)',
                border: '1px solid var(--border)', cursor: 'pointer'
              }}
            >
              {filterDate ? 'Limpar' : 'Hoje'}
            </button>
          </div>

          {/* Busca */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            flex: '1 1 180px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '0.35rem 0.7rem'
          }}>
            <Search size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar O.S., cliente, acessório..."
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%'
              }}
            />
          </div>

          {/* Contador de resultados */}
          <span style={{
            fontSize: '0.78rem', color: 'var(--text-secondary)',
            whiteSpace: 'nowrap', marginLeft: 'auto'
          }}>
            {filteredOrders.length} resultado{filteredOrders.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tabela */}
        <div className="table-container">
          <table className="responsive-table order-table">
            <thead>
              <tr>
                <th>Data/Hora Solicitação</th>
                <th>O.S.</th>
                <th>Cliente</th>
                <th>Acessório</th>
                <th>Status / Histórico</th>
                <th>Solicitado por</th>
                {(canAdvanceStatus || isAdmin) && (
                  <th style={{ textAlign: 'center' }}>Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{
                    textAlign: 'center', padding: '3rem',
                    color: 'var(--text-secondary)', fontSize: '0.9rem'
                  }}>
                    Nenhum pedido encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    className={`row-animate ${order.annulled || order.removed ? 'row-annulled' : ''}`}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <td style={{ fontSize: '0.83rem', fontWeight: 500 }}>
                      {formatDate(order.requestedAt)}
                    </td>

                    <td>
                      <code style={{
                        background: 'var(--bg-input)', padding: '2px 8px',
                        borderRadius: '4px', fontSize: '0.8rem',
                        border: '1px solid var(--border)', fontWeight: 700
                      }}>
                        {order.osNumber}
                      </code>
                    </td>

                    <td style={{ fontWeight: 500 }}>{order.clientName}</td>
                    <td>{order.accessoryName}</td>

                    {/* Status com histórico */}
                    <td>
                      {order.removed ? (
                        <div>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                            background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.3)'
                          }}>
                            <AlertOctagon size={11} /> REMOVIDO
                          </span>
                          <div style={{ marginTop: '5px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong>Por:</strong> {order.removedBy}<br />
                            <strong>Motivo:</strong> {order.removedReason}<br />
                            <strong>Em:</strong> {formatDate(order.removedAt)}
                          </div>
                        </div>
                      ) : order.annulled ? (
                        <div>
                          <span style={{
                            display: 'inline-block', padding: '0.2rem 0.5rem',
                            borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.3)'
                          }}>
                            Anulado
                          </span>
                          <div style={{ marginTop: '5px', fontSize: '0.72rem', color: '#ef4444', lineHeight: 1.5 }}>
                            <strong>Motivo:</strong> {order.annulledReason}<br />
                            <strong>Por:</strong> {order.annulledBy} — {formatDate(order.annulledAt)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              display: 'inline-block', padding: '0.2rem 0.5rem',
                              borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                              background: getStatusColor(order.status) + '20',
                              color: getStatusColor(order.status),
                              border: `1px solid ${getStatusColor(order.status)}50`
                            }}>
                              {getStatusLabel(order.status)}
                            </span>
                            {order.status >= 2 && (
                              <button
                                onClick={() => toggleDetails(order.id)}
                                style={{
                                  background: expandedOrders[order.id] ? 'var(--accent)' : 'var(--bg-input)',
                                  border: '1px solid var(--border)',
                                  cursor: 'pointer',
                                  color: expandedOrders[order.id] ? '#020617' : 'var(--text-secondary)',
                                  padding: '4px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s'
                                }}
                                title="Ver histórico do pedido"
                              >
                                <Info size={14} />
                              </button>
                            )}
                          </div>

                          {expandedOrders[order.id] && (
                            <div style={{ animation: 'detailFadeIn 0.3s ease-out' }}>
                              {order.status >= 2 && order.createdBy && (
                                <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                  <strong>Criado por:</strong> {order.createdBy}<br />
                                  <strong>Em:</strong> {formatDate(order.createdAt)}<br />
                                  <strong>Previsão:</strong> {formatDate(order.estimatedArrival)}
                                </div>
                              )}
                              {order.status >= 3 && order.readyRegisteredBy && (
                                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                  <strong>Chegada reg.:</strong> {order.readyRegisteredBy}<br />
                                  <strong>Em:</strong> {formatDate(order.readyRegisteredAt)}
                                </div>
                              )}
                              {order.status === 4 && order.withdrawnBy && (
                                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                  <strong>Retirado por:</strong> {order.withdrawnBy}<br />
                                  <strong>Em:</strong> {formatDate(order.withdrawnAt)}<br />
                                  <strong>Saída reg.:</strong> {order.withdrawalRegisteredBy}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td style={{ fontSize: '0.85rem' }}>{order.requestedBy}</td>

                    {/* Ações — barra de progresso + botões pill nomeados */}
                    {(canAdvanceStatus || isAdmin) && (
                      <td style={{ minWidth: '180px', position: 'relative' }}>
                        {!order.removed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>

                            {/* Barra de progresso 4 pontos */}
                            {!order.annulled && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '4px' }}>
                                {[
                                  { s: 1, color: '#eab308', label: '⏳' },
                                  { s: 2, color: '#3b82f6', label: '🔄' },
                                  { s: 3, color: '#22c55e', label: '📦' },
                                  { s: 4, color: '#a855f7', label: '✅' }
                                ].map((step, i) => (
                                  <React.Fragment key={step.s}>
                                    <div
                                      title={getStatusLabel(step.s)}
                                      style={{
                                        width: order.status === step.s ? '10px' : '7px',
                                        height: order.status === step.s ? '10px' : '7px',
                                        borderRadius: '50%',
                                        background: order.status >= step.s ? step.color : 'var(--border)',
                                        border: order.status === step.s ? `2px solid ${step.color}` : 'none',
                                        boxShadow: order.status === step.s ? `0 0 6px ${step.color}80` : 'none',
                                        transition: 'all 0.3s',
                                        flexShrink: 0
                                      }}
                                    />
                                    {i < 3 && (
                                      <div style={{
                                        width: '12px', height: '2px', borderRadius: '1px',
                                        background: order.status > step.s
                                          ? `linear-gradient(90deg, ${step.color}, ${{ 1: '#3b82f6', 2: '#22c55e', 3: '#a855f7' }[step.s]})`
                                          : 'var(--border)'
                                      }} />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            )}

                            {/* Botão de ação principal (próximo step) */}
                            {canAdvanceStatus && !order.annulled && (
                              <>
                                {order.status === 1 && (
                                  <button
                                    onClick={() => handleActionOpen(order.id, 'create')}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '3px 10px', borderRadius: '20px', cursor: 'pointer',
                                      fontSize: '0.75rem', fontWeight: 700,
                                      background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
                                      border: '1px solid rgba(59,130,246,0.35)',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.28)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'}
                                  >
                                    <Plus size={12} /> Criar Pedido
                                  </button>
                                )}
                                {order.status === 2 && (
                                  <button
                                    onClick={() => handleActionOpen(order.id, 'arrive')}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '3px 10px', borderRadius: '20px', cursor: 'pointer',
                                      fontSize: '0.75rem', fontWeight: 700,
                                      background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                                      border: '1px solid rgba(34,197,94,0.35)',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.28)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.15)'}
                                  >
                                    <Clock size={12} /> Chegou
                                  </button>
                                )}
                                {order.status === 3 && (
                                  <button
                                    onClick={() => handleActionOpen(order.id, 'withdraw')}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '3px 10px', borderRadius: '20px', cursor: 'pointer',
                                      fontSize: '0.75rem', fontWeight: 700,
                                      background: 'rgba(168,85,247,0.15)', color: '#a855f7',
                                      border: '1px solid rgba(168,85,247,0.35)',
                                      transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,0.28)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(168,85,247,0.15)'}
                                  >
                                    <UserCheck size={12} /> Retirar
                                  </button>
                                )}
                                {order.status === 4 && (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700,
                                    background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                                    border: '1px solid rgba(168,85,247,0.25)'
                                  }}>
                                    ✅ Concluído
                                  </span>
                                )}
                              </>
                            )}

                            {/* Linha de botões secundários: Anular + Remover */}
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {canAdvanceStatus && !order.annulled && [1, 2, 3].includes(order.status) && (
                                <button
                                  onClick={() => handleActionOpen(order.id, 'annul')}
                                  title="Anular Pedido"
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                    padding: '2px 7px', borderRadius: '20px', cursor: 'pointer',
                                    fontSize: '0.7rem', fontWeight: 600,
                                    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                >
                                  <XCircle size={11} /> Anular
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleRemoveOrder(order.id)}
                                  title="Remover Registro (Admin)"
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '5px', borderRadius: '6px', cursor: 'pointer',
                                    background: 'none', color: '#6b7280',
                                    border: '1px solid transparent',
                                    transition: 'all 0.15s',
                                    position: 'absolute',
                                    right: '15px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    opacity: 0.5
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.color = '#ef4444';
                                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                                    e.currentTarget.style.background = 'rgba(239,68,68,0.05)';
                                    e.currentTarget.style.opacity = 1;
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.color = '#6b7280';
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.background = 'none';
                                    e.currentTarget.style.opacity = 0.5;
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>

                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}