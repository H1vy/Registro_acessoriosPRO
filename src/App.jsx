import React, { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, ClipboardList, Database, HardDriveDownload, HardDriveUpload } from 'lucide-react'
import './App.css'

import Dashboard from './components/Dashboard'
import Movements from './components/Movements'
import Catalog from './components/Catalog'
import { getAllData, saveData } from './utils/db'

function App() {
  const [activeTab, setActiveTab] = useState('movements')
  const [accessories, setAccessories] = useState([])
  const [responsibles, setResponsibles] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  
  const fileInputRef = useRef(null)

  useEffect(() => {
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
            await saveData('accessories', lsAcc)
            await saveData('responsibles', lsResp)
            await saveData('movements', lsMov)
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
            await saveData('accessories', data.accessories)
            await saveData('responsibles', data.responsibles)
            await saveData('movements', data.movements)
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
            setMovements={async (newMovements) => {
              setMovements(newMovements)
              await saveData('movements', newMovements)
            }}
          />
        )
      case 'catalog':
        return (
          <Catalog 
            accessories={accessories} 
            setAccessories={async (newAcc) => {
              setAccessories(newAcc)
              await saveData('accessories', newAcc)
            }}
            responsibles={responsibles}
            setResponsibles={async (newResp) => {
              setResponsibles(newResp)
              await saveData('responsibles', newResp)
            }}
          />
        )
      default:
        return <Movements />
    }
  }

  return (
    <div className="app-container">
      <header>
        <div className="logo">
          <h1>ACESSÓRIOS <span>PRO</span></h1>
          <span className="developer-tag">Hivyson Jesus Developer</span>
        </div>
        <nav>
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
