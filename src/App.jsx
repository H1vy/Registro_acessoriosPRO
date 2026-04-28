import React, { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, ClipboardList, Database, HardDriveDownload, HardDriveUpload, ClipboardCheck, Package } from 'lucide-react'
import './App.css'

import Dashboard from './components/Dashboard'
import Movements from './components/Movements'
import Catalog from './components/Catalog'
import PartSales from './components/PartSales'
import Login from './components/Login'
import AdminPanel from './components/AdminPanel'
import ConfirmModal from './components/ConfirmModal'
import Orders from './components/Orders'
import ServiceOrders from './components/ServiceOrders'
import { getAllData, saveData, seedAdminUser, subscribeToData, migrateUsersSector } from './utils/db'
import { LogOut, User, Shield, Sun, Moon, FileText, Bell, X } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('movements')
  const [accessories, setAccessories] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false })
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', type: 'warning' })
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [serviceOrders, setServiceOrders] = useState([])

  const fileInputRef = useRef(null)

  // Determina as abas disponíveis baseado no papel e setor do usuário (DEFINITIVO)
  const getAvailableTabs = () => {
    if (currentUser?.role === 'admin') {
      return ['movements', 'catalog', 'dashboard', 'part-sales', 'orders', 'service-orders', 'admin']
    }
    if (currentUser?.sector === 'atendimento') {
      // Atendimento: SOMENTE Pedidos, Dashboard e Anexos OS
      return ['orders', 'dashboard', 'service-orders']
    }
    // Estoque: tudo exceto Administração
    return ['movements', 'catalog', 'dashboard', 'part-sales', 'orders', 'service-orders']
  }

  // Redireciona para aba válida caso o usuário atual não tenha permissão
  useEffect(() => {
    if (!currentUser) return
    const tabs = getAvailableTabs()
    if (!tabs.includes(activeTab)) {
      setActiveTab(tabs[0])
    }
  }, [currentUser])

  // Motor de Conciliação por Saldo (Quantidade Compatível)
  useEffect(() => {
    if (movements.length > 0 && accessories.length > 0 && currentUser) {
      const today = new Date().toLocaleDateString('sv-SE');
      
      // 1. Criamos um "Pool" único de todos os itens de anexos disponíveis
      let availableAttachments = [];
      serviceOrders.filter(so => !so.annulled && !so.hidden).forEach(so => {
        (so.items || []).forEach(item => {
          // Normalização robusta da O.S. (Removendo zeros à esquerda e tratando "AVULSO" como null)
          const rawOS = String(so.osNumber || '').trim().toUpperCase();
          const cleanOS = (rawOS && rawOS !== '-' && rawOS !== 'S/N' && rawOS !== 'AVULSO')
                           ? String(so.osNumber).trim().toLowerCase().replace(/^0+/, '') : null;

          // Normalização robusta de Quantidade (Extraindo apenas números para lidar com "2X" ou "3 itens")
          const rawQty = String(item.quantity || 1);
          const parsedQty = parseInt(rawQty.replace(/\D/g, '')) || 1;

          // Normalização de Data (Garantindo formato YYYY-MM-DD para comparação de strings)
          let soDateKey = null;
          if (so.withdrawalDate && so.withdrawalDate.includes('-')) {
            soDateKey = so.withdrawalDate.trim(); // Assume YYYY-MM-DD
          } else if (so.withdrawalDate && so.withdrawalDate.includes('/')) {
            // Converte DD/MM/YYYY para YYYY-MM-DD
            const [d, m, y] = so.withdrawalDate.split('/');
            soDateKey = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
          } else if (so.attachedAt) {
            const soD = new Date(so.attachedAt);
            soDateKey = `${soD.getFullYear()}-${String(soD.getMonth()+1).padStart(2,'0')}-${String(soD.getDate()).padStart(2,'0')}`;
          }

          availableAttachments.push({
            ...so,
            itemCode: String(item.code || '').trim().toLowerCase(),
            itemQty: parsedQty,
            dateKey: soDateKey,
            cleanOS: cleanOS
          });
        });
      });

      // 2. IDs de anexos válidos para manter a consistência caso precisemos no futuro
      const validAttachmentIds = new Set(
        serviceOrders.filter(so => !so.annulled && !so.hidden).map(so => so.id)
      );

      // 3. Candidatos: TODOS os movimentos válidos. 
      //    Re-reconciliamos TUDO do zero para garantir que um item de anexo
      //    só possa ser consumido uma única vez, mantendo a proporção 1-para-1.
      const CUTOFF_DATE = '2026-04-27';

      const candidateMovements = movements.filter(m => {
        if (m.isDeleted || (m.type && m.type !== 'checkout') || m.annulled) return false;
        // Filtro de data: apenas registros a partir de 27/04/2026
        if (!m.timestamp || m.timestamp < CUTOFF_DATE) return false;
        return true;
      });

      // 4. Cada movimento é verificado INDIVIDUALMENTE pela sua própria quantidade.
      //    Regra COM OS  → código + OS + data + qtd do movimento devem ser idênticos ao item do anexo
      //    Regra AVULSO  → código + data + qtd idênticos; OS do anexo é ignorada
      //    Processamento em ordem cronológica para garantir resultados determinísticos.
      // 4. Cada movimento é verificado em DUAS PASSAGENS.
      //    PASSAGEM 1: Prioriza matches EXATOS de quantidade.
      //    PASSAGEM 2: Faz o match por saldo (subtração) para o que sobrou.
      
      // Ordenação determinística do pool para evitar loops de reconciliação (Race Conditions)
      const sortedPool = [...availableAttachments].sort((a, b) => {
        const idComp = String(a.id).localeCompare(String(b.id));
        if (idComp !== 0) return idComp;
        return String(a.itemCode).localeCompare(String(b.itemCode));
      });

      const movementResults = {};
      const sortedCandidates = [...candidateMovements].sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        if (tA !== tB) return tA - tB;
        return String(a.id).localeCompare(String(b.id)); // Desempate estável
      });

      const processPass = (isExactOnly) => {
        sortedCandidates.forEach(m => {
          if (movementResults[m.id]?.targetStatus === 'ok') return;

          const d = m.timestamp ? new Date(m.timestamp) : null;
          if (!d || isNaN(d.getTime())) { 
            movementResults[m.id] = { targetStatus: 'pending', lastMatch: null }; 
            return; 
          }
          
          const mDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const acc = accessories.find(a => String(a.id) === String(m.accessoryId));
          const mCode = acc?.factoryCode ? String(acc.factoryCode).trim().toLowerCase() : null;
          if (!mCode) { movementResults[m.id] = { targetStatus: 'pending', lastMatch: null }; return; }
          
          const mOS = (m.soNumber && String(m.soNumber).trim() !== '-' && String(m.soNumber).trim().toUpperCase() !== 'S/N' && String(m.soNumber).trim().toUpperCase() !== 'AVULSO')
                      ? String(m.soNumber).trim().toLowerCase().replace(/^0+/, '') : null;
          const rawMQty = String(m.quantity || 1);
          const mQty = parseInt(rawMQty.replace(/\D/g, '')) || 1;

          const matchIndex = sortedPool.findIndex(a => {
            if (a.itemCode !== mCode) return false;
            
            // Match de Data (String literal)
            if (a.dateKey !== mDate) return false;
            
            // Match de O.S.
            // Se o movimento tem O.S., DEVE ser igual ao anexo.
            // Se o movimento é AVULSO, ele só pode casar com anexos sem O.S. (ou marcados como Avulso)
            if (mOS !== null) {
              if (mOS !== a.cleanOS) return false;
            }
            // Se o movimento é AVULSO (mOS === null), ignoramos a checagem de O.S. do anexo
            // para permitir o vínculo por Código + Data + Quantidade.
            
            if (isExactOnly) {
              return a.itemQty === mQty;
            } else {
              return a.itemQty >= mQty;
            }
          });

          if (matchIndex !== -1) {
            const matchedItem = sortedPool[matchIndex];
            movementResults[m.id] = { targetStatus: 'ok', lastMatch: { ...matchedItem } };
            
            matchedItem.itemQty -= mQty;
            if (matchedItem.itemQty <= 0) {
              sortedPool.splice(matchIndex, 1);
            }
          } else if (!isExactOnly) {
            movementResults[m.id] = { targetStatus: 'pending', lastMatch: null };
          }
        });
      };

      processPass(true);  // Exatos
      processPass(false); // Parciais

      // 5. Aplica os resultados a cada movimento individualmente
      let changed = false;
      const reconciledMovements = movements.map(m => {
        if (m.isDeleted || (m.type && m.type !== 'checkout') || m.annulled) return m;
        const result = movementResults[m.id];
        if (!result) return m;

        const { targetStatus, lastMatch } = result;
        const currentId = m.attachmentId || null;
        const targetId = lastMatch ? lastMatch.id : null;

        const needsUpdate = m.attachmentStatus !== targetStatus ||
                           currentId !== targetId ||
                           (!m.type && m.accessoryId) || // Migração de tipo
                           (lastMatch && (lastMatch.checkIn || lastMatch.checkin) && !m.checkin) ||
                           (lastMatch && String(m.withdrawalDate || '') !== String(lastMatch.withdrawalDate || ''));

        if (needsUpdate) {
          changed = true;
          const isOsCheckedIn = lastMatch && (lastMatch.checkIn || lastMatch.checkin);
          return {
            ...m,
            type: m.type || 'checkout', // Migração garantida
            attachmentStatus: targetStatus,
            attachmentId: targetId,
            attachedAt: lastMatch ? lastMatch.attachedAt : (targetStatus === 'pending' ? null : m.attachedAt),
            attachedBy: lastMatch ? lastMatch.attachedBy : (targetStatus === 'pending' ? null : m.attachedBy),
            withdrawalDate: lastMatch ? lastMatch.withdrawalDate : (targetStatus === 'pending' ? null : m.withdrawalDate),
            checkin: isOsCheckedIn ? (m.checkin && typeof m.checkin === 'object' ? m.checkin : isOsCheckedIn) : m.checkin,
            checkinAt: isOsCheckedIn ? (lastMatch.checkIn?.at || lastMatch.checkin?.at || lastMatch.checkIn?.timestamp || lastMatch.checkin?.timestamp) : m.checkinAt,
            checkinBy: isOsCheckedIn ? (lastMatch.checkIn?.user || lastMatch.checkin?.user) : m.checkinBy
          };
        }
        return m;
      });

      if (changed) {
        const timer = setTimeout(() => {
          saveData('movements', reconciledMovements);
        }, 500); // Pequeno debounce para evitar loops de salvamento
        return () => clearTimeout(timer);
      }
    }
  }, [movements, serviceOrders, accessories, currentUser]);

  useEffect(() => {
    seedAdminUser()
    migrateUsersSector()

    // Limpeza única v2: remove os 2 registros fantasmas de check-in da aba Part Sales
    // (GH44-02960A, 25/04/2026 às 22:48:14 e 22:48:39 — filtra por m.checkin.timestamp)
    if (!localStorage.getItem('ghost_checkin_cleanup_v2')) {
      getAllData('movements').then(movs => {
        const ghosts = movs.filter(m => {
          if (!m || !m.checkin || !m.checkin.timestamp) return false;
          const d = new Date(m.checkin.timestamp);
          const dateLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const hh = d.getHours(), mm = d.getMinutes(), ss = d.getSeconds();
          const isTargetDate = dateLocal === '2026-04-25';
          const isTargetTime = hh === 22 && mm === 48 && (ss === 14 || ss === 39);
          return isTargetDate && isTargetTime;
        });
        if (ghosts.length > 0) {
          const ghostIds = ghosts.map(g => g.id);
          const cleaned = movs.filter(m => m && !ghostIds.includes(m.id));
          saveData('movements', cleaned).then(() => {
            localStorage.setItem('ghost_checkin_cleanup_v2', '1');
            console.log(`[Cleanup v2] ${ghosts.length} registro(s) fantasma(s) removido(s):`, ghostIds);
          });
        } else {
          localStorage.setItem('ghost_checkin_cleanup_v2', '1');
          console.log('[Cleanup v2] Nenhum registro fantasma encontrado.');
        }
      });
    }

    // Limpeza única 27/04: remove check-ins realizados hoje (reverte para pendente)
    if (!localStorage.getItem('checkin_rollback_2704')) {
      getAllData('movements').then(movs => {
        let changed = false;
        const cleaned = movs.map(m => {
          if (!m) return m;
          
          // Verifica check-in manual (objeto)
          const manualCheckinDate = m.checkin?.timestamp ? new Date(m.checkin.timestamp).toISOString().split('T')[0] : null;
          // Verifica check-in reconciliado (boolean + checkinAt)
          const reconciledCheckinDate = m.checkinAt ? new Date(m.checkinAt).toISOString().split('T')[0] : null;

          if (manualCheckinDate === '2026-04-27' || reconciledCheckinDate === '2026-04-27') {
            changed = true;
            return { ...m, checkin: null, checkinAt: null, checkinBy: null };
          }
          return m;
        });

        if (changed) {
          saveData('movements', cleaned).then(() => {
            localStorage.setItem('checkin_rollback_2704', '1');
            console.log('[Rollback 27/04] Check-ins de hoje revertidos para pendente.');
          });
        } else {
          localStorage.setItem('checkin_rollback_2704', '1');
          console.log('[Rollback 27/04] Nenhum check-in encontrado para hoje.');
        }
      });
    }

    // Limpeza única 27/04 (Avulsos): remove os 2 registros fantasmas sem O.S. da aba Part Sales
    if (!localStorage.getItem('ghost_cleanup_2704_avulso')) {
      getAllData('movements').then(movs => {
        let changed = false;
        const cleaned = movs.map(m => {
          if (!m || m.isDeleted) return m;
          const d = new Date(m.timestamp);
          const dateLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          const hh = d.getHours(), mm = d.getMinutes(), ss = d.getSeconds();
          
          const isTargetDate = dateLocal === '2026-04-27';
          // GH44-02960A às 02:46:29 e 02:33:41
          const isTargetTime = (hh === 2 && mm === 46 && ss === 29) || (hh === 2 && mm === 33 && ss === 41);
          const isTargetCode = m.accessoryId === 'GH44-02960A' || m.itemCode === 'gh44-02960a';

          if (isTargetDate && isTargetTime && isTargetCode) {
            changed = true;
            return { ...m, isDeleted: true, deletionReason: 'Ghost cleanup (requested)', deletedBy: 'Sistema' };
          }
          return m;
        });

        if (changed) {
          saveData('movements', cleaned).then(() => {
            localStorage.setItem('ghost_cleanup_2704_avulso', '1');
            console.log('[Cleanup 27/04] 2 registros fantasmas marcados como excluídos.');
          });
        } else {
          localStorage.setItem('ghost_cleanup_2704_avulso', '1');
        }
      });
    }
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      getAllData('users').then(users => {
        const dbUser = users.find(u => u.id === JSON.parse(savedUser).id)
        if (dbUser) {
          setCurrentUser(dbUser)
          // Redirecionar com base no setor ao restaurar sessão
          if (dbUser.sector === 'atendimento') {
            setActiveTab('orders')
          }
        } else {
          setCurrentUser(null)
          localStorage.removeItem('currentUser')
        }
      })
    }

    const unsubAcc    = subscribeToData('accessories', setAccessories)
    const unsubResp   = subscribeToData('responsibles', setResponsibles)
    const unsubMov    = subscribeToData('movements', setMovements)
    const unsubUsers  = subscribeToData('users', setUsers)
    const unsubOrders = subscribeToData('orders', setOrders)
    const unsubServiceOrders = subscribeToData('service_orders', setServiceOrders)

    const checkMigrationAndLoad = async () => {
      try {
        let acc  = await getAllData('accessories')
        let resp = await getAllData('responsibles')
        let mov  = await getAllData('movements')

        if (acc.length === 0 && resp.length === 0 && mov.length === 0) {
          const lsAcc  = JSON.parse(localStorage.getItem('accessories') || '[]')
          const lsResp = JSON.parse(localStorage.getItem('responsibles') || '[]')
          const lsMov  = JSON.parse(localStorage.getItem('movements') || '[]')

          if (lsAcc.length > 0 || lsResp.length > 0 || lsMov.length > 0) {
            await saveData('accessories', lsAcc)
            await saveData('responsibles', lsResp)
            await saveData('movements', lsMov)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    checkMigrationAndLoad()

    return () => {
      unsubAcc()
      unsubResp()
      unsubMov()
      unsubUsers()
      unsubOrders()
      unsubServiceOrders()
    }
  }, [])

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : 'light-mode'
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleLogin = (user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', JSON.stringify(user))
    // Define aba inicial correta por setor
    if (user.sector === 'atendimento') {
      setActiveTab('orders')
    } else {
      setActiveTab('movements')
    }
  }

  const handleLogout = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Sair da conta',
      message: 'Deseja realmente sair do seu perfil atual?',
      type: 'warning',
      confirmText: 'Sair',
      onConfirm: () => {
        setCurrentUser(null)
        localStorage.removeItem('currentUser')
        setConfirmModal({ isOpen: false })
      },
      onCancel: () => setConfirmModal({ isOpen: false })
    })
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const showAlert = (title, message, type = 'warning') => {
    setAlertConfig({ isOpen: true, title, message, type })
  }

  // Funções de atualização com persistência no Firebase (Garante sincronia real-time)
  const handleSetAccessories = (newData) => {
    setAccessories(prev => {
      const resolved = typeof newData === 'function' ? newData(prev) : newData;
      saveData('accessories', resolved);
      return resolved;
    });
  }

  const handleSetResponsibles = (newData) => {
    setResponsibles(prev => {
      const resolved = typeof newData === 'function' ? newData(prev) : newData;
      saveData('responsibles', resolved);
      return resolved;
    });
  }

  const handleSetMovements = (newData) => {
    setMovements(prev => {
      const resolved = typeof newData === 'function' ? newData(prev) : newData;
      saveData('movements', resolved);
      return resolved;
    });
  }

  const handleSetUsers = (newData) => {
    setUsers(prev => {
      const resolved = typeof newData === 'function' ? newData(prev) : newData;
      saveData('users', resolved);
      return resolved;
    });
  }

  const handleSetOrders = (newData) => {
    setOrders(prev => {
      const resolved = typeof newData === 'function' ? newData(prev) : newData;
      saveData('orders', resolved);
      return resolved;
    });
  }

  const handleSetServiceOrders = (newData) => {
    setServiceOrders(prev => {
      const resolved = typeof newData === 'function' ? newData(prev) : newData;
      saveData('service_orders', resolved);
      return resolved;
    });
  }

  const exportBackup = () => {
    const data = { accessories, responsibles, movements, exportDate: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup_acessorios_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result)
        if (data.accessories && data.responsibles && data.movements) {
          setConfirmModal({
            isOpen: true,
            title: 'Restaurar Backup',
            message: 'Isso irá substituir TODOS os dados atuais pelos do arquivo. Deseja continuar?',
            type: 'danger',
            confirmText: 'Restaurar',
            onConfirm: () => {
              setAccessories(data.accessories)
              setResponsibles(data.responsibles)
              setMovements(data.movements)
              if (data.users) setUsers(data.users)
              setConfirmModal({ isOpen: false })
              setTimeout(() => showAlert('Sucesso', 'Backup restaurado com sucesso!', 'success'), 100)
            },
            onCancel: () => setConfirmModal({ isOpen: false })
          })
        } else {
          showAlert('Erro', 'Arquivo de backup inválido.', 'danger')
        }
      } catch (err) {
        showAlert('Erro', 'Erro ao ler o arquivo de backup.', 'danger')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleRestoreClick = () => {
    fileInputRef.current.click()
  }

  const renderContent = () => {
    if (loading) return <div className="loading">Carregando dados...</div>

    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            movements={movements}
            accessories={accessories}
            responsibles={responsibles}
            orders={orders}
            currentUser={currentUser}
          />
        )
      case 'movements':
        return (
          <Movements
            movements={movements}
            accessories={accessories}
            responsibles={responsibles}
            setMovements={handleSetMovements}
            currentUser={currentUser}
            showAlert={showAlert}
          />
        )
      case 'catalog':
        return (
          <Catalog
            accessories={accessories}
            setAccessories={handleSetAccessories}
            responsibles={responsibles}
            setResponsibles={handleSetResponsibles}
            currentUser={currentUser}
            showAlert={showAlert}
          />
        )
      case 'part-sales':
        return (
          <PartSales
            movements={movements}
            accessories={accessories}
            responsibles={responsibles}
            setMovements={handleSetMovements}
            currentUser={currentUser}
            showAlert={showAlert}
          />
        )
      case 'admin':
        return (
          <AdminPanel
            currentUser={currentUser}
            users={users}
            setUsers={handleSetUsers}
            setMovements={handleSetMovements}
            showAlert={showAlert}
          />
        )
      case 'orders':
        return (
          <Orders
            orders={orders}
            setOrders={handleSetOrders}
            accessories={accessories}
            responsibles={responsibles}
            movements={movements}
            setMovements={handleSetMovements}
            currentUser={currentUser}
            showAlert={showAlert}
          />
        )
      case 'service-orders':
        return (
          <ServiceOrders
            serviceOrders={serviceOrders}
            setServiceOrders={handleSetServiceOrders}
            accessories={accessories}
            movements={movements}
            setMovements={handleSetMovements}
            currentUser={currentUser}
            showAlert={showAlert}
          />
        )
      default:
        return (
          <Movements
            movements={movements}
            accessories={accessories}
            responsibles={responsibles}
            setMovements={handleSetMovements}
            currentUser={currentUser}
            showAlert={showAlert}
          />
        )
    }
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />
  }

  const availableTabs = getAvailableTabs()

  // Rol/setor para exibir no header
  const getUserRoleLabel = () => {
    if (currentUser.role === 'admin') return 'Administrador'
    if (currentUser.sector === 'atendimento') return 'Atendimento'
    return 'Estoque'
  }

  // Apenas Admin e Estoque têm acesso ao backup
  const canAccessBackup = currentUser?.role === 'admin' || currentUser?.sector === 'estoque'

  return (
    <div className="app-container">
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />

      <ConfirmModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        hideCancel={true}
        confirmText="Entendido"
        onConfirm={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        onCancel={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <header>
        <div className="logo">
          <h1><span className="logo-text">ACESSÓRIOS</span> <span className="logo-pro">PRO</span></h1>
          <span className="developer-tag">Hivyson Jesus Developer</span>
        </div>
        <nav>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {availableTabs.includes('movements') && (
              <button
                className={`nav-btn ${activeTab === 'movements' ? 'active' : ''} relative`}
                onClick={() => setActiveTab('movements')}
                title="Movimentação"
              >
                <ClipboardList size={20} />
                <span className="nav-text">Movimentação</span>
                {movements.filter(m => {
                  if (m.isDeleted || m.type !== 'checkout' || m.annulled || m.attachmentStatus === 'ok' || !m.timestamp) return false;
                  if (m.timestamp < '2026-04-27') return false;
                  return true;
                }).length > 0 && (
                  <span className="tab-notification-badge" />
                )}
              </button>
            )}
            {availableTabs.includes('catalog') && (
              <button
                className={`nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
                onClick={() => setActiveTab('catalog')}
                title="Catálogo"
              >
                <Database size={20} />
                <span className="nav-text">Catálogo</span>
              </button>
            )}
            {availableTabs.includes('dashboard') && (
              <button
                className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
                title="Dashboard"
              >
                <LayoutDashboard size={20} />
                <span className="nav-text">Dashboard</span>
              </button>
            )}
            {availableTabs.includes('part-sales') && (
              <button
                className={`nav-btn ${activeTab === 'part-sales' ? 'active' : ''}`}
                onClick={() => setActiveTab('part-sales')}
                title="Part Sales"
              >
                <ClipboardCheck size={20} />
                <span className="nav-text">Part Sales</span>
              </button>
            )}
            {availableTabs.includes('orders') && (
              <button
                className={`nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
                title="Pedidos"
              >
                <Package size={20} />
                <span className="nav-text">Pedidos</span>
              </button>
            )}
            {availableTabs.includes('service-orders') && (
              <button
                className={`nav-btn ${activeTab === 'service-orders' ? 'active' : ''} relative`}
                onClick={() => setActiveTab('service-orders')}
                title="Anexos OS"
              >
                <FileText size={20} />
                <span className="nav-text">Anexos OS</span>
                {movements.filter(m => {
                  if (m.isDeleted || m.type !== 'checkout' || m.annulled || m.attachmentStatus === 'ok' || !m.timestamp) return false;
                  if (m.timestamp < '2026-04-27') return false;
                  return true;
                }).length > 0 && (
                  <span className="tab-notification-badge" />
                )}
              </button>

            )}
            {availableTabs.includes('admin') && (
              <button
                className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
                title="Admin"
              >
                <Shield size={18} />
                <span className="nav-text">Admin</span>
              </button>
            )}
          </div>

          <div className="header-actions">
            {/* Central de Notificações de Anexos Pendentes */}
            <PendingNotifications 
              movements={movements} 
              accessories={accessories}
              setActiveTab={setActiveTab}
            />

            <button
              className="btn-icon-secondary"
              title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
            </button>

            {/* Backup/Restaurar — apenas Admin e Estoque */}
            {canAccessBackup && (
              <>
                <button className="btn-icon-secondary" title="Exportar Backup JSON" onClick={exportBackup}>
                  <HardDriveDownload size={18} />
                  <span>Backup</span>
                </button>
                <button className="btn-icon-secondary" title="Importar Backup JSON" onClick={handleRestoreClick}>
                  <HardDriveUpload size={18} />
                  <span>Restaurar</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={importBackup}
                  style={{ display: 'none' }}
                />
              </>
            )}

            <div className="user-profile">
              <div
                className="user-logo"
                style={{
                  width: '32px', height: '32px',
                  background: 'var(--bg-accent)', color: 'var(--accent)',
                  borderRadius: '10px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}
              >
                <User size={18} />
              </div>
              <div className="user-info">
                <span className="user-name">{currentUser.username}</span>
                <span className="user-role">{getUserRoleLabel()}</span>
              </div>
              <button className="btn-logout" onClick={handleLogout} title="Sair da conta">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main>
        {renderContent()}
      </main>
    </div>
  )
}

function PendingNotifications({ movements, accessories, setActiveTab }) {
  const [isOpen, setIsOpen] = useState(false);

  const pending = movements.filter(m => {
    if (m.isDeleted || m.type !== 'checkout' || m.annulled || m.attachmentStatus === 'ok' || !m.timestamp) return false;
    if (m.timestamp < '2026-04-27') return false;
    return true;
  });

  return (
    <div className="notification-container">
      <button 
        className={`btn-icon-secondary notification-bell ${pending.length > 0 ? 'has-pending' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        title="Central de Pendências"
        style={{ opacity: pending.length === 0 ? 0.3 : 1 }}
      >
        <Bell size={20} />
        {pending.length > 0 && <span className="badge-notification">{pending.length}</span>}
      </button>

      {isOpen && pending.length > 0 && (
        <div className="notification-dropdown glass-effect">
          <div className="notification-header">
            <h4>Anexos Pendentes</h4>
            <button className="btn-close-mini" onClick={() => setIsOpen(false)}><X size={14} /></button>
          </div>
          <div className="notification-list custom-scrollbar">
            {pending.map(m => {
              const acc = accessories.find(a => a.id === m.accessoryId);
              return (
                <div key={m.id} className="notification-item" onClick={() => { setActiveTab('service-orders'); setIsOpen(false); }}>
                  <div className="notif-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="notif-icon-wrapper">
                        <FileText size={14} />
                      </div>
                      <span className="notif-code">{acc?.factoryCode || '??'}</span>
                    </div>
                    <span className="notif-date">{new Date(m.timestamp).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="notif-desc">O.S: {m.soNumber || 'S/N'}</div>
                </div>
              );
            })}
          </div>
          <button className="btn-view-all" onClick={() => { setActiveTab('service-orders'); setIsOpen(false); }}>
            Ir para Anexos
          </button>
        </div>
      )}

      {isOpen && pending.length === 0 && (
        <div className="notification-dropdown glass-effect" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Tudo em dia! Nenhuma pendência encontrada.
        </div>
      )}
    </div>
  );
}

export default App
