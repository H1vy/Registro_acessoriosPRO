import React, { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, ClipboardList, Database, HardDriveDownload, HardDriveUpload, ClipboardCheck } from 'lucide-react'
import './App.css'

import Dashboard from './components/Dashboard'
import Movements from './components/Movements'
import Catalog from './components/Catalog'
import PartSales from './components/PartSales'
import Login from './components/Login'
import AdminPanel from './components/AdminPanel'
import ConfirmModal from './components/ConfirmModal'
import { getAllData, saveData, seedAdminUser, subscribeToData } from './utils/db'
import { LogOut, User, Shield, Sun, Moon } from 'lucide-react'
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
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    // Semeia o admin se necessário
    seedAdminUser()

    // Carrega o usuário da sessão para manter logado se houver (por ex, da localStorage)
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      // Validar caso o user tenha sido apagado ou mudou a senha
      // mas por performance e para evitar flash, assumimos inicialmente.
      // Poderia ser feita uma verificação rápida no banco:
      getAllData('users').then(users => {
         const dbUser = users.find(u => u.id === JSON.parse(savedUser).id);
         if (dbUser) {
            setCurrentUser(dbUser);
         } else {
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
         }
      });
    }

    // Assinar mudanças do Firebase em tempo real
    const unsubAcc = subscribeToData('accessories', setAccessories);
    const unsubResp = subscribeToData('responsibles', setResponsibles);
    const unsubMov = subscribeToData('movements', setMovements);
    const unsubUsers = subscribeToData('users', setUsers);

    const checkMigrationAndLoad = async () => {
      try {
        let acc = await getAllData('accessories')
        let resp = await getAllData('responsibles')
        let mov = await getAllData('movements')

        if (acc.length === 0 && resp.length === 0 && mov.length === 0) {
          const lsAcc = JSON.parse(localStorage.getItem('accessories') || '[]')
          const lsResp = JSON.parse(localStorage.getItem('responsibles') || '[]')
          const lsMov = JSON.parse(localStorage.getItem('movements') || '[]')
          
          if (lsAcc.length > 0 || lsResp.length > 0 || lsMov.length > 0) {
            await saveData('accessories', lsAcc)
            await saveData('responsibles', lsResp)
            await saveData('movements', lsMov)
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error)
      } finally {
        setLoading(false)
      }
    }

    checkMigrationAndLoad()

    return () => {
      unsubAcc();
      unsubResp();
      unsubMov();
      unsubUsers();
    }
  }, [])

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : 'light-mode'
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleLogin = (user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', JSON.stringify(user))
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
    setAlertConfig({ isOpen: true, title, message, type });
  };

  // Funções de atualização explícita para evitar loopings e race conditions do useEffect
  const handleSetAccessories = (newData) => {
    const resolved = typeof newData === 'function' ? newData(accessories) : newData;
    setAccessories(resolved);
    saveData('accessories', resolved);
  };

  const handleSetResponsibles = (newData) => {
    const resolved = typeof newData === 'function' ? newData(responsibles) : newData;
    setResponsibles(resolved);
    saveData('responsibles', resolved);
  };

  const handleSetMovements = (newData) => {
    const resolved = typeof newData === 'function' ? newData(movements) : newData;
    setMovements(resolved);
    saveData('movements', resolved);
  };

  const handleSetUsers = (newData) => {
    const resolved = typeof newData === 'function' ? newData(users) : newData;
    setUsers(resolved);
    saveData('users', resolved);
  };

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
              setTimeout(() => showAlert("Sucesso", "Backup restaurado com sucesso!", "success"), 100)
            },
            onCancel: () => setConfirmModal({ isOpen: false })
          })
        } else {
          showAlert("Erro", "Arquivo de backup inválido.", "danger")
        }
      } catch (err) {
        showAlert("Erro", "Erro ao ler o arquivo de backup.", "danger")
      }
    }
    reader.readAsText(file)
    e.target.value = '' // reseta input para permitir mesmo arquivo de repetição
  }

  const handleRestoreClick = () => {
    fileInputRef.current.click()
  }

  const renderContent = () => {
    if (loading) return <div className="loading">Carregando dados...</div>

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard movements={movements} accessories={accessories} responsibles={responsibles} />
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
        return <AdminPanel currentUser={currentUser} users={users} setUsers={handleSetUsers} setMovements={handleSetMovements} showAlert={showAlert} />
      default:
        return <Movements currentUser={currentUser} />
    }
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />
  }

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
            <button 
              className={`nav-btn ${activeTab === 'movements' ? 'active' : ''}`}
              onClick={() => setActiveTab('movements')}
            >
              <ClipboardList size={18} />
              Movimentação
            </button>
            <button 
              className={`nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
              onClick={() => setActiveTab('catalog')}
            >
              <Database size={18} />
              Catálogo
            </button>
            <button 
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <button 
              className={`nav-btn ${activeTab === 'part-sales' ? 'active' : ''}`}
              onClick={() => setActiveTab('part-sales')}
            >
              <ClipboardCheck size={18} />
              Part Sales
            </button>
            {currentUser?.role === 'admin' && (
              <button 
                className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <Shield size={18} />
                Administração
              </button>
            )}
          </div>
          
          <div className="header-actions">
            <button className="btn-icon-secondary" title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
            </button>

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

            <div className="user-profile">
              <div className="user-logo" style={{ width: '32px', height: '32px', background: 'var(--bg-accent)', color: 'var(--accent)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={18} />
              </div>
              <div className="user-info">
                <span className="user-name">{currentUser.username}</span>
                <span className="user-role">Sessão Ativa</span>
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

export default App
