import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download, TrendingUp, Users, Package, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Dashboard({ movements, accessories, responsibles }) {
  const [quickFilter, setQuickFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const filterMovements = (movs) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    return movs.filter(m => {
      const mDate = new Date(m.timestamp)
      
      // Se houver datas personalizadas, elas têm precedência
      if (customStartDate || customEndDate) {
        let start = new Date(0)
        if (customStartDate) {
          const [year, month, day] = customStartDate.split('-').map(Number)
          start = new Date(year, month - 1, day, 0, 0, 0, 0)
        }
        
        let end = new Date()
        if (customEndDate) {
          const [year, month, day] = customEndDate.split('-').map(Number)
          end = new Date(year, month - 1, day, 23, 59, 59, 999)
        }
        return mDate >= start && mDate <= end
      }

      // Caso contrário, usa os filtros rápidos
      switch (quickFilter) {
        case 'day':
          return mDate >= today
        case 'week':
          const lastWeek = new Date(today)
          lastWeek.setDate(lastWeek.getDate() - 7)
          return mDate >= lastWeek
        case 'month':
          const lastMonth = new Date(today)
          lastMonth.setMonth(lastMonth.getMonth() - 1)
          return mDate >= lastMonth
        case 'year':
          const lastYear = new Date(today)
          lastYear.setFullYear(lastYear.getFullYear() - 1)
          return mDate >= lastYear
        default:
          return true
      }
    })
  }

  const handleQuickFilter = (filter) => {
    setQuickFilter(filter)
    setCustomStartDate('')
    setCustomEndDate('')
  }
  
  const handleDateChange = (type, value) => {
    if (type === 'start') setCustomStartDate(value)
    if (type === 'end') setCustomEndDate(value)
    setQuickFilter('custom')
  }

  const filteredMovements = filterMovements(movements)

  // Data processing for charts
  const processAccessoryData = () => {
    const data = {}
    filteredMovements.forEach(m => {
      const acc = accessories.find(a => a.id === m.accessoryId)
      if (!acc) return
      const key = acc.factoryCode
      if (!data[key]) data[key] = { name: key, checkout: 0, return: 0, total: 0 }
      data[key][m.type]++
      data[key].total++
    })
    return Object.values(data).sort((a, b) => b.total - a.total)
  }

  const processResponsibleData = () => {
    const data = {}
    filteredMovements.forEach(m => {
      const resp = responsibles.find(r => r.id === m.responsibleId)
      if (!resp) return
      const key = resp.name
      if (!data[key]) data[key] = { name: key, count: 0 }
      data[key].count++
    })
    return Object.values(data).sort((a, b) => b.count - a.count)
  }

  const accData = processAccessoryData()
  const respData = processResponsibleData()

  const exportToExcel = () => {
    const data = filteredMovements.map(m => ({
      Data: new Date(m.timestamp).toLocaleString('pt-BR'),
      Tipo: m.type === 'checkout' ? 'Saída' : 'Retorno',
      'Cód. Fábrica': accessories.find(a => a.id === m.accessoryId)?.factoryCode || '?',
      'Nome Comercial': accessories.find(a => a.id === m.accessoryId)?.commercialName || '?',
      Responsável: responsibles.find(r => r.id === m.responsibleId)?.name || '?',
      'Ordem de Serviço': m.soNumber || '-'
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Movimentacoes")
    
    // Explicitly write as xlsx
    XLSX.writeFile(wb, "relatorio_acessorios.xlsx", { bookType: 'xlsx', type: 'binary' })
  }

  const COLORS = ['#38bdf8', '#10b981', '#fbbf24', '#f87171', '#a78bfa']

  return (
    <div className="tab-content">
      <div className="action-bar" style={{ flexWrap: 'wrap', gap: '1.5rem' }}>
        <h2>Dashboard de Métricas</h2>
        
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Calendário Fixo */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <Calendar size={18} style={{ color: 'var(--accent)' }} />
            <input 
              type="date" 
              value={customStartDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              style={{ 
                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem'
              }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>até</span>
            <input 
              type="date" 
              value={customEndDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              style={{ 
                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Filtros de Período (Botões) */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'day', label: 'Dia' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mês' },
              { id: 'year', label: 'Ano' }
            ].map(f => (
              <button 
                key={f.id}
                onClick={() => handleQuickFilter(f.id)}
                className={`nav-btn ${quickFilter === f.id ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={exportToExcel}>
          <Download size={18} /> Exportar
        </button>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-label">Movimentações</div>
          <div className="stat-value">{filteredMovements.length}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
            <TrendingUp size={14} /> Atividade no período
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Itens no Catálogo</div>
          <div className="stat-value">{accessories.length}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>
            <Package size={14} /> Patrimônio total
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Corpo Técnico</div>
          <div className="stat-value">{responsibles.length}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
            <Users size={14} /> Colaboradores ativos
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card" style={{ height: '400px' }}>
          <h3>Acessórios por Código de Fábrica</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={accData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Legend />
              <Bar dataKey="checkout" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="return" name="Retornos" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ height: '400px' }}>
          <h3>Participação por Responsável</h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={respData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                label={({ name }) => name}
              >
                {respData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                itemStyle={{ color: '#f8fafc' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
