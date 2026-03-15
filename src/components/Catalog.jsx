import React, { useState } from 'react'
import { Plus, Trash2, User, Package } from 'lucide-react'

export default function Catalog({ accessories, setAccessories, responsibles, setResponsibles }) {
  const [newAcc, setNewAcc] = useState({ factoryCode: '', commercialName: '' })
  const [newResp, setNewResp] = useState({ name: '' })

  const addAccessory = (e) => {
    e.preventDefault()
    if (!newAcc.factoryCode || !newAcc.commercialName) return
    setAccessories([...accessories, { ...newAcc, id: Date.now().toString() }])
    setNewAcc({ factoryCode: '', commercialName: '' })
  }

  const addResponsible = (e) => {
    e.preventDefault()
    if (!newResp.name) return
    setResponsibles([...responsibles, { ...newResp, id: Date.now().toString() }])
    setNewResp({ name: '' })
  }

  const removeAccessory = (id) => setAccessories(accessories.filter(a => a.id !== id))
  const removeResponsible = (id) => setResponsibles(responsibles.filter(r => r.id !== id))

  return (
    <div className="tab-content">
      <div className="grid">
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

          <div style={{ marginTop: '2rem', overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome Comercial</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {accessories.map(acc => (
                  <tr key={acc.id}>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{acc.factoryCode}</td>
                    <td style={{ fontWeight: 500 }}>{acc.commercialName}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => removeAccessory(acc.id)} 
                        className="btn-icon-danger"
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

          <div style={{ marginTop: '2rem', overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nome Completo</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {responsibles.map(resp => (
                  <tr key={resp.id}>
                    <td style={{ fontWeight: 500 }}>{resp.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => removeResponsible(resp.id)} 
                        className="btn-icon-danger"
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
