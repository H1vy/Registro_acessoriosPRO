import React, { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, ClipboardList, Database, HardDriveDownload, HardDriveUpload } from 'lucide-react'
import './App.css'

import Dashboard from './components/Dashboard'
import Movements from './components/Movements'
import Catalog from './components/Catalog'
import Login from './components/Login'
import { getAllData, saveData, seedAdminUser } from './utils/db'
import { LogOut, User } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('movements')
  const [accessories, setAccessories] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    // Semeia o admin se necessário
    seedAdminUser()

    // Tentar recuperar sessão salva
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser))
    }

    const loadInitialData = async () => {
      try {
        let acc = await getAllData('accessories')
        let resp = await getAllData('responsibles')
        let mov = await getAllData('movements')

        if (acc.length === 0 && resp.length === 0 && mov.length === 0) {
          const lsAcc = JSON.parse(localStorage.getItem('accessories') || '[]')
          const lsResp = JSON.parse(localStorage.getItem('responsibles') || '[]')
          const lsMov = JSON.parse(localStorage.getItem('movements') || '[]')
          
          if (lsAcc.length > 0 || lsResp.length > 0 || lsMov.length > 0) {
            acc = lsAcc; resp = lsResp; mov = lsMov;
          }
        }

        setAccessories(acc)
        setResponsibles(resp)
        setMovements(mov)
      } catch (error) {
        console.error("Erro ao carregar dados:", error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [])

  const handleLogin = (user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', JSON.stringify(user))
  }

  const handleLogout = () => {
    if (window.confirm('Deseja realmente sair?')) {
      setCurrentUser(null)
      localStorage.removeItem('currentUser')
    }
  }

  // Persistência Automática via useEffect
  useEffect(() => {
    if (!loading) saveData('accessories', accessories);
  }, [accessories, loading]);

  useEffect(() => {
    if (!loading) saveData('responsibles', responsibles);
  }, [responsibles, loading]);

  useEffect(() => {
    if (!loading) saveData('movements', movements);
  }, [movements, loading]);

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
          if (window.confirm("Isso irá substituir todos os dados atuais. Deseja continuar?")) {
            setAccessories(data.accessories)
            setResponsibles(data.responsibles)
            setMovements(data.movements)
            alert("Backup restaurado com sucesso!")
          }
        } else {
          alert("Arquivo de backup inválido.")
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup.")
      }
    }
    reader.readAsText(file)
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
            setMovements={setMovements}
            currentUser={currentUser}
          />
        )
      case 'catalog':
        return (
          <Catalog 
            accessories={accessories} 
            setAccessories={setAccessories}
            responsibles={responsibles}
            setResponsibles={setResponsibles}
            currentUser={currentUser}
          />
        )
      default:
        return <Movements currentUser={currentUser} />
    }
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app-container">
      <header>
        <div className="logo">
          <h1>ACESSÓRIOS <span>PRO</span></h1>
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
          </div>
          
          <div className="header-actions">
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
