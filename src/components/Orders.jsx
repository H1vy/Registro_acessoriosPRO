import React, { useState } from 'react'
import {
  Package, Plus, Clock, UserCheck,
  Trash2, XCircle, Info, Search, AlertOctagon, Edit3, X, Eye, EyeOff
} from 'lucide-react'
import CustomSelect from './CustomSelect'
import ConfirmModal from './ConfirmModal'

export default function Orders({ orders, setOrders, accessories, responsibles, movements, setMovements, currentUser, showAlert }) {
  const [formData, setFormData] = useState({ osNumber: '', clientName: '' })
  const isAdmin = currentUser?.role === 'admin'
  const [selectedAccessories, setSelectedAccessories] = useState([]) // Para o form de adição múltipla
  const [currentAccessorySelection, setCurrentAccessorySelection] = useState('')
  const [currentQuantity, setCurrentQuantity] = useState(1)

  const [modalState, setModalState] = useState({
    isOpen: false, orderId: null, action: null,
    isOsAction: false, targetOs: null,
    withdrawnById: '',   // ID do responsável selecionado na retirada
    annulledReason: '', removeReason: '',
    editData: { osNumber: '', clientName: '', accessoryId: '' }
  })
  const [pendingOrders, setPendingOrders] = useState(null)   // pedidos aguardando confirmação
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedOrders, setExpandedOrders] = useState({})
  const [osVisibility, setOsVisibility] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const toggleDetails = (id) => {
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleOSVisibility = (osGroup) => {
    const isVisible = osVisibility[osGroup.osNumber] !== undefined 
      ? osVisibility[osGroup.osNumber] 
      : !osGroup.isAllAnnulled;
    setOsVisibility(prev => ({ ...prev, [osGroup.osNumber]: !isVisible }))
  }

  // ── Permissões por setor ───────────────────────────────────────────────────
  const canAdvanceStatus = currentUser?.role === 'admin' || currentUser?.sector === 'estoque'
  const canRequestOrder = currentUser?.role === 'admin' || currentUser?.sector === 'atendimento'

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

  const handleAddAccessory = () => {
    if (!currentAccessorySelection) return
    const accessory = accessories.find(a => a.id === currentAccessorySelection)
    if (!accessory) return
    const qty = parseInt(currentQuantity) || 1;
    setSelectedAccessories([...selectedAccessories, { 
      listId: Date.now() + Math.random(),
      id: accessory.id, 
      name: accessory.commercialName, 
      factoryCode: accessory.factoryCode,
      quantity: qty
    }])
    setCurrentAccessorySelection('')
    setCurrentQuantity(1)
  }

  const handleRemoveAccessory = (listId) => {
    setSelectedAccessories(selectedAccessories.filter(a => a.listId !== listId))
  }

  // ── Submissão do formulário — abre pré-confirmação ────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.osNumber.trim() || !formData.clientName.trim() || selectedAccessories.length === 0) {
      showAlert('Campos Obrigatórios', 'Por favor, preencha O.S., cliente e adicione ao menos um acessório.', 'warning')
      return
    }
    if (formData.clientName.trim().length < 3) {
      showAlert('Campo Inválido', 'O nome do cliente deve ter ao menos 3 caracteres.', 'warning')
      return
    }

    const trimmedOsNumber = formData.osNumber.trim()
    const osExists = orders.some(o => o.osNumber === trimmedOsNumber && !o.annulled && !o.removed)
    if (osExists) {
      showAlert('O.S. já existente', 'Já existe um pedido com esse número de O.S.. Cada solicitação deve ter um número único.', 'warning')
      return
    }

    const newOrders = [];
    selectedAccessories.forEach((acc, index) => {
      const qty = acc.quantity || 1;
      for (let i = 0; i < qty; i++) {
        newOrders.push({
          id: `${Date.now()}-${index}-${i}-${Math.random()}`,
          osNumber: formData.osNumber.trim(),
          clientName: formData.clientName.trim(),
          accessoryId: acc.id,
          accessoryName: acc.name,
          status: 1,
          requestedBy: currentUser?.username || 'Sistema',
          requestedAt: new Date().toISOString(),
          annulled: false,
          removed: false
        });
      }
    });

    // Armazena os pedidos pendentes e abre modal de confirmação
    setPendingOrders(newOrders)
  }

  // ── Confirmar criação efetiva do pedido ───────────────────────────────────
  const handleConfirmOrder = () => {
    if (!pendingOrders) return
    setOrders(prev => [...pendingOrders, ...prev])
    setFormData({ osNumber: '', clientName: '' })
    setSelectedAccessories([])
    setPendingOrders(null)
    showAlert('Sucesso', 'Pedido(s) solicitado(s)! O Estoque irá avançar o status conforme andamento.', 'success')
  }

  const handleCancelOrder = () => setPendingOrders(null)

  // ── Abrir modal de ação ────────────────────────────────────────────────────
  const handleActionOpen = (id, action, isOsAction = false, targetOs = null) => {
    if (isOsAction) {
      if (action === 'edit') {
        const osOrders = orders.filter(o => o.osNumber === targetOs && !o.annulled && !o.removed);
        if (osOrders.length > 0) {
          setSelectedAccessories([]);
          setCurrentAccessorySelection('');
          setCurrentQuantity(1);
          setModalState({
            isOpen: true, orderId: null, action, isOsAction, targetOs,
            withdrawnById: '', annulledReason: '', removeReason: '',
            editData: { osNumber: osOrders[0].osNumber, clientName: osOrders[0].clientName, accessoryId: '' }
          })
        }
        return
      }
      setModalState({ isOpen: true, orderId: null, action, isOsAction, targetOs, withdrawnById: '', annulledReason: '', removeReason: '', editData: { osNumber: '', clientName: '', accessoryId: '' } })
      return;
    }

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

    if (action === 'edit') {
      setModalState({
        isOpen: true, orderId: id, action, isOsAction: false, targetOs: null,
        withdrawnById: '', annulledReason: '', removeReason: '',
        editData: { osNumber: order.osNumber, clientName: order.clientName, accessoryId: order.accessoryId }
      })
      return
    }

    setModalState({ isOpen: true, orderId: id, action, isOsAction: false, targetOs: null, withdrawnById: '', annulledReason: '', removeReason: '', editData: { osNumber: '', clientName: '', accessoryId: '' } })
  }

  const handleModalSubmit = async () => {
    const { orderId, action, annulledReason, isOsAction, targetOs } = modalState
    const now = new Date().toISOString()
    
    // Validation for OS Number uniqueness on edit
    if (action === 'edit' && isOsAction) {
      const newOsNumber = modalState.editData.osNumber.trim()
      if (newOsNumber !== targetOs) {
        const osExists = orders.some(o => o.osNumber === newOsNumber && !o.annulled && !o.removed)
        if (osExists) {
          showAlert('O.S. já existente', 'Já existe um pedido ativo com esse número de O.S.. Cada solicitação deve ter um número único.', 'warning')
          return
        }
      }
    }

    setOrders(prev => {
      let updatedOrders = [...prev];

      const processIndices = (indices) => {
        indices.forEach(orderIndex => {
          const order = updatedOrders[orderIndex];
          if (action === 'create' && order.status === 1) {
            updatedOrders[orderIndex] = {
              ...order, status: 2, createdBy: currentUser?.username, createdAt: now, estimatedArrival: calculateEstimatedArrival(), updatedAt: now
            }
          } else if (action === 'arrive' && order.status === 2) {
            updatedOrders[orderIndex] = {
              ...order, status: 3, readyRegisteredBy: currentUser?.username, readyRegisteredAt: now, updatedAt: now
            }
          } else if (action === 'withdraw' && order.status === 3) {
            const resp = (responsibles || []).find(r => r.id === modalState.withdrawnById)
            if (!resp) return;
            updatedOrders[orderIndex] = {
              ...order, status: 4, withdrawnBy: resp.name, withdrawnById: resp.id, withdrawnAt: now, withdrawalRegisteredBy: currentUser?.username, updatedAt: now
            }
            if (setMovements) {
              const movRecord = {
                id: `order-${order.id}-${Date.now()}-${Math.random()}`,
                timestamp: now, 
                type: 'checkout',
                accessoryId: order.accessoryId, 
                responsibleId: resp.id, 
                soNumber: order.osNumber, 
                author: currentUser?.username, 
                quantity: order.quantity || 1,
                isOrderWithdrawal: true, 
                isReturn: false, 
                annulled: false, 
                isDeleted: false,
                attachmentStatus: 'pending',
                orderWithdrawalInfo: { orderId: order.id, clientName: order.clientName, withdrawnBy: resp.name, withdrawalRegisteredBy: currentUser?.username, osNumber: order.osNumber, accessoryName: order.accessoryName }
              }
              setMovements(mPrev => [movRecord, ...(mPrev || [])])
            }
          } else if (action === 'annul' && !order.annulled && !order.removed) {
            if (!annulledReason.trim()) return;
            updatedOrders[orderIndex] = {
              ...order, annulled: true, annulledReason: annulledReason.trim(), annulledBy: currentUser?.username, annulledAt: now, updatedAt: now
            }
          } else if (action === 'edit' && !order.annulled && !order.removed) {
            if (!modalState.editData.osNumber.trim() || !modalState.editData.clientName.trim()) return;
            if (isOsAction) {
              updatedOrders[orderIndex] = {
                ...order, osNumber: modalState.editData.osNumber.trim(), clientName: modalState.editData.clientName.trim(), updatedAt: now, lastEditedBy: currentUser?.username
              }
            } else {
               if(!modalState.editData.accessoryId) return;
               const accName = accessories.find(a => a.id === modalState.editData.accessoryId)?.commercialName || 'Desconhecido';
               updatedOrders[orderIndex] = {
                 ...order, osNumber: modalState.editData.osNumber.trim(), clientName: modalState.editData.clientName.trim(), accessoryId: modalState.editData.accessoryId, accessoryName: accName, updatedAt: now, lastEditedBy: currentUser?.username
               }
            }
          }
        });
      };

      if (isOsAction) {
         const targetIndices = [];
         updatedOrders.forEach((o, i) => {
           if (o.osNumber === targetOs && !o.removed && !o.annulled) targetIndices.push(i);
         });
         if(action === 'annul' && !annulledReason.trim()) return prev;
         processIndices(targetIndices);
         
         if (action === 'edit' && selectedAccessories.length > 0) {
           const newOrders = [];
           selectedAccessories.forEach(item => {
             for (let i = 0; i < item.quantity; i++) {
               newOrders.push({
                 id: `req-${Date.now()}-${Math.random()}`,
                 osNumber: modalState.editData.osNumber.trim(),
                 clientName: modalState.editData.clientName.trim(),
                 accessoryId: item.id,
                 accessoryName: item.name,
                 requestedBy: currentUser?.username,
                 requestedAt: now,
                 status: 1,
                 estimatedArrival: null,
                 annulled: false,
                 annulledReason: '',
                 removed: false,
                 removedReason: ''
               });
             }
           });
           updatedOrders = [...newOrders, ...updatedOrders];
           setSelectedAccessories([]);
         }
      } else {
          const idsToProcess = Array.isArray(orderId) ? orderId : [orderId];
          const targetIndices = [];
          idsToProcess.forEach(id => {
            const idx = updatedOrders.findIndex(o => o.id === id);
            if (idx !== -1) targetIndices.push(idx);
          });
          if (targetIndices.length === 0) return prev;
          if (action === 'annul' && !annulledReason.trim()) return prev;
          processIndices(targetIndices);
      }
      
      return updatedOrders;
    })
    setModalState({ ...modalState, isOpen: false })
  }

  // ── Remover pedido (Admin) — soft delete com rastreamento ─────────────────
  const handleRemoveOrder = (orderId, isOsAction = false, targetOs = null) => {
    if (isOsAction) {
      const osGroup = groupedOS.find(g => g.osNumber === targetOs);
      if (!osGroup?.isAllAnnulled) {
        showAlert('Ação Negada', 'Uma O.S. só pode ser removida se todos os seus itens estiverem anulados.', 'warning');
        return;
      }
    } else {
      const idsToCheck = Array.isArray(orderId) ? orderId : [orderId];
      const allAnnulled = idsToCheck.every(id => {
        const order = orders.find(o => o.id === id);
        return order?.annulled;
      });

      if (!allAnnulled) {
        showAlert('Ação Negada', 'O registro só pode ser removido se estiver anulado.', 'warning');
        return;
      }
    }

    setModalState({
      isOpen: true, orderId, action: 'remove', isOsAction, targetOs,
      withdrawnBy: '', annulledReason: '', removeReason: ''
    })
  }

  const handleRemoveConfirm = async () => {
    if (!modalState.removeReason.trim()) {
      showAlert('Campo Obrigatório', 'Informe o motivo da remoção do registro.', 'warning'); return
    }
    const now = new Date().toISOString()
    setOrders(prev => prev.map(o => {
      if (modalState.isOsAction) {
         if (o.osNumber !== modalState.targetOs) return o;
      } else {
         const idsToMatch = Array.isArray(modalState.orderId) ? modalState.orderId : [modalState.orderId];
         if (!idsToMatch.includes(o.id)) return o;
      }
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

  // ── Agrupamento de pedidos por O.S. e Status Master ───────────────────────
  const groupedOS = React.useMemo(() => {
    const groups = {};
    orders.forEach(order => {
      if (!groups[order.osNumber]) {
        groups[order.osNumber] = {
          osNumber: order.osNumber,
          clientName: order.clientName,
          requestedAt: order.requestedAt,
          accessories: [],
        };
      }
      groups[order.osNumber].accessories.push(order);
    });

    return Object.values(groups).map(os => {
      const activeAccs = os.accessories.filter(a => !a.annulled && !a.removed);
      let masterStatus = 0; 
      
      const isAllRemoved = os.accessories.length > 0 && os.accessories.every(a => a.removed);
      const isAllAnnulled = !isAllRemoved && os.accessories.every(a => a.annulled || a.removed);
      
      if (activeAccs.length > 0) {
        const statuses = activeAccs.map(a => a.status);
        const minStatus = Math.min(...statuses);
        const maxStatus = Math.max(...statuses);
        
        if (maxStatus === 1) masterStatus = 1; 
        else if (minStatus >= 4) masterStatus = 4; 
        else if (minStatus >= 3) masterStatus = 3; 
        else masterStatus = 2; 
      }

      // Unificação Visual: agrupar acessórios por accessoryId, status, anulado e removido
      const unified = {};
      os.accessories.forEach(order => {
        const key = `${order.accessoryId}-${order.status}-${order.annulled ? 'A' : 'V'}-${order.removed ? 'R' : 'S'}`;
        if (!unified[key]) {
          unified[key] = { 
            ...order, 
            originalIds: [order.id], 
            totalQuantity: order.quantity || 1 
          };
        } else {
          unified[key].totalQuantity += (order.quantity || 1);
          unified[key].originalIds.push(order.id);
        }
      });
      const unifiedAccessories = Object.values(unified);
      
      return { ...os, activeAccessories: activeAccs, masterStatus, isAllRemoved, isAllAnnulled, unifiedAccessories };
    }).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }, [orders]);

  // ── Filtros na O.S. ────────────────────────────────────────────────────────
  const filteredGroups = React.useMemo(() => {
    return groupedOS.filter(os => {
      if (filterStatus === 'removed') return os.isAllRemoved === true;
      if (os.isAllRemoved) return false;
      
      if (filterStatus === 'annulled') return os.isAllAnnulled === true;
      if (filterStatus !== 'all' && os.isAllAnnulled) return false;
      
      if (filterStatus !== 'all' && os.masterStatus !== Number(filterStatus)) return false;
      
      if (filterDate) {
        const osDate = new Date(os.requestedAt).toISOString().split('T')[0];
        if (osDate !== filterDate) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchOS = os.osNumber.toLowerCase().includes(term);
        const matchClient = os.clientName.toLowerCase().includes(term);
        const matchAcc = os.accessories.some(a => a.accessoryName.toLowerCase().includes(term));
        const matchRequested = os.accessories.some(a => a.requestedBy?.toLowerCase().includes(term));
        return matchOS || matchClient || matchAcc || matchRequested;
      }
      return true;
    });
  }, [groupedOS, filterStatus, filterDate, searchTerm]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterDate, searchTerm]);

  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const paginatedGroups = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredGroups.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredGroups, currentPage]);

  // ── Contadores por status ──────────────────────────────────────────────────
  const activeOSGroups = groupedOS.filter(os => !os.isAllAnnulled && !os.isAllRemoved);
  const countByStatus = (s) => activeOSGroups.filter(os => os.masterStatus === s).length;
  const isRemoveAction = modalState.action === 'remove';

  return (
    <div className="tab-content relative">

      {/* ── Modal de PRÉ-CONFIRMAÇÃO da solicitação ── */}
      <ConfirmModal
        isOpen={!!pendingOrders}
        title="📋 Confirmar Solicitação"
        message={
          pendingOrders && pendingOrders.length > 0 && (
            <div>
              <p style={{ marginBottom: '1rem' }}>
                Revise os pedidos antes de enviar ao Estoque:
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
                  <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>O.S.:</span>
                  <code style={{
                    background: 'var(--bg-card)', padding: '1px 8px',
                    borderRadius: '4px', fontWeight: 700,
                    color: 'var(--accent)', border: '1px solid var(--border)'
                  }}>
                    {pendingOrders[0].osNumber}
                  </code>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>Cliente:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{pendingOrders[0].clientName}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Acessórios:</span>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-primary)' }}>
                    {pendingOrders.map(o => (
                      <li key={o.id}><strong>{o.accessoryName}</strong></li>
                    ))}
                  </ul>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>Solicitante:</span>
                  <span>{pendingOrders[0].requestedBy}</span>
                </div>
              </div>
              <p style={{ marginTop: '0.85rem', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                Após confirmar, {pendingOrders.length > 1 ? 'os pedidos ficarão com status' : 'o pedido ficará com status'} <strong style={{ color: '#eab308' }}>Pendente</strong> até o Estoque registrá-lo.
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
        isOpen={modalState.isOpen && !isRemoveAction && modalState.action !== 'edit'}
        title={
          modalState.action === 'create' ? '📋 Criar Pedido' :
            modalState.action === 'arrive' ? '📦 Registrar Chegada' :
              modalState.action === 'withdraw' ? '✅ Registrar Retirada' :
                '⛔ Anular Pedido'
        }
        message={
          modalState.action === 'create' ? 'Confirmar a criação do(s) pedido(s)? A previsão de chegada será de 15 dias úteis a partir de hoje.' :
            modalState.action === 'arrive' ? 'Confirmar o registro de chegada do(s) acessório(s)?' :
              modalState.action === 'withdraw' ? 'Selecione o responsável que está retirando o(s) acessório(s) da lista abaixo:' :
                'Informe o motivo da anulação:'
        }
        type={modalState.action === 'annul' ? 'danger' : 'warning'}
        confirmText={
          modalState.action === 'create' ? 'Confirmar Criação' :
            modalState.action === 'arrive' ? 'Confirmar Chegada' :
              modalState.action === 'withdraw' ? 'Confirmar Retirada' :
                'Anular'
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
        message="Esta ação irá marcar o(s) pedido(s) como removido(s). O registro será preservado no arquivo Excel com data, hora e seu usuário identificados."
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

      {/* ── Modal de Edição ── */}
      <ConfirmModal
        isOpen={modalState.isOpen && modalState.action === 'edit'}
        title={modalState.isOsAction ? "Editar O.S." : "Editar Pedido"}
        message={
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem', textAlign: 'left' }}>
            {modalState.isOsAction && (
              <>
                <div className="input-group">
                  <label>Ordem de Serviço (O.S.)</label>
                  <input
                    type="text"
                    value={modalState.editData?.osNumber || ''}
                    onChange={(e) => setModalState({ ...modalState, editData: { ...modalState.editData, osNumber: e.target.value } })}
                  />
                </div>
                <div className="input-group">
                  <label>Nome do Cliente</label>
                  <input
                    type="text"
                    value={modalState.editData?.clientName || ''}
                    onChange={(e) => setModalState({ ...modalState, editData: { ...modalState.editData, clientName: e.target.value } })}
                  />
                </div>
                
                <div style={{ 
                  marginTop: '1rem', 
                  paddingTop: '1.5rem', 
                  borderTop: '1px dashed rgba(255,255,255,0.1)' 
                }}>
                  <div className="input-group" style={{ marginBottom: '1rem' }}>
                    <label>
                      Acessórios Adicionais 
                      <span style={{ textTransform: 'none', fontSize: '0.75rem', opacity: 0.7, marginLeft: '0.5rem' }}>(Opcional)</span>
                    </label>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect
                        value={currentAccessorySelection}
                        onChange={(e) => setCurrentAccessorySelection(e.target.value)}
                        options={accessories.map(acc => ({ value: acc.id, label: `${acc.factoryCode} - ${acc.commercialName}` }))}
                        placeholder="Buscar acessório..."
                      />
                    </div>
                    
                    <div style={{ width: '70px', position: 'relative', marginTop: '-18px' }}>
                      <div style={{
                        position: 'absolute', top: '0', left: '0', width: '100%', 
                        textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase'
                      }}>Qtd</div>
                      <input 
                        type="number" min="1" value={currentQuantity} onChange={(e) => setCurrentQuantity(e.target.value)}
                        style={{ 
                          width: '100%', padding: '0.7rem 0.5rem', borderRadius: '10px', 
                          border: '1px solid var(--border)', background: 'var(--bg-input)', 
                          color: 'var(--text-primary)', outline: 'none', textAlign: 'center', 
                          fontSize: '0.9rem', height: '42px', transition: 'border-color 0.2s',
                          marginTop: '18px'
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      />
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={handleAddAccessory} 
                      style={{ 
                        width: '42px', height: '42px', borderRadius: '10px', 
                        background: 'var(--accent)', color: '#020617', border: 'none', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        flexShrink: 0, transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(56, 189, 248, 0.2)'
                      }} 
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 15px rgba(56, 189, 248, 0.3)'; }} 
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(56, 189, 248, 0.2)'; }} 
                      title="Adicionar"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>

                  {selectedAccessories.length > 0 && (
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border)', 
                      borderRadius: '12px', padding: '0.5rem',
                      display: 'flex', flexDirection: 'column', gap: '0.4rem',
                      maxHeight: '180px', overflowY: 'auto'
                    }}>
                      {selectedAccessories.map(acc => (
                        <div key={acc.listId} style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.5rem 0.75rem', background: 'var(--bg-card)', 
                          borderRadius: '8px', fontSize: '0.85rem', 
                          border: '1px solid rgba(255,255,255,0.03)' 
                        }}>
                          <span style={{ color: 'var(--text-primary)' }}>
                            <strong style={{ color: 'var(--accent)', marginRight: '0.4rem', fontSize: '0.9rem' }}>{acc.quantity}x</strong> 
                            <strong style={{ letterSpacing: '0.03em' }}>{acc.factoryCode}</strong> 
                            <span style={{ color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>{acc.name}</span>
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveAccessory(acc.listId)} 
                            style={{ 
                              background: 'rgba(239, 68, 68, 0.1)', border: 'none', 
                              color: '#ef4444', cursor: 'pointer', display: 'flex', 
                              padding: '6px', borderRadius: '6px', transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {!modalState.isOsAction && (
              <div style={{ marginBottom: '1rem' }}>
                <CustomSelect
                  label="Acessório"
                  value={modalState.editData?.accessoryId || ''}
                  onChange={(e) => setModalState({ ...modalState, editData: { ...modalState.editData, accessoryId: e.target.value } })}
                  options={accessories.map(acc => ({ value: acc.id, label: `${acc.factoryCode} - ${acc.commercialName}` }))}
                  placeholder="Selecione..."
                />
              </div>
            )}
          </div>
        }
        type="edit"
        maxWidth="540px"
        confirmText="Salvar Alterações"
        cancelText="Cancelar"
        onConfirm={handleModalSubmit}
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
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <CustomSelect
                      label="Acessório *"
                      value={currentAccessorySelection}
                      onChange={(e) => setCurrentAccessorySelection(e.target.value)}
                      options={accessories.map(acc => ({
                        value: acc.id,
                        label: `${acc.factoryCode} - ${acc.commercialName}`
                      }))}
                      placeholder="Selecione para adicionar..."
                    />
                  </div>
                  <div style={{ width: '70px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>Qtd.</label>
                    <input 
                      type="number" 
                      min="1"
                      value={currentQuantity}
                      onChange={(e) => setCurrentQuantity(e.target.value)}
                      style={{ 
                        width: '100%', padding: '0.55rem', borderRadius: '8px', 
                        border: '1px solid var(--border)', background: 'var(--bg-input)', 
                        color: 'var(--text-primary)', outline: 'none' 
                      }}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleAddAccessory}
                    style={{
                      padding: '0.7rem 1.2rem', borderRadius: '10px',
                      background: 'var(--accent)', color: '#020617', fontWeight: 700,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                      fontSize: '0.9rem', transition: 'all 0.2s',
                      boxShadow: '0 4px 14px rgba(56, 189, 248, 0.2)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(56, 189, 248, 0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(56, 189, 248, 0.2)' }}
                  >
                    <Plus size={16} /> Adicionar
                  </button>
                </div>
                
                {/* Lista de acessórios adicionados */}
                {selectedAccessories.length > 0 && (
                  <div style={{
                    marginTop: '0.8rem', background: 'var(--bg-card)',
                    border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', paddingLeft: '0.3rem' }}>
                      Acessórios selecionados para esta O.S.:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {selectedAccessories.map(acc => (
                        <div key={acc.listId} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.4rem 0.6rem', background: 'var(--bg-input)', borderRadius: '6px',
                          fontSize: '0.8rem'
                        }}>
                          <span><strong style={{ color: 'var(--accent)' }}>{acc.quantity}x</strong> <strong>{acc.factoryCode}</strong> - {acc.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAccessory(acc.listId)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                            title="Remover da lista"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
            Gestão de O.S.
          </span>

          {/* Divisor */}
          <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Status da O.S.</label>
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
              <option value="all">Todas</option>
              <option value="1">Pendente</option>
              <option value="2">Em Andamento</option>
              <option value="3">Pronto (Chegada Completa)</option>
              <option value="4">Concluído</option>
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
            {filteredGroups.length} O.S. encontrada{filteredGroups.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tabela */}
        <div className="table-container">
          <table className="responsive-table order-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>O.S.</th>
                <th>Cliente / Acessórios</th>
                <th>Status</th>
                <th>Solicitado por</th>
                {(canAdvanceStatus || isAdmin) && (
                  <th style={{ textAlign: 'center' }}>Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{
                    textAlign: 'center', padding: '3rem',
                    color: 'var(--text-secondary)', fontSize: '0.9rem'
                  }}>
                    Nenhuma O.S. encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((osGroup, index) => (
                  <React.Fragment key={osGroup.osNumber}>
                    {/* Linha Principal da O.S. */}
                    <tr
                      className={`row-animate ${osGroup.isAllAnnulled || osGroup.isAllRemoved ? 'row-annulled' : ''}`}
                      style={{ animationDelay: `${index * 40}ms`, background: 'rgba(56, 189, 248, 0.03)' }}
                    >
                      <td style={{ fontSize: '0.83rem', fontWeight: 500, verticalAlign: 'middle' }}>
                        {formatDate(osGroup.requestedAt)}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => toggleOSVisibility(osGroup)} title="Ocultar/Exibir Acessórios" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                            { (osVisibility[osGroup.osNumber] !== undefined ? osVisibility[osGroup.osNumber] : !osGroup.isAllAnnulled) ? <EyeOff size={14}/> : <Eye size={14}/> }
                          </button>
                          <code style={{
                            background: 'var(--bg-input)', padding: '2px 8px',
                            borderRadius: '4px', fontSize: '0.8rem',
                            border: '1px solid var(--border)', fontWeight: 700
                          }}>
                            {osGroup.osNumber}
                          </code>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.9rem', verticalAlign: 'middle' }}>
                        {osGroup.clientName}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        {osGroup.isAllRemoved ? (
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertOctagon size={14}/> O.S. REMOVIDA
                          </span>
                        ) : osGroup.isAllAnnulled ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem' }}>O.S. ANULADA</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Por {osGroup.accessories[0]?.annulledBy} em {formatDate(osGroup.accessories[0]?.annulledAt)}</span>
                          </div>
                        ) : (
                          <span style={{
                            display: 'inline-block', padding: '0.2rem 0.5rem',
                            borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                            background: getStatusColor(osGroup.masterStatus) + '20',
                            color: getStatusColor(osGroup.masterStatus),
                            border: `1px solid ${getStatusColor(osGroup.masterStatus)}50`
                          }}>
                            {osGroup.masterStatus === 2 && osGroup.activeAccessories.some(a => a.status >= 3) ? 'Chegada Parcial' : getStatusLabel(osGroup.masterStatus)}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem', verticalAlign: 'middle' }}>
                        {osGroup.accessories[0]?.requestedBy}
                      </td>
                      {(canAdvanceStatus || isAdmin) && (
                        <td style={{ verticalAlign: 'middle' }}>
                          {!osGroup.isAllRemoved && (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                              {!osGroup.isAllAnnulled && (
                                <>
                                  {osGroup.masterStatus === 1 && (
                                    <button onClick={() => handleActionOpen(null, 'create', true, osGroup.osNumber)} className="btn-icon-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                      Criar Todos
                                    </button>
                                  )}
                                  {osGroup.masterStatus === 2 && (
                                    <button onClick={() => handleActionOpen(null, 'arrive', true, osGroup.osNumber)} className="btn-icon-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
                                      Chegou Tudo
                                    </button>
                                  )}
                                  {osGroup.masterStatus === 3 && (
                                    <button onClick={() => handleActionOpen(null, 'withdraw', true, osGroup.osNumber)} className="btn-icon-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' }}>
                                      Retirar Todos
                                    </button>
                                  )}
                                  {osGroup.masterStatus === 1 && (
                                    <button onClick={() => handleActionOpen(null, 'edit', true, osGroup.osNumber)} title="Editar O.S." style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer', color: '#f59e0b', padding: '5px', borderRadius: '6px' }}>
                                      <Edit3 size={14} />
                                    </button>
                                  )}
                                  <button onClick={() => handleActionOpen(null, 'annul', true, osGroup.osNumber)} title="Anular O.S." style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer', color: '#ef4444', padding: '5px', borderRadius: '6px' }}>
                                    <XCircle size={14} />
                                  </button>
                                </>
                              )}
                              {isAdmin && osGroup.isAllAnnulled && (
                                <button onClick={() => handleRemoveOrder(null, true, osGroup.osNumber)} title="Remover O.S. (Admin)" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer', color: '#6b7280', padding: '5px', borderRadius: '6px' }}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Sub-linhas para os acessórios */}
                    {(osVisibility[osGroup.osNumber] !== undefined ? osVisibility[osGroup.osNumber] : !osGroup.isAllAnnulled) && osGroup.unifiedAccessories.map((order, i) => {
                      const accDetails = accessories.find(a => a.id === order.accessoryId);
                      const factoryCode = accDetails?.factoryCode || 'Cód. não encontrado';
                      const rowId = Array.isArray(order.originalIds) ? order.originalIds[0] : order.id;
                      return (
                        <tr key={rowId} style={{ borderBottom: i === osGroup.unifiedAccessories.length - 1 ? '2px solid var(--border)' : '1px dotted var(--border)' }}>
                          <td colSpan="2" style={{ paddingLeft: '2.5rem', borderBottom: 'none', paddingTop: '0.7rem', paddingBottom: '0.7rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '12px', height: '12px', borderLeft: '2px solid var(--border)', borderBottom: '2px solid var(--border)', borderRadius: '0 0 0 4px', marginTop: '-12px' }} />
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--accent)', marginRight: '0.4rem' }}>[{order.totalQuantity || 1}x]</strong>
                                <strong style={{ color: 'var(--text-primary)', marginRight: '0.4rem' }}>{factoryCode}</strong>
                                {order.accessoryName}
                              </span>
                            </div>
                          </td>
                        <td colSpan="3" style={{ borderBottom: 'none', paddingTop: '0.7rem', paddingBottom: '0.7rem' }}>
                          {/* Progresso Individual e Histórico */}
                          {order.removed ? (
                            <div style={{ fontSize: '0.75rem', color: '#ef4444' }}><strong>Removido:</strong> {order.removedReason}</div>
                          ) : order.annulled ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>-</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              {/* Barra de progresso */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {[
                                  { s: 1, color: '#eab308', label: '⏳' },
                                  { s: 2, color: '#3b82f6', label: '🔄' },
                                  { s: 3, color: '#22c55e', label: '📦' },
                                  { s: 4, color: '#a855f7', label: '✅' }
                                ].map((step, idx) => (
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
                                    {idx < 3 && (
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
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {getStatusLabel(order.status)}
                              </div>
                              {/* Info extra */}
                              <button onClick={() => toggleDetails(rowId)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}><Info size={14}/></button>
                            </div>
                          )}
                          {/* Histórico Expandido */}
                          {expandedOrders[rowId] && !order.removed && !order.annulled && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'var(--bg-input)', padding: '0.5rem', borderRadius: '6px' }}>
                              {order.status >= 2 && order.createdBy && <div><strong>Criado:</strong> {formatDate(order.createdAt)} por {order.createdBy}</div>}
                              {order.lastEditedBy && <div><strong>Editado:</strong> por {order.lastEditedBy}</div>}
                              {order.status >= 3 && order.readyRegisteredBy && <div><strong>Chegou:</strong> {formatDate(order.readyRegisteredAt)} por {order.readyRegisteredBy}</div>}
                              {order.status === 4 && order.withdrawnBy && <div><strong>Retirado:</strong> {formatDate(order.withdrawnAt)} por {order.withdrawnBy}</div>}
                            </div>
                          )}
                        </td>
                        {(canAdvanceStatus || isAdmin) && (
                          <td style={{ borderBottom: 'none', paddingTop: '0.7rem', paddingBottom: '0.7rem', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {!order.removed && !order.annulled && (
                                  <>
                                    {order.status === 1 && (
                                      <button onClick={() => handleActionOpen(order.originalIds, 'create')} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer' }}><Plus size={10} style={{display:'inline', marginBottom:'-2px'}}/> Criar</button>
                                    )}
                                    {order.status === 2 && (
                                      <button onClick={() => handleActionOpen(order.originalIds, 'arrive')} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)', cursor: 'pointer' }}><Clock size={10} style={{display:'inline', marginBottom:'-2px'}}/> Chegou</button>
                                    )}
                                    {order.status === 3 && (
                                      <button onClick={() => handleActionOpen(order.originalIds, 'withdraw')} style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)', cursor: 'pointer' }}><UserCheck size={10} style={{display:'inline', marginBottom:'-2px'}}/> Retirar</button>
                                    )}
                                    {order.status === 1 && (
                                      <button 
                                        onClick={() => handleActionOpen(order.originalIds, 'edit')} 
                                        title="Editar Acessório" 
                                        className="btn-icon-warning" 
                                        style={{ width: '24px', height: '24px', padding: 0 }}
                                      >
                                        <Edit3 size={12} />
                                      </button>
                                    )}
                                  </>
                                )}
                                {isAdmin && order.annulled && !order.removed && (
                                  <button 
                                    onClick={() => handleRemoveOrder(order.originalIds)} 
                                    title="Remover Acessório" 
                                    className="btn-icon-danger" 
                                    style={{ width: '24px', height: '24px', padding: 0 }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                          </td>
                        )}
                      </tr>
                    )})}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)'
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              Anterior
            </button>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Página <span style={{ color: 'var(--accent)' }}>{currentPage}</span> de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  )
}