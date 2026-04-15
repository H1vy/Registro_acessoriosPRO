import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download, TrendingUp, Users, Package, Calendar, X } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Dashboard({ movements, accessories, responsibles }) {
  const [quickFilter, setQuickFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeResponsible, setActiveResponsible] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (chartRef.current && !chartRef.current.contains(e.target)) {
        setActiveResponsible(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Limpar responsável ativo se os movimentos forem resetados (ex: Limpar Histórico)
  useEffect(() => {
    if (movements.length === 0) setActiveResponsible(null)
  }, [movements])

  const filterMovements = (movs) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    return movs.filter(m => {
      if (m.isDeleted) return false // Ignorar registros removidos logicamente
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
      if (m.isDeleted) return // Segurança extra
      const acc = accessories.find(a => a.id === m.accessoryId)
      if (!acc) return
      const key = acc.factoryCode
      if (!data[key]) data[key] = { name: key, checkout: 0, return: 0, total: 0 }
      
      if (m.isReturn) {
        data[key].return++
      } else if (!m.annulled) {
        data[key].checkout++
      }
      
      data[key].total++
    })
    return Object.values(data)
      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.total - a.total)
  }

  const processResponsibleData = () => {
    const data = {}
    filteredMovements.forEach(m => {
      const resp = responsibles.find(r => r.id === m.responsibleId)
      if (!resp) return
      const key = resp.name
      if (!data[key]) data[key] = { name: key, count: 0, movements: [] }
      
      const acc = accessories.find(a => a.id === m.accessoryId)
      let inDate = null;
      if (m.isReturn && m.returnInfo) inDate = m.returnInfo.timestamp;
      else if (m.checkin) inDate = m.checkin.timestamp;
      
      data[key].movements.push({
        code: acc ? acc.factoryCode : 'Desconhecido',
        out: m.timestamp,
        in: inDate,
        isReturn: m.isReturn,
        annulled: m.annulled,
        isDeleted: m.isDeleted,
        checkin: m.checkin,
        reason: m.reason || m.returnInfo?.returnReason || m.deletionReason
      })
      data[key].count++
    })
    return Object.values(data).sort((a, b) => b.count - a.count)
  }

  // Obter movimentos específicos do responsável ativo em tempo real
  const getActiveResponsibleMovements = () => {
    if (!activeResponsible) return []
    return filteredMovements
      .filter(m => {
        const resp = responsibles.find(r => r.id === m.responsibleId)
        return resp && resp.name === activeResponsible.name
      })
      .map(m => {
        const acc = accessories.find(a => a.id === m.accessoryId)
        let inDate = null;
        if (m.isReturn && m.returnInfo) inDate = m.returnInfo.timestamp;
        else if (m.checkin) inDate = m.checkin.timestamp;

        return {
          code: acc ? acc.factoryCode : 'Desconhecido',
          out: m.timestamp,
          in: inDate,
          isReturn: m.isReturn,
          annulled: m.annulled,
          checkin: m.checkin,
          reason: m.reason || m.returnInfo?.returnReason || m.deletionReason
        }
      })
  }

  const processDailyTrendData = () => {
    const data = {}
    filteredMovements.forEach(m => {
      const date = new Date(m.timestamp).toLocaleDateString('pt-BR')
      if (!data[date]) data[date] = { date, checkout: 0, return: 0 }
      
      if (m.isReturn) {
        data[date].return++
      } else if (!m.annulled) {
        data[date].checkout++
      }
    })
    // Sort by date (assuming DD/MM/YYYY format, might need conversion for proper sort if many dates)
    return Object.values(data).sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'))
      const dateB = new Date(b.date.split('/').reverse().join('-'))
      return dateA - dateB
    })
  }

  const accData = processAccessoryData()
  const respData = processResponsibleData()
  const dailyTrendData = processDailyTrendData()

  const exportToExcel = () => {
    // Para o Excel, exportamos TUDO, inclusive os deletados
    const data = movements.map(m => {
      const accessory = accessories.find(a => a.id === m.accessoryId);
      const responsible = responsibles.find(r => r.id === m.responsibleId);
      
      return {
        'Data Saída': new Date(m.timestamp).toLocaleString('pt-BR'),
        'Cód. Fábrica': accessory ? accessory.factoryCode : '(Registro Nulo/Deletado)',
        'Nome Comercial': accessory ? accessory.commercialName : '(N/A)',
        'Responsável Saída': responsible ? responsible.name : '(Registro Nulo/Deletado)',
        'Ordem de Serviço': m.soNumber || '-',
        'Autor Saída': m.author || 'Sistema',
        'Status Atual': m.isReturn ? 'RETORNO' : 'SAÍDA',
        'Justificativa Anulação': !m.isReturn ? (m.reason || '-') : 'N/A',
        'Retornado': m.isReturn ? 'Sim' : 'Não',
        'Quem Retornou': m.returnInfo?.returnedBy || '-',
        'Data Retorno': m.isReturn ? new Date(m.returnInfo?.timestamp).toLocaleString('pt-BR') : '-',
        'Check-in Realizado': m.checkin ? 'Sim' : 'Não',
        'Data Check-in': m.checkin ? new Date(m.checkin.timestamp).toLocaleString('pt-BR') : '-',
        'Autor Check-in': m.checkin?.author || '-',
        'REMOVIDO DO HISTÓRICO': m.isDeleted ? 'SIM' : 'NÃO',
        'MOTIVO DA REMOÇÃO': m.deletionReason || '-',
        'DATA DA REMOÇÃO': m.deletionTimestamp ? new Date(m.deletionTimestamp).toLocaleString('pt-BR') : '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Movimentacoes")
    
    // Explicitly write as xlsx
    XLSX.writeFile(wb, "relatorio_acessorios.xlsx", { bookType: 'xlsx', type: 'binary' })
  }

  const COLORS = ['#38bdf8', '#10b981', '#fbbf24', '#f87171', '#a78bfa']

  return (
    <div className="tab-content dashboard-container">
      <div className="action-bar" style={{ flexWrap: 'wrap', gap: '1.25rem' }}>
        <h2>Dashboard de Métricas</h2>
        
        <div className="dashboard-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Calendário Fixo */}
          <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', flex: '1 1 auto', justifyContent: 'center' }}>
            <Calendar size={18} style={{ color: 'var(--accent)' }} />
            <input 
              type="date" 
              value={customStartDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              style={{ 
                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem', width: 'auto'
              }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>até</span>
            <input 
              type="date" 
              value={customEndDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              style={{ 
                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)',
                padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem', width: 'auto'
              }}
            />
          </div>

          {/* Filtros de Período (Botões) */}
          <div className="filter-group" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--border)', flex: '1 1 auto', justifyContent: 'center' }}>
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'day', label: 'Dia' },
              { id: 'week', label: 'Sem' },
              { id: 'month', label: 'Mês' },
              { id: 'year', label: 'Ano' }
            ].map(f => (
              <button 
                key={f.id}
                onClick={() => handleQuickFilter(f.id)}
                className={`nav-btn ${quickFilter === f.id ? 'active' : ''}`}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', minWidth: '45px' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={exportToExcel} style={{ flex: '1 1 100%' }}>
          <Download size={18} /> Exportar Relatório Excel
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
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>Fluxo Diário e Movimentações por Código</h3>
            
            <div style={{ position: 'relative', flex: '0 1 250px' }}>
              <input 
                type="text" 
                placeholder="Buscar por código..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  padding: '0.6rem 1rem', 
                  fontSize: '0.85rem', 
                  background: 'var(--bg-input)', 
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  width: '100%'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div className="chart-wrapper" style={{ flex: '1 1 100%', minHeight: '300px', height: 'auto', maxHeight: '400px' }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 500 }} dy={10} />
                  <YAxis stroke="#64748b" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--bg-card)', 
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                      zIndex: 1000
                    }}
                    itemStyle={{ fontSize: '0.85rem', fontWeight: 600 }}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" height={36} wrapperStyle={{ fontSize: '0.85rem', fontWeight: 600, paddingBottom: '10px' }} />
                  <Bar dataKey="checkout" name="Saídas" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="return" name="Retornos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ flex: '1 1 300px', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
              <div className="table-container" style={{ marginTop: 0 }}>
                <table style={{ marginTop: 0, width: '100%', borderSpacing: '0 4px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1, backdropFilter: 'blur(8px)' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', fontSize: '0.7rem' }}>CÓDIGO</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>SAÍDAS</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>RETORNOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accData.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                        <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.85rem', textAlign: 'center', color: '#38bdf8', fontWeight: 700 }}>{item.checkout}</td>
                        <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.85rem', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{item.return}</td>
                      </tr>
                    ))}
                    {accData.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Sem movimentações no período</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ height: '420px', position: 'relative', display: 'flex', flexDirection: 'column' }} ref={chartRef}>
          <h3 style={{ marginBottom: '1rem' }}>Participação por Responsável</h3>
          <div style={{ flex: 1, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart onClick={(e) => { if (!e) setActiveResponsible(null) }}>
                <Pie
                  data={respData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  innerRadius={75}
                  outerRadius={105}
                  paddingAngle={5}
                  dataKey="count"
                  onClick={(data, index, e) => {
                    if (e) e.stopPropagation();
                    setActiveResponsible(data.payload);
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {respData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      stroke="none"
                      style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.2))' }}
                    />
                  ))}
                </Pie>
                <text x="50%" y="48%" className="donut-center-text" style={{ fontSize: '2rem' }}>
                  {filteredMovements.length}
                </text>
                <text x="50%" y="58%" className="donut-center-text" style={{ fontSize: '0.75rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Total Geral
                </text>
                <Tooltip 
                  contentStyle={{ 
                    background: 'var(--bg-card)', 
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          
        </div>
      </div>

      {/* Overlay de Histórico do Responsável */}
      {activeResponsible && (
        <>
          <div 
            className="modal-backdrop" 
            style={{ display: 'block', zIndex: 9999 }} 
            onClick={() => setActiveResponsible(null)}
          />
          <div className="custom-scrollbar active-responsible-overlay" style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10000,
            background: 'var(--bg-card)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '28px',
            boxShadow: '0 40px 80px -15px rgba(0, 0, 0, 0.9), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
            padding: '2rem',
            width: '92%',
            maxWidth: '450px',
            maxHeight: '85vh',
            overflowY: 'auto',
            color: 'var(--text-primary)',
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--accent)', color: '#000', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  {activeResponsible.name.charAt(0)}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{activeResponsible.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.8 }}>Relatório de Movimentações</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveResponsible(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Realizado</span>
              <span style={{ backgroundColor: 'var(--accent)', color: '#000', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 800 }}>{activeResponsible.count}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {getActiveResponsibleMovements().slice().sort((a, b) => new Date(b.out) - new Date(a.out)).map((mov, i) => {
                let statusLabel = 'Saída';
                let statusColor = 'var(--accent)';
                let borderStyle = '3px solid var(--accent)';
                
                if (mov.isDeleted) {
                  statusLabel = 'Removido';
                  statusColor = '#ef4444';
                  borderStyle = '3px dashed #ef4444';
                } else if (mov.annulled && !mov.isReturn) {
                  statusLabel = 'Anulado';
                  statusColor = '#f87171';
                  borderStyle = '3px solid #f87171';
                } else if (mov.isReturn || mov.checkin) {
                  statusLabel = 'Finalizado';
                  statusColor = '#10b981';
                  borderStyle = '3px solid #10b981';
                }

                return (
                  <div key={i} style={{ 
                    fontSize: '0.8rem', 
                    background: 'var(--bg-input)', 
                    padding: '0.6rem 0.75rem', 
                    borderRadius: '10px',
                    borderLeft: borderStyle,
                    marginBottom: '2px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{mov.code}</strong>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: statusColor, textTransform: 'uppercase' }}>{statusLabel}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>
                      <div>Retirada: {new Date(mov.out).toLocaleString('pt-BR')}</div>
                      {mov.in && (
                        <div style={{ color: mov.isReturn ? '#6ee7b7' : '#fbbf24' }}>
                          {mov.isReturn ? 'Retorno' : 'Check-in'}: {new Date(mov.in).toLocaleString('pt-BR')}
                        </div>
                      )}
                      {mov.reason && <div style={{ fontSize: '0.7rem', fontStyle: 'italic', marginTop: '2px', opacity: 0.8 }}>Motivo: {mov.reason}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
