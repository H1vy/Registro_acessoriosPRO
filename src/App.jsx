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
    if (movements.length > 0 && currentUser) {
      const today = new Date().toLocaleDateString('sv-SE');
      
      // 1. Criamos um "Pool" único de todos os itens de anexos disponíveis
      let availableAttachments = [];
      serviceOrders.filter(so => !so.annulled && !so.hidden).forEach(so => {
        (so.items || []).forEach(item => {
          availableAttachments.push({
            ...so,
            itemCode: item.code,
            dateKey: so.withdrawalDate || (so.attachedAt ? so.attachedAt.split('T')[0] : null)
          });
        });
      });

      let changed = false;
      const reconciledMovements = movements.map(m => {
        if (m.type !== 'checkout' || m.annulled) return m;
        
        // Garantir consistência absoluta na data extraindo diretamente da string ISO
        const mDate = m.timestamp ? m.timestamp.split('T')[0] : null;
        
        const acc = accessories.find(a => String(a.id) === String(m.accessoryId));
        const mOS = m.soNumber && m.soNumber !== '-' && m.soNumber !== 'S/N' ? String(m.soNumber).trim().toLowerCase() : null;
        const mCode = acc?.factoryCode ? String(acc.factoryCode).trim().toLowerCase() : null;

        // 2. Tenta encontrar o melhor par (Data + Código + O.S.)
        let matchIndex = -1;
        
        if (mCode && mDate) {
          matchIndex = availableAttachments.findIndex(a => {
            const aOS = a.osNumber ? String(a.osNumber).trim().toLowerCase() : null;
            const aCode = a.itemCode ? String(a.itemCode).trim().toLowerCase() : null;
            const aDate = a.dateKey; // Já está em formato sv-SE (YYYY-MM-DD)

            // Critério 1: Data deve ser idêntica
            if (aDate !== mDate) return false;

            // Critério 2: Código deve ser idêntico
            if (aCode !== mCode) return false;

            // Critério 3: O.S.
            if (mOS) {
              // Se a saída tem O.S., o anexo DEVE ter a mesma O.S.
              return aOS === mOS;
            } else {
              // Se a saída é S/N, aceitamos qualquer anexo (S/N ou com O.S.) do mesmo dia e código
              // Pois o usuário pode ter dado saída S/N e depois criado anexo com O.S.
              return true;
            }
          });
        }

        let targetStatus = matchIndex !== -1 ? 'ok' : 'pending';

        // 3. Se achou, remove do pool para que não seja usado novamente (Mapeamento 1:1)
        if (matchIndex !== -1) {
          availableAttachments.splice(matchIndex, 1);
        }

        if (m.attachmentStatus !== targetStatus) {
          changed = true;
          return { ...m, attachmentStatus: targetStatus };
        }
        return m;
      });

      if (changed) {
        handleSetMovements(reconciledMovements);
      }
    }
  }, [movements, serviceOrders, accessories, currentUser]);

  useEffect(() => {
    seedAdminUser()
    migrateUsersSector()

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
                {movements.filter(m => m.type === 'checkout' && !m.annulled && m.attachmentStatus !== 'ok' && (m.timestamp && m.timestamp.split('T')[0] >= '2026-04-22')).length > 0 && (
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
                {movements.filter(m => m.type === 'checkout' && !m.annulled && m.attachmentStatus !== 'ok' && (m.timestamp && m.timestamp.split('T')[0] >= '2026-04-22')).length > 0 && (
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
  const pending = movements.filter(m => 
    m.type === 'checkout' && 
    !m.annulled && 
    m.attachmentStatus !== 'ok' &&
    (m.timestamp && m.timestamp.split('T')[0] >= '2026-04-22')
  );
  
  // Debug para acompanhar o estado
  console.log(`[Notificações] Total Pendentes: ${pending.length}`);

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
