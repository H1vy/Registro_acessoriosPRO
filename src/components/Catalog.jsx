import React, { useState } from 'react'
import { Plus, Trash2, User, Package, Users, ShieldCheck, UserPlus, Lock, Edit2, Check, X, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { getAllData, addRecord, deleteRecord } from '../utils/db'

export default function Catalog({ accessories, setAccessories, responsibles, setResponsibles, currentUser }) {
  const [newAcc, setNewAcc] = useState({ factoryCode: '', commercialName: '' })
  const [newResp, setNewResp] = useState({ name: '' })
  
  // Paginação
  const [currentPageAcc, setCurrentPageAcc] = useState(1)
  const [currentPageResp, setCurrentPageResp] = useState(1)
  const [searchTermAcc, setSearchTermAcc] = useState('')
  const [searchTermResp, setSearchTermResp] = useState('')
  const itemsPerPage = 5

  // Edição
  const [editingAcc, setEditingAcc] = useState(null) // ID do acessório em edição
  const [editAccData, setEditAccData] = useState({ factoryCode: '', commercialName: '' })
  const [editingResp, setEditingResp] = useState(null) // ID do responsável em edição
  const [editRespData, setEditRespData] = useState({ name: '' })
  
  // Estados para Gestão de Usuários (Apenas Admin)
  const [dbUsers, setDbUsers] = useState([])
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })
  const [showUserManagement, setShowUserManagement] = useState(false)

  React.useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers()
    }
  }, [currentUser])

  const loadUsers = async () => {
    const users = await getAllData('users')
    setDbUsers(users)
  }

  const handleRegisterUser = async (e) => {
    e.preventDefault()
    if (!newUser.username || !newUser.password) return
    
    // Verificar se já existe
    if (dbUsers.find(u => u.username === newUser.username)) {
      alert('Usuário já existe!')
      return
    }

    const userData = { ...newUser, id: Date.now().toString() }
    await addRecord('users', userData)
    setNewUser({ username: '', password: '', role: 'user' })
    loadUsers()
    alert('Usuário cadastrado com sucesso!')
  }

  const removeUser = async (id) => {
    if (id === 'admin-id') {
      alert('Não é possível remover o administrador principal.')
      return
    }
    if (window.confirm('Excluir este usuário permanentemente?')) {
      await deleteRecord('users', id)
      loadUsers()
    }
  }

  const addAccessory = (e) => {
    e.preventDefault()
    if (!newAcc.factoryCode || !newAcc.commercialName) return
    
    const isDuplicate = accessories.some(acc => acc.factoryCode.toLowerCase() === newAcc.factoryCode.toLowerCase())
    if (isDuplicate) {
      alert('Já existe um acessório cadastrado com este Código de Fábrica.')
      return
    }

    setAccessories([...accessories, { ...newAcc, id: Date.now().toString() }])
    setNewAcc({ factoryCode: '', commercialName: '' })
  }

  const addResponsible = (e) => {
    e.preventDefault()
    if (!newResp.name) return

    const isDuplicate = responsibles.some(resp => resp.name.toLowerCase() === newResp.name.toLowerCase())
    if (isDuplicate) {
      alert('Já existe um responsável cadastrado com este Nome.')
      return
    }

    setResponsibles([...responsibles, { ...newResp, id: Date.now().toString() }])
    setNewResp({ name: '' })
  }

  const removeAccessory = (id) => setAccessories(accessories.filter(a => a.id !== id))
  const removeResponsible = (id) => setResponsibles(responsibles.filter(r => r.id !== id))

  const handleEditAcc = (acc) => {
    setEditingAcc(acc.id)
    setEditAccData({ factoryCode: acc.factoryCode, commercialName: acc.commercialName })
  }

  const saveEditAcc = () => {
    setAccessories(accessories.map(a => a.id === editingAcc ? { ...a, ...editAccData } : a))
    setEditingAcc(null)
  }

  const handleEditResp = (resp) => {
    setEditingResp(resp.id)
    setEditRespData({ name: resp.name })
  }

  const saveEditResp = () => {
    setResponsibles(responsibles.map(r => r.id === editingResp ? { ...r, ...editRespData } : r))
    setEditingResp(null)
  }

  // Ordenação e Filtragem
  const filteredAccessories = accessories.filter(acc => 
    acc.factoryCode.toLowerCase().includes(searchTermAcc.toLowerCase()) || 
    acc.commercialName.toLowerCase().includes(searchTermAcc.toLowerCase())
  )
  const sortedAccessories = [...filteredAccessories].sort((a, b) => a.factoryCode.localeCompare(b.factoryCode))

  const filteredResponsibles = responsibles.filter(resp => 
    resp.name.toLowerCase().includes(searchTermResp.toLowerCase())
  )
  const sortedResponsibles = [...filteredResponsibles].sort((a, b) => a.name.localeCompare(b.name))

  // Paginação
  const totalPagesAcc = Math.ceil(sortedAccessories.length / itemsPerPage)
  const paginatedAcc = sortedAccessories.slice((currentPageAcc - 1) * itemsPerPage, currentPageAcc * itemsPerPage)

  const totalPagesResp = Math.ceil(sortedResponsibles.length / itemsPerPage)
  const paginatedResp = sortedResponsibles.slice((currentPageResp - 1) * itemsPerPage, currentPageResp * itemsPerPage)

  return (
    <div className="tab-content">
      <div className="grid" style={{ gridTemplateColumns: currentUser?.role === 'admin' ? '1fr 1fr 1fr' : '1fr 1fr' }}>
        <div className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Package className="accent" /> Novos Acessórios
          </h2>
          <form onSubmit={addAccessory}>
            <div className="input-group">
              <label>Código de Fábrica</label>
              <input 
                type="text" 
                value={newAcc.factoryCode}
                onChange={(e) => setNewAcc({ ...newAcc, factoryCode: e.target.value })}
                placeholder="Ex: AC-123"
              />
            </div>
            <div className="input-group">
              <label>Nome Comercial</label>
              <input 
                type="text" 
                value={newAcc.commercialName}
                onChange={(e) => setNewAcc({ ...newAcc, commercialName: e.target.value })}
                placeholder="Ex: Capinha Silicone Azul"
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              <Plus size={18} /> Adicionar Acessório
            </button>
          </form>

          <div className="input-with-icon" style={{ marginTop: '1.5rem' }}>
            <Search size={18} style={{ left: '0.85rem' }} />
            <input 
              type="text" 
              placeholder="Pesquisar acessórios..." 
              value={searchTermAcc}
              onChange={(e) => {
                setSearchTermAcc(e.target.value)
                setCurrentPageAcc(1)
              }}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome Comercial</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAcc.map(acc => (
                  <tr key={acc.id}>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {editingAcc === acc.id ? (
                        <input 
                          type="text" 
                          value={editAccData.factoryCode} 
                          onChange={(e) => setEditAccData({ ...editAccData, factoryCode: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                      ) : acc.factoryCode}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {editingAcc === acc.id ? (
                        <input 
                          type="text" 
                          value={editAccData.commercialName} 
                          onChange={(e) => setEditAccData({ ...editAccData, commercialName: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                      ) : acc.commercialName}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {editingAcc === acc.id ? (
                          <>
                            <button onClick={saveEditAcc} className="btn-icon-edit" style={{ color: 'var(--success)' }}><Check size={16} /></button>
                            <button onClick={() => setEditingAcc(null)} className="btn-icon-edit" style={{ color: 'var(--danger)' }}><X size={16} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEditAcc(acc)} className="btn-icon-edit" title="Editar"><Edit2 size={16} /></button>
                            <button 
                              onClick={() => removeAccessory(acc.id)} 
                              className="btn-icon-danger"
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPagesAcc > 1 && (
            <div className="pagination-container">
              <button 
                className="pagination-btn" 
                disabled={currentPageAcc === 1} 
                onClick={() => setCurrentPageAcc(currentPageAcc - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-info">{currentPageAcc} / {totalPagesAcc}</span>
              <button 
                className="pagination-btn" 
                disabled={currentPageAcc === totalPagesAcc} 
                onClick={() => setCurrentPageAcc(currentPageAcc + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <User className="accent" size={28} /> Novos Responsáveis
          </h2>
          <form onSubmit={addResponsible}>
            <div className="input-group">
              <label>Nome do Responsável</label>
              <input 
                type="text" 
                value={newResp.name}
                onChange={(e) => setNewResp({ name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              <Plus size={18} /> Cadastrar Responsável
            </button>
          </form>

          <div className="input-with-icon" style={{ marginTop: '1.5rem' }}>
            <Search size={18} style={{ left: '0.85rem' }} />
            <input 
              type="text" 
              placeholder="Pesquisar responsáveis..." 
              value={searchTermResp}
              onChange={(e) => {
                setSearchTermResp(e.target.value)
                setCurrentPageResp(1)
              }}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nome Completo</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResp.map(resp => (
                  <tr key={resp.id}>
                    <td style={{ fontWeight: 500 }}>
                      {editingResp === resp.id ? (
                        <input 
                          type="text" 
                          value={editRespData.name} 
                          onChange={(e) => setEditRespData({ name: e.target.value })}
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                      ) : resp.name}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {editingResp === resp.id ? (
                          <>
                            <button onClick={saveEditResp} className="btn-icon-edit" style={{ color: 'var(--success)' }}><Check size={16} /></button>
                            <button onClick={() => setEditingResp(null)} className="btn-icon-edit" style={{ color: 'var(--danger)' }}><X size={16} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEditResp(resp)} className="btn-icon-edit" title="Editar"><Edit2 size={16} /></button>
                            <button 
                              onClick={() => removeResponsible(resp.id)} 
                              className="btn-icon-danger"
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPagesResp > 1 && (
            <div className="pagination-container">
              <button 
                className="pagination-btn" 
                disabled={currentPageResp === 1} 
                onClick={() => setCurrentPageResp(currentPageResp - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-info">{currentPageResp} / {totalPagesResp}</span>
              <button 
                className="pagination-btn" 
                disabled={currentPageResp === totalPagesResp} 
                onClick={() => setCurrentPageResp(currentPageResp + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {currentUser?.role === 'admin' && (
          <div className="card">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <ShieldCheck className="accent" size={28} /> Gestão de Usuários
            </h2>
            <form onSubmit={handleRegisterUser}>
              <div className="input-group">
                <label>Novo Usuário</label>
                <div style={{ position: 'relative' }}>
                  <UserPlus size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  <input 
                    type="text" 
                    style={{ paddingLeft: '32px' }}
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Nome de login"
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Senha Provisória</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  <input 
                    type="password" 
                    style={{ paddingLeft: '32px' }}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Senha inicial"
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Criar Nova Conta
              </button>
            </form>

            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase' }}>Usuários Ativos</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dbUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={14} className="accent" />
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{u.username}</span>
                      {u.role === 'admin' && <span style={{ fontSize: '0.6rem', background: 'var(--accent)', color: '#020617', padding: '1px 4px', borderRadius: '4px', fontWeight: 700 }}>ADMIN</span>}
                    </div>
                    {u.role !== 'admin' && (
                      <button onClick={() => removeUser(u.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
