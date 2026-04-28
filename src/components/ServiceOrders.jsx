import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FileText, Plus, Download, Eye, CheckCircle2, AlertCircle, Trash2, XCircle, Search, FileDown, X, ChevronDown, UploadCloud, DollarSign, Package, Edit, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveServiceOrderContent, getServiceOrderContent } from '../utils/db';
import ConfirmModal from './ConfirmModal';

const ServiceOrders = ({ serviceOrders, setServiceOrders, accessories, movements, setMovements, currentUser, showAlert }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingPdf, setViewingPdf] = useState(null); // Estado para o popup do PDF
  const [searchTerm, setSearchTerm] = useState('');
  const [newOrder, setNewOrder] = useState({
    osNumber: '',
    clientName: '',
    clientPhone: '',
    items: [], // Array de objetos { code, delivery }
    value: '',
    file: null,
    fileName: '',
    withdrawalDate: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })()
  });
  const [currentDelivery, setCurrentDelivery] = useState('');
  const [currentQty, setCurrentQty] = useState(1); // Nova state para quantidade no form
  const [tempSelectedCode, setTempSelectedCode] = useState(''); // Código selecionado pendente de delivery
  const [isAccDropdownOpen, setIsAccDropdownOpen] = useState(false);
  const [accSearchTerm, setAccSearchTerm] = useState('');
  const accDropdownRef = useRef(null);
  const kpiGridRef = useRef(null); // Ref para os cards de KPI

  const [justificationModal, setJustificationModal] = useState({
    isOpen: false,
    orderId: null,
    action: '' // 'annul' or 'delete'
  });
  const [justification, setJustification] = useState('');

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    orderId: null
  });
  const [errorDescription, setErrorDescription] = useState('');
  const [confirmCheckIn, setConfirmCheckIn] = useState({ isOpen: false, orderId: null });

  // Estados para Edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [alertHistoryModal, setAlertHistoryModal] = useState({ isOpen: false, order: null });
  const [statusFilter, setStatusFilter] = useState(null); // Estado para filtrar por status (Regulares, Pendentes, etc)
  const [dateFilter, setDateFilter] = useState(new Date().toLocaleDateString('sv-SE')); // Filtro por data de anexo (Padrão: Hoje)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Fechar dropdown de acessórios
      if (accDropdownRef.current && !accDropdownRef.current.contains(event.target)) {
        setIsAccDropdownOpen(false);
      }

      // Limpar filtro de status se clicar fora da área de KPIs
      if (statusFilter && kpiGridRef.current && !kpiGridRef.current.contains(event.target)) {
        // Opcional: verificar se o clique não foi em elementos que devem manter o filtro (ex: botões de ação)
        // Mas o pedido foi "clicar fora do card remove o filtro"
        setStatusFilter(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusFilter]);

  const filteredAccessories = useMemo(() => {
    if (!accSearchTerm) return accessories;
    const lower = accSearchTerm.toLowerCase();
    return accessories.filter(acc =>
      acc.factoryCode.toLowerCase().includes(lower) ||
      acc.commercialName.toLowerCase().includes(lower)
    );
  }, [accessories, accSearchTerm]);

  // Formatação de Moeda
  const formatCurrency = (value) => {
    const num = value.replace(/\D/g, '');
    return (Number(num) / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleValueChange = (e) => {
    const formatted = formatCurrency(e.target.value);
    setNewOrder({ ...newOrder, value: formatted });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showAlert('Erro', 'Por favor, selecione apenas arquivos PDF.', 'danger');
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2MB
        showAlert('Erro', 'O arquivo excede o limite de 2MB.', 'danger');
        return;
      }

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        setNewOrder({
          ...newOrder,
          file: readerEvent.target.result,
          fileName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Função de Reconciliação (Vinculação automática) - Motor baseado em grupos
  const performReconciliation = (movementsArray, orderId, items, withdrawalDate, osNumber) => {
    let updatedMovements = [...movementsArray];

    // Normaliza a OS do formulário (null = avulso/S/N)
    const rawFormOS = String(osNumber || '').trim().toUpperCase();
    const osInForm = (rawFormOS && rawFormOS !== '-' && rawFormOS !== 'S/N' && rawFormOS !== 'AVULSO')
      ? String(osNumber).trim().toLowerCase().replace(/^0+/, '') : null;

    // 1. Pool de itens do PDF (código normalizado + quantidade robusta)
    const pdfPool = items.map(item => {
      const rawQty = String(item.quantity || 1);
      const parsedQty = parseInt(rawQty.replace(/\D/g, '')) || 1;
      return {
        code: String(item.code || '').trim().toLowerCase(),
        quantity: parsedQty
      };
    });

    // 2. Limpa vínculos anteriores desta O.S. para re-reconciliar do zero
    updatedMovements = updatedMovements.map(m => {
      if (m.attachmentId === orderId) {
        return { ...m, attachmentStatus: 'pending', attachmentId: null, attachedAt: null, attachedBy: null };
      }
      return m;
    });

    // 3. Filtra e ordena os movimentos elegíveis cronologicamente
    const movementResults = {};
    const candidateMovements = updatedMovements.filter(m => {
      if (m.isDeleted || (m.type && m.type !== 'checkout') || m.annulled) return false;
      if (m.attachmentStatus === 'ok' && m.attachmentId && m.attachmentId !== orderId) return false;
      if (!m.timestamp || m.timestamp < '2026-04-27') return false;

      const d = new Date(m.timestamp);
      const mDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return mDate === withdrawalDate;
    }).sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (tA !== tB) return tA - tB;
      return String(a.id).localeCompare(String(b.id));
    });

    let availablePool = [...pdfPool];

    // 4. Cada movimento é verificado em DUAS PASSAGENS.
    const processPass = (isExactOnly) => {
      candidateMovements.forEach(m => {
        if (movementResults[m.id] === 'ok') return;

        const mOS = (m.soNumber && String(m.soNumber).trim() !== '-' && String(m.soNumber).trim().toUpperCase() !== 'S/N' && String(m.soNumber).trim().toUpperCase() !== 'AVULSO')
          ? String(m.soNumber).trim().toLowerCase().replace(/^0+/, '') : null;

        // Regra de O.S. idêntica ao App.jsx
        if (mOS !== null) {
          if (mOS !== osInForm) {
            movementResults[m.id] = 'pending';
            return;
          }
        }
        // Se mOS é null (Avulso), ele pode casar com qualquer OS do PDF

        const mCode = accessories.find(acc => String(acc.id) === String(m.accessoryId))?.factoryCode?.trim().toLowerCase();
        if (!mCode) { movementResults[m.id] = 'pending'; return; }

        const rawMQty = String(m.quantity || 1);
        const mQty = parseInt(rawMQty.replace(/\D/g, '')) || 1;

        const pdfIdx = availablePool.findIndex(p => {
          if (p.code !== mCode) return false;
          return isExactOnly ? p.quantity === mQty : p.quantity >= mQty;
        });

        if (pdfIdx !== -1) {
          const matchedPdf = availablePool[pdfIdx];
          matchedPdf.quantity -= mQty;
          if (matchedPdf.quantity <= 0) {
            availablePool.splice(pdfIdx, 1);
          }
          movementResults[m.id] = 'ok';
        } else if (!isExactOnly) {
          movementResults[m.id] = 'pending';
        }
      });
    };

    processPass(true);  // Passagem 1: Matches exatos
    processPass(false); // Passagem 2: Matches por saldo

    // 5. Aplica o resultado a cada movimento
    updatedMovements = updatedMovements.map(m => {
      const result = movementResults[m.id];
      if (result === 'ok') {
        return {
          ...m,
          attachmentStatus: 'ok',
          attachmentId: orderId,
          attachedAt: new Date().toISOString(),
          attachedBy: currentUser.username,
          withdrawalDate: withdrawalDate
        };
      }
      if (result === 'pending') {
        return { ...m, attachmentStatus: 'pending', attachmentId: null };
      }
      return m;
    });

    return { updatedMovements, count: Object.values(movementResults).filter(r => r === 'ok').length };
  };


  const handleEdit = (order) => {
    setEditingOrder({ ...order });
    setIsEditModalOpen(true);
  };

  const handleSaveOrder = async () => {
    const { osNumber, clientName, clientPhone, items, value, file, withdrawalDate } = newOrder;

    const missingFields = [];
    if (!osNumber) missingFields.push("N° da O.S.");
    if (!clientName) missingFields.push("Nome do Cliente");
    if (!clientPhone) missingFields.push("Telefone do Cliente");
    if (items.length === 0) missingFields.push("Pelo menos um item");
    if (!value || value === 'R$ 0,00') missingFields.push("Valor da Venda");
    if (!file) missingFields.push("Arquivo PDF");

    if (missingFields.length > 0) {
      showAlert('Campos Obrigatórios', `Por favor, preencha: ${missingFields.join(', ')}`, 'warning');
      return;
    }

    const orderId = Date.now().toString();
    const orderData = {
      id: orderId,
      osNumber,
      clientName,
      clientPhone,
      items,
      value,
      withdrawalDate,
      status: 'pendente',
      attachedBy: currentUser.username,
      attachedAt: new Date().toISOString(),
      checkIn: null,
      alerts: [],
      history: []
    };

    try {
      await saveServiceOrderContent(orderId, file);

      const { updatedMovements, count } = performReconciliation(movements, orderId, items, withdrawalDate, osNumber);
      if (count > 0) setMovements(updatedMovements);

      setServiceOrders(prev => [orderData, ...prev]);
      setIsModalOpen(false);
      setNewOrder({ osNumber: '', clientName: '', clientPhone: '', items: [], value: '', file: null, fileName: '', withdrawalDate: new Date().toLocaleDateString('sv-SE') });
      setCurrentDelivery('');
      setTempSelectedCode('');
      showAlert('Sucesso', `O.S. anexada e ${count} itens vinculados!`, 'success');
    } catch (error) {
      showAlert('Erro', 'Falha ao salvar o arquivo.', 'danger');
    }
  };

  const handleUpdateOrder = async () => {
    const { osNumber, clientName, clientPhone, items, value, withdrawalDate } = editingOrder;

    const missingFields = [];
    if (!osNumber) missingFields.push("N° da O.S.");
    if (!clientName) missingFields.push("Nome do Cliente");
    if (!clientPhone) missingFields.push("Telefone do Cliente");
    if (items.length === 0) missingFields.push("Pelo menos um item");
    if (!value || value === 'R$ 0,00') missingFields.push("Valor da Venda");

    if (missingFields.length > 0) {
      showAlert('Campos Obrigatórios', `Por favor, preencha: ${missingFields.join(', ')}`, 'warning');
      return;
    }

    try {
      if (editingOrder.file && editingOrder.file.startsWith('data:')) {
        await saveServiceOrderContent(editingOrder.id, editingOrder.file);
      }

      // Re-reconciliação ao editar
      const { updatedMovements, count } = performReconciliation(movements, editingOrder.id, items, withdrawalDate, osNumber);
      if (count > 0) setMovements(updatedMovements);

      setServiceOrders(prev => prev.map(o => {
        if (o.id === editingOrder.id) {
          const historyEntry = {
            action: 'Edição de Informações',
            by: currentUser.username,
            at: new Date().toISOString()
          };
          const { file, ...orderDataWithoutFile } = editingOrder;
          return {
            ...orderDataWithoutFile,
            history: [historyEntry, ...(o.history || [])]
          };
        }
        return o;
      }));
      setIsEditModalOpen(false);
      setEditingOrder(null);
      showAlert('Sucesso', 'Registro atualizado e pendências re-avaliadas!', 'success');
    } catch (error) {
      showAlert('Erro', 'Falha ao atualizar o registro.', 'danger');
    }
  };

  const handleViewPdf = async (id) => {
    const content = await getServiceOrderContent(id);
    if (content) {
      setViewingPdf(content);
    } else {
      showAlert('Erro', 'Conteúdo não encontrado.', 'danger');
    }
  };

  const handleDownloadPdf = async (id, osNumber) => {
    const content = await getServiceOrderContent(id);
    if (content) {
      const link = document.createElement('a');
      link.href = content;
      link.download = `OS_${osNumber}.pdf`;
      link.click();
    }
  };

  const handleCheckIn = (id) => {
    const order = serviceOrders.find(o => o.id === id);
    const hasActiveAlert = order.alerts?.some(a => a.status === 'ativo');
    if (hasActiveAlert) {
      showAlert('Bloqueado', 'Esta OS possui um alerta ativo. Corrija o erro antes do check-in.', 'warning');
      return;
    }
    setConfirmCheckIn({ isOpen: true, orderId: id });
  };

  const processCheckIn = (id) => {
    setServiceOrders(prev => prev.map(o => {
      if (o.id === id) {
        return {
          ...o,
          checkIn: {
            user: currentUser.username,
            at: new Date().toISOString()
          }
        };
      }
      return o;
    }));
    setConfirmCheckIn({ isOpen: false, orderId: null });
    showAlert('Sucesso', 'Check-in realizado!', 'success');
  };

  const handleAlert = () => {
    if (!errorDescription) return;
    setServiceOrders(prev => prev.map(o => {
      if (o.id === alertModal.orderId) {
        const newAlert = {
          description: errorDescription,
          author: currentUser.username,
          timestamp: new Date().toISOString(),
          status: 'ativo'
        };
        return {
          ...o,
          alerts: [newAlert, ...(o.alerts || [])]
        };
      }
      return o;
    }));
    setAlertModal({ isOpen: false, orderId: null });
    setErrorDescription('');
    showAlert('Alerta Enviado', 'O erro foi reportado aos responsáveis.', 'success');
  };

  const handleSingleCorrection = (orderId, alertTimestamp) => {
    setServiceOrders(prev => {
      return prev.map(o => {
        if (o.id === orderId) {
          const updatedAlerts = (o.alerts || []).map(a =>
            a.timestamp === alertTimestamp ? {
              ...a,
              status: 'corrigido',
              resolvedBy: currentUser.username,
              resolvedAt: new Date().toISOString()
            } : a
          );

          // Atualiza o modal de histórico se estiver aberto
          if (alertHistoryModal.isOpen && alertHistoryModal.order?.id === orderId) {
            setAlertHistoryModal(m => ({
              ...m,
              order: { ...m.order, alerts: updatedAlerts }
            }));
          }

          return { ...o, alerts: updatedAlerts };
        }
        return o;
      });
    });
    showAlert('Correção Registrada', 'O erro foi marcado como corrigido.', 'success');
  };

  const getOrderStatusDetails = (alerts = []) => {
    if (alerts.length === 0) return { label: 'Regular', class: 'regular', color: '#38bdf8' };

    const active = alerts.filter(a => a.status === 'ativo').length;
    const resolved = alerts.filter(a => a.status === 'corrigido').length;

    if (active > 0 && resolved === 0) return { label: 'Pendente', class: 'pendente', color: '#ef4444' };
    if (active > 0 && resolved > 0) return { label: 'Parcialmente Corrigido', class: 'parcial', color: '#f59e0b' };
    if (active === 0 && resolved > 0) return { label: 'Concluído', class: 'concluido', color: '#10b981' };

    return { label: 'Regular', class: 'regular', color: '#38bdf8' };
  };

  const handleCorrection = (id) => {
    setServiceOrders(prev => prev.map(o => {
      if (o.id === id) {
        const updatedAlerts = (o.alerts || []).map(a =>
          a.status === 'ativo' ? {
            ...a,
            status: 'corrigido',
            resolvedBy: currentUser.username,
            resolvedAt: new Date().toISOString()
          } : a
        );
        return {
          ...o,
          status: 'corrigido',
          alerts: updatedAlerts
        };
      }
      return o;
    }));
    showAlert('Sucesso', 'Informações corrigidas e alerta resolvido.', 'success');
  };

  const handleActionWithJustification = () => {
    if (!justification) return;

    const { orderId, action } = justificationModal;
    setServiceOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        if (action === 'annul') {
          return {
            ...o,
            status: 'anulado',
            annulledBy: currentUser.username,
            annulledAt: new Date().toISOString(),
            justification
          };
        }
        if (action === 'delete') {
          return {
            ...o,
            status: 'removido',
            removedBy: currentUser.username,
            removedAt: new Date().toISOString(),
            justification,
            hidden: true
          };
        }
      }
      return o;
    }));
    setJustificationModal({ isOpen: false, orderId: null, action: '' });
    setJustification('');
    showAlert('Concluído', `OS ${action === 'annul' ? 'Anulada' : 'Removida'} com sucesso.`, 'success');
  };


  const filteredOrders = serviceOrders
    .filter(o => {
      // 1. Filtro Oculto
      if (o.hidden) return false;

      // 2. Filtro de Status KPI
      if (statusFilter) {
        const details = getOrderStatusDetails(o.alerts);
        const filterMap = {
          'Regulares': 'Regular',
          'Pendentes': 'Pendente',
          'Parciais': 'Parcialmente Corrigido',
          'Concluídos': 'Concluído'
        };
        if (details.label !== filterMap[statusFilter]) return false;
      }

      // 3. Filtro de Data
      if (dateFilter) {
        const orderDate = new Date(o.attachedAt).toLocaleDateString('sv-SE');
        if (orderDate !== dateFilter) return false;
      }

      // 4. Filtro de Busca Texto
      const searchLower = searchTerm.toLowerCase();
      return (
        o.osNumber.toLowerCase().includes(searchLower) ||
        o.clientName.toLowerCase().includes(searchLower) ||
        o.items?.some(item =>
          item.code.toLowerCase().includes(searchLower) ||
          item.delivery.toLowerCase().includes(searchLower)
        )
      );
    })
    .sort((a, b) => new Date(b.attachedAt) - new Date(a.attachedAt));

  const canCheckIn = currentUser.role === 'admin' || currentUser.sector === 'estoque' || currentUser.sector === 'Estoque';
  const isAdmin = currentUser.role === 'admin';
  const canManage = currentUser.role === 'admin' || currentUser.sector === 'atendimento';
  const canAlertError = currentUser.role === 'admin' || currentUser.sector === 'estoque' || currentUser.sector === 'Estoque';

  return (
    <div className="orders-container">
      <div className="section-header">
        <div className="section-title">
          <FileText className="title-icon" />
          <div>
            <h2>Anexos de OS</h2>
            <p>Gerencie os arquivos de Ordens de Serviço e fluxos de conferência</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Novo Anexo PDF
        </button>
      </div>

      <div
        className="status-summary-grid"
        ref={kpiGridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        {[
          { label: 'Regulares', count: serviceOrders.filter(o => !o.hidden && !o.alerts?.length).length, icon: CheckCircle2, color: '#38bdf8' },
          {
            label: 'Pendentes', count: serviceOrders.filter(o => {
              if (o.hidden) return false;
              const details = getOrderStatusDetails(o.alerts);
              return details.label === 'Pendente';
            }).length, icon: AlertCircle, color: '#ef4444'
          },
          {
            label: 'Parciais', count: serviceOrders.filter(o => {
              if (o.hidden) return false;
              const details = getOrderStatusDetails(o.alerts);
              return details.label === 'Parcialmente Corrigido';
            }).length, icon: AlertCircle, color: '#f59e0b'
          },
          {
            label: 'Concluídos', count: serviceOrders.filter(o => {
              if (o.hidden) return false;
              const details = getOrderStatusDetails(o.alerts);
              return details.label === 'Concluído';
            }).length, icon: CheckCircle2, color: '#10b981'
          }
        ].map((kpi, kIdx) => {
          const isActive = statusFilter === kpi.label;
          return (
            <div
              key={kIdx}
              className={`status-kpi-card glass-effect ${isActive ? 'active-filter' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setStatusFilter(isActive ? null : kpi.label);
              }}
              style={{
                borderLeft: `4px solid ${kpi.color}`,
                padding: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                background: isActive ? `${kpi.color}20` : 'rgba(255,255,255,0.03)',
                borderColor: isActive ? kpi.color : 'rgba(255,255,255,0.05)',
                transform: isActive ? 'translateY(-2px)' : 'none',
                boxShadow: isActive ? `0 8px 24px -8px ${kpi.color}40` : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', opacity: isActive ? 1 : 0.6, display: 'block', marginBottom: '4px', color: isActive ? kpi.color : 'inherit' }}>
                  {kpi.label}
                </span>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>
                  {kpi.count}
                </span>
              </div>
              <kpi.icon size={28} style={{ color: kpi.color, opacity: isActive ? 1 : 0.4, transition: 'all 0.3s ease' }} />
            </div>
          );
        })}
      </div>

      <div className="search-bar-container" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-input" style={{ flex: 1, minWidth: '250px' }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por OS, Cliente ou Delivery..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="date-filter-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Filtrar por Data:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
          />
          <button
            className="btn-today"
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              color: 'var(--accent)',
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
            onClick={() => setDateFilter(new Date().toLocaleDateString('sv-SE'))}
          >
            Hoje
          </button>
        </div>

        {(searchTerm || dateFilter || statusFilter) && (
          <button
            className="btn-text"
            style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.5rem 1rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px' }}
            onClick={() => {
              setSearchTerm('');
              setDateFilter('');
              setStatusFilter(null);
            }}
          >
            <X size={16} /> Limpar Filtros
          </button>
        )}
      </div>

      <div className="os-cards-list">
        {filteredOrders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem', opacity: 0.6 }}>
            <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
            <p>Nenhum anexo encontrado.</p>
          </div>
        ) : (
          filteredOrders.map(o => (
            <div key={o.id} className={`os-card ${o.status === 'anulado' ? 'row-annulled' : ''}`}>
              {/* Identificação e Badge */}
              <div className="os-card-id">
                <span className="os-badge">{o.osNumber}</span>
                {o.status === 'anulado' && <span className="status-tag danger">ANULADA</span>}
              </div>

              {/* Conteúdo Principal */}
              <div className="os-card-content">
                <strong>{o.clientName}</strong>
                <div className="os-card-chips">
                  {o.items?.map((item, idx) => (
                    <span key={idx} className="chip-item paired">
                      <span className="q" style={{ fontWeight: 800, color: 'var(--accent)', marginRight: '4px' }}>{item.quantity || 1}x</span>
                      <span className="c">{item.code}</span>
                      <span className="sep">•</span>
                      <span className="d">{item.delivery}</span>
                    </span>
                  ))}
                </div>
                {o.clientPhone && (
                  <div className="os-card-phone" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0', opacity: 0.8 }}>
                    📞 {o.clientPhone}
                  </div>
                )}
                <div className="os-card-value">Venda: {o.value}</div>
              </div>

              {/* Anexo e Auditoria */}
              <div className="os-card-attachment">
                <div className="audit-info-compact">
                  <span className="user">Por: {o.attachedBy}</span>
                  <span className="date">Anexado em: {new Date(o.attachedAt).toLocaleString('pt-BR')}</span>
                  {o.withdrawalDate && (
                    <span className="date" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>
                      Data Ref: {o.withdrawalDate.split('-').reverse().join('/')}
                    </span>
                  )}
                </div>
                <div className="attachment-btns">
                  <button
                    className="btn-action-icon"
                    title="Ver PDF"
                    onClick={() => handleViewPdf(o.id)}
                  >
                    <Eye size={18} />
                  </button>
                  <button className="btn-action-icon" title="Baixar" onClick={() => handleDownloadPdf(o.id, o.osNumber)}>
                    <Download size={18} />
                  </button>
                </div>
              </div>

              {/* Status de Fluxo (Check-in e Alertas) */}
              <div className="os-card-status">
                <div className="status-badge-container">
                  {(() => {
                    const details = getOrderStatusDetails(o.alerts);
                    return (
                      <span className={`status-badge ${details.class}`} style={{ color: details.color, borderColor: `${details.color}40`, background: `${details.color}15` }}>
                        <strong>{details.label}</strong>
                      </span>
                    );
                  })()}
                </div>

                {(o.checkIn || o.checkin) ? (
                  <div className="checkin-done">
                    <CheckCircle2 size={18} />
                    <div className="audit-info-compact">
                      <span className="user">{(o.checkIn || o.checkin).user}</span>
                      <span className="date">{new Date((o.checkIn || o.checkin).at || (o.checkIn || o.checkin).timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                ) : (
                  canCheckIn && (
                    <button className="btn-validate" onClick={() => handleCheckIn(o.id)} style={{ padding: '0.6rem 1.2rem', width: '100%', minWidth: '140px' }}>
                      Validar PDF
                    </button>
                  )
                )}

                <div className="cell-status">
                  {o.alerts && o.alerts.length > 0 && (
                    <div
                      className={`alert-icon-btn clickable ${o.alerts.some(a => a.status === 'ativo') ? 'ativo' : 'corrigido'}`}
                      onClick={() => setAlertHistoryModal({ isOpen: true, order: o })}
                      title="Clique para ver o Histórico de Alertas"
                    >
                      <AlertCircle size={22} />
                      <span className="alert-count-badge">{o.alerts.length}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações de Gestão */}
              <div className="os-card-actions">
                <div className="action-group">
                  {canAlertError && (
                    <button
                      className="btn-icon-warning"
                      title="Alertar Erro"
                      onClick={() => setAlertModal({ isOpen: true, orderId: o.id })}
                    >
                      <AlertCircle size={18} />
                    </button>
                  )}

                  {o.alerts?.some(a => a.status === 'ativo') && canManage && (
                    <button
                      className="btn-icon-success"
                      title="Corrigir"
                      onClick={() => handleCorrection(o.id)}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}

                  {canManage && (
                    <button
                      className="btn-icon-edit"
                      title="Editar Registro"
                      onClick={() => handleEdit(o)}
                    >
                      <Edit size={18} />
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <div className="action-group">
                    <button
                      className="btn-icon-danger"
                      title="Anular"
                      onClick={() => setJustificationModal({ isOpen: true, orderId: o.id, action: 'annul' })}
                    >
                      <XCircle size={18} />
                    </button>
                    <button
                      className="btn-icon-danger"
                      title="Remover"
                      onClick={() => setJustificationModal({ isOpen: true, orderId: o.id, action: 'delete' })}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <h3>Novo Anexo de OS</h3>
              <p>Preencha os dados da venda e anexe o arquivo PDF</p>
            </div>
            <div className="modal-body" style={{ marginTop: '1rem', paddingBottom: '4rem' }}>
              <div className="grid-2">
                <div className="input-group">
                  <label>N° da Ordem de Serviço</label>
                  <input
                    type="text"
                    value={newOrder.osNumber}
                    onChange={(e) => setNewOrder({ ...newOrder, osNumber: e.target.value })}
                    placeholder="Ex: 450982"
                  />
                </div>
                <div className="input-group">
                  <label>Data da Retirada (Saída)</label>
                  <input
                    type="date"
                    value={newOrder.withdrawalDate}
                    onChange={(e) => setNewOrder({ ...newOrder, withdrawalDate: e.target.value })}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', marginTop: '4px', opacity: 0.8 }}>
                    Esta data será usada para localizar e abater a pendência.
                  </span>
                </div>
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label>Nome do Cliente</label>
                  <input
                    type="text"
                    value={newOrder.clientName}
                    onChange={(e) => setNewOrder({ ...newOrder, clientName: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="input-group">
                  <label>Telefone do Cliente (DDD + Número)</label>
                  <input
                    type="text"
                    value={newOrder.clientPhone}
                    onChange={(e) => setNewOrder({ ...newOrder, clientPhone: e.target.value.replace(/\D/g, '') })}
                    placeholder="Ex: 11999999999"
                    maxLength="11"
                  />
                </div>
              </div>
              <div className="paired-input-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>1. Selecione a Peça</label>
                  <div className="searchable-select-container" ref={accDropdownRef}>
                    <div
                      className={`search-select-trigger ${isAccDropdownOpen ? 'open' : ''} ${tempSelectedCode ? 'selected' : ''}`}
                      onClick={() => setIsAccDropdownOpen(!isAccDropdownOpen)}
                    >
                      <Package size={16} />
                      <span>{tempSelectedCode || (isAccDropdownOpen ? 'Pesquisar...' : 'Selecionar código...')}</span>
                      <ChevronDown size={14} className={`chevron ${isAccDropdownOpen ? 'rotated' : ''}`} />
                    </div>

                    {isAccDropdownOpen && (
                      <div className="search-select-dropdown glass-effect">
                        <div className="search-input-wrapper">
                          <Search size={14} />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Buscar código ou nome..."
                            value={accSearchTerm}
                            onChange={(e) => setAccSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="options-list custom-scrollbar">
                          {filteredAccessories.length === 0 ? (
                            <div className="option-empty">Nenhum acessório encontrado</div>
                          ) : (
                            filteredAccessories.map(acc => (
                              <div
                                key={acc.id}
                                className="option-item"
                                onClick={() => {
                                  setTempSelectedCode(acc.factoryCode);
                                  setIsAccDropdownOpen(false);
                                  setAccSearchTerm('');
                                }}
                              >
                                <span className="acc-code">{acc.factoryCode}</span>
                                <span className="acc-name">{acc.commercialName}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>2. Digite a Delivery</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      maxLength="10"
                      value={currentDelivery}
                      onChange={(e) => setCurrentDelivery(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000000000"
                    />
                    <div style={{ minWidth: '65px', flex: '0 0 65px' }}>
                      <input
                        type="number"
                        min="1"
                        value={currentQty}
                        onChange={(e) => setCurrentQty(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ textAlign: 'center', padding: '0.9rem 0.2rem' }}
                        title="Quantidade"
                      />
                    </div>
                    <button
                      className="btn-add-tag"
                      title="Adicionar Conjunto"
                      disabled={!tempSelectedCode || currentDelivery.length !== 10}
                      onClick={() => {
                        const newItem = { code: tempSelectedCode, delivery: currentDelivery, quantity: currentQty };
                        if (!newOrder.items.some(i => i.code === newItem.code && i.delivery === newItem.delivery)) {
                          setNewOrder({ ...newOrder, items: [...newOrder.items, newItem] });
                          setTempSelectedCode('');
                          setCurrentDelivery('');
                          setCurrentQty(1);
                        } else {
                          showAlert('Atenção', 'Este par (Código + Delivery) já foi adicionado.', 'warning');
                        }
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Itens Adicionados ({newOrder.items.length})</label>
                <div className="tags-container paired-tags" style={{ minHeight: '40px', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                  {newOrder.items.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.5 }}>Nenhum item adicionado ainda...</span>}
                  {newOrder.items.map((item, idx) => (
                    <span key={idx} className="tag-chip paired">
                      <span className="qty" style={{ background: 'var(--accent)', color: '#000', padding: '0 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem' }}>{item.quantity || 1}x</span>
                      <span className="code">{item.code}</span>
                      <span className="separator">•</span>
                      <span className="delivery">{item.delivery}</span>
                      <X size={14} onClick={() => setNewOrder({ ...newOrder, items: newOrder.items.filter((_, i) => i !== idx) })} />
                    </span>
                  ))}
                </div>
              </div>
              <div className="row">
                <div className="input-group">
                  <label>Valor da Venda</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input
                      type="text"
                      style={{ paddingLeft: '32px' }}
                      value={newOrder.value}
                      onChange={handleValueChange}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label>Arquivo PDF (Max 2MB)</label>
                  <div className="premium-file-upload">
                    <input
                      type="file"
                      id="pdf-upload"
                      accept=".pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="pdf-upload" className="dropzone-area">
                      {newOrder.fileName ? (
                        <div className="file-info-premium">
                          <FileText className="accent" size={20} />
                          <span className="file-name-text">{newOrder.fileName}</span>
                          <button
                            className="btn-clear-file"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewOrder({ ...newOrder, file: null, fileName: '' });
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="dropzone-content">
                          <UploadCloud size={24} />
                          <span>Clique para anexar o PDF</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleSaveOrder}>Salvar Anexo</button>
              <button className="btn-cancel" style={{ width: '100%' }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {justificationModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '400px' }}>
            <button className="modal-close-btn" onClick={() => setJustificationModal({ isOpen: false, orderId: null, action: '' })}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <h3>{justificationModal.action === 'annul' ? 'Anular Ordem' : 'Remover do Histórico'}</h3>
              <p>Esta ação exige uma justificativa obrigatória.</p>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva o motivo..."
              />
            </div>
            <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleActionWithJustification}>
                Confirmar {justificationModal.action === 'annul' ? 'Anulação' : 'Remoção'}
              </button>
              <button className="btn-danger" style={{ width: '100%' }} onClick={() => setJustificationModal({ isOpen: false, orderId: null, action: '' })}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {alertModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '400px' }}>
            <button className="modal-close-btn" onClick={() => setAlertModal({ isOpen: false, orderId: null })}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <h3>Alertar Erro</h3>
              <p>Descreva o erro encontrado nesta OS para correção.</p>
            </div>

            <div className="pre-defined-errors">
              <button
                type="button"
                className="error-chip"
                onClick={() => setErrorDescription("O.S INCORRETA")}
              >
                O.S INCORRETA
              </button>
              <button
                type="button"
                className="error-chip"
                onClick={() => setErrorDescription("DELIVERY INCORRETA")}
              >
                DELIVERY INCORRETA
              </button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <textarea
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                placeholder="Descreva o erro encontrado nesta OS..."
              />
            </div>
            <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleAlert}>Enviar Alerta</button>
              <button className="btn-danger" style={{ width: '100%' }} onClick={() => setAlertModal({ isOpen: false, orderId: null })}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Visualização de PDF (Popup) */}
      {viewingPdf && (
        <div className="modal-backdrop pdf-viewer-overlay">
          <div className="modal-card pdf-viewer-content glass-effect">
            <button className="modal-close-btn" onClick={() => setViewingPdf(null)}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <h3>Visualização da Ordem de Serviço</h3>
              <p>Confira os detalhes e informações do documento anexado</p>
            </div>
            <div className="pdf-body">
              <iframe src={viewingPdf} title="PDF OS" width="100%" height="100%" frameBorder="0"></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Registro */}
      {isEditModalOpen && editingOrder && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <button className="modal-close-btn" onClick={() => setIsEditModalOpen(false)}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <h3>Editar Registro de OS</h3>
              <p>Alterar informações básicas do registro</p>
            </div>
            <div className="modal-body" style={{ marginTop: '1rem', paddingBottom: '4rem' }}>
              <div className="grid-2">
                <div className="input-group">
                  <label>N° da Ordem de Serviço</label>
                  <input
                    type="text"
                    value={editingOrder.osNumber}
                    onChange={(e) => setEditingOrder({ ...editingOrder, osNumber: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Valor Total</label>
                  <input
                    type="text"
                    value={editingOrder.value}
                    onChange={(e) => setEditingOrder({ ...editingOrder, value: formatCurrency(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label>Nome do Cliente</label>
                  <input
                    type="text"
                    value={editingOrder.clientName}
                    onChange={(e) => setEditingOrder({ ...editingOrder, clientName: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Telefone do Cliente</label>
                  <input
                    type="text"
                    value={editingOrder.clientPhone || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, clientPhone: e.target.value.replace(/\D/g, '') })}
                    placeholder="Ex: 11999999999"
                    maxLength="11"
                  />
                </div>
              </div>

              <div className="paired-input-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Adicionar Peça</label>
                  <div className="searchable-select-container" ref={accDropdownRef}>
                    <div
                      className={`search-select-trigger ${isAccDropdownOpen ? 'open' : ''}`}
                      onClick={() => setIsAccDropdownOpen(!isAccDropdownOpen)}
                    >
                      <Package size={16} />
                      <span>{tempSelectedCode || (isAccDropdownOpen ? 'Pesquisar...' : 'Selecionar código...')}</span>
                      <ChevronDown size={14} className={`chevron ${isAccDropdownOpen ? 'rotated' : ''}`} />
                    </div>
                    {isAccDropdownOpen && (
                      <div className="search-select-dropdown glass-effect">
                        <div className="search-input-wrapper">
                          <Search size={14} />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Buscar código ou nome..."
                            value={accSearchTerm}
                            onChange={(e) => setAccSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="options-list custom-scrollbar">
                          {filteredAccessories.length === 0 ? (
                            <div className="option-empty">Nenhum acessório encontrado</div>
                          ) : (
                            filteredAccessories.map(acc => (
                              <div
                                key={acc.id}
                                className="option-item"
                                onClick={() => {
                                  setTempSelectedCode(acc.factoryCode);
                                  setIsAccDropdownOpen(false);
                                  setAccSearchTerm('');
                                }}
                              >
                                <span className="acc-code">{acc.factoryCode}</span>
                                <span className="acc-name">{acc.commercialName}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Delivery</label>
                  <div className="input-with-button">
                    <input
                      type="text"
                      maxLength="10"
                      value={currentDelivery}
                      onChange={(e) => setCurrentDelivery(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000000000"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-add-tag"
                      onMouseEnter={(e) => e.target.style.background = 'rgba(56, 189, 248, 0.2)'}
                      onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                      style={{ padding: '0 15px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer', transition: 'all 0.2s' }}
                      disabled={!tempSelectedCode || currentDelivery.length !== 10}
                      onClick={() => {
                        const newItem = { code: tempSelectedCode, delivery: currentDelivery };
                        setEditingOrder({ ...editingOrder, items: [...editingOrder.items, newItem] });
                        setTempSelectedCode('');
                        setCurrentDelivery('');
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de Itens na Edição */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
                {editingOrder.items.map((item, idx) => (
                  <div key={idx} className="os-item-tag" style={{ border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{item.code} • {item.delivery}</span>
                    <button
                      onClick={() => setEditingOrder({ ...editingOrder, items: editingOrder.items.filter((_, i) => i !== idx) })}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="input-group">
                <label>Valor Total (Venda)</label>
                <input
                  type="text"
                  value={editingOrder.value}
                  onChange={(e) => setEditingOrder({ ...editingOrder, value: formatCurrency(e.target.value) })}
                />
              </div>

              {/* Substituição de PDF */}
              {(currentUser.role === 'admin' || currentUser.sector === 'atendimento') && (
                <div className="input-group" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UploadCloud size={18} /> Substituir Documento PDF
                  </label>
                  <div className="file-edit-container" style={{ marginTop: '1rem' }}>
                    <input
                      type="file"
                      id="edit-pdf-input"
                      accept=".pdf"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            setEditingOrder({ ...editingOrder, file: re.target.result, fileName: file.name });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label htmlFor="edit-pdf-input" className="btn-secondary" style={{ width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', padding: '12px' }}>
                      <FileDown size={18} /> {editingOrder.fileName || 'Selecionar novo PDF'}
                    </label>
                    <p style={{ fontSize: '0.7rem', opacity: 0.5, textAlign: 'center', marginTop: '10px' }}>
                      Ao salvar, o PDF antigo será **descartado** permanentemente.
                    </p>
                  </div>
                </div>
              )}

            </div>
            <div className="modal-footer" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleUpdateOrder}>Salvar Alterações</button>
              <button className="btn-danger" style={{ width: '100%' }} onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Check-in */}
      <ConfirmModal
        isOpen={confirmCheckIn.isOpen}
        title="Confirmar Check-in"
        message="Deseja validar esta Ordem de Serviço? Esta ação confirma que todos os itens foram conferidos."
        onConfirm={() => processCheckIn(confirmCheckIn.orderId)}
        onCancel={() => setConfirmCheckIn({ isOpen: false, orderId: null })}
        confirmText="Confirmar Saída"
        type="success"
      />

      {/* Modal de Histórico de Alertas */}
      {alertHistoryModal.isOpen && alertHistoryModal.order && (
        <div className="modal-backdrop">
          <div className="modal-card alert-history-modal glass-effect">
            <button className="modal-close-btn" onClick={() => setAlertHistoryModal({ isOpen: false, order: null })}>
              <X size={24} />
            </button>
            <div className="modal-header">
              <div className="header-icon-title">
                <AlertCircle className={alertHistoryModal.order.alerts.some(a => a.status === 'ativo') ? 'modal-header-danger' : 'modal-header-success'} size={24} />
                <h3>Histórico de Alertas</h3>
              </div>
              <p className="subtitle">OS: <strong>{alertHistoryModal.order.osNumber}</strong> | Cliente: <strong>{alertHistoryModal.order.clientName}</strong></p>
            </div>

            <div className="modal-alerts-container custom-scrollbar">
              {(alertHistoryModal.order.alerts || [])
                .slice()
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map((alert, idx) => (
                  <div key={idx} className={`alert-history-item ${alert.status}`}>
                    <div className="item-main-header">
                      <span className={`status-tag ${alert.status}`}>
                        {alert.status === 'ativo' ? '⚠️ Pendente' : '✅ Resolvido'}
                      </span>
                      <span className="timestamp" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                        {new Date(alert.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="error-content">
                      <p style={{ margin: '0.5rem 0' }}>{alert.description}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
                        <div className="author-info" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', opacity: 0.8 }}>
                          <User size={14} />
                          <span>Reportado por: <strong>{alert.author}</strong></span>
                        </div>

                        {alert.status === 'ativo' && canManage && (
                          <button
                            className="btn-success-sm"
                            onClick={() => handleSingleCorrection(alertHistoryModal.order.id, alert.timestamp)}
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                          >
                            Corrigir Erro
                          </button>
                        )}
                      </div>
                    </div>

                    {alert.status === 'corrigido' && (
                      <div className="correction-details" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="correction-content">
                          <span className="correction-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#10b981', display: 'block', marginBottom: '8px' }}>
                            CORREÇÃO EFETUADA:
                          </span>
                          <div className="author-info" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', opacity: 0.8 }}>
                            <CheckCircle2 size={14} />
                            <span>Corrigido por: <strong>{alert.resolvedBy}</strong></span>
                          </div>
                          <span className="timestamp" style={{ fontSize: '0.7rem', opacity: 0.5, display: 'block', marginTop: '4px' }}>
                            {new Date(alert.resolvedAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: '1.5rem' }}
              onClick={() => setAlertHistoryModal({ isOpen: false, order: null })}
            >
              Fechar Histórico
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOrders;

