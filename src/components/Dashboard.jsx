import React, { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area
} from 'recharts'
import {
  Download, TrendingUp, TrendingDown, Users, Package,
  Calendar, X, Activity, Clock, CheckCircle, BarChart2
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ── Separador de seção ─────────────────────────────────────────────────────
const SectionDivider = ({ icon: Icon, label, color = 'var(--accent)' }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    margin: '2.5rem 0 1.5rem'
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.4rem 0.9rem', borderRadius: '20px',
      background: color + '15', border: `1px solid ${color}30`,
      color, fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap'
    }}>
      {Icon && <Icon size={16} />}
      {label}
    </div>
    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
  </div>
)

// ── Card KPI ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color, badge, badgeLabel }) => (
  <div className="card" style={{
    padding: '1.25rem 1.5rem',
    borderLeft: `4px solid ${color}`,
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    position: 'relative', overflow: 'hidden'
  }}>
    <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.07 }}>
      {Icon && <Icon size={60} />}
    </div>
    <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
      {label}
    </span>
    <span style={{ fontSize: '2.2rem', fontWeight: 800, color, lineHeight: 1 }}>
      {value}
    </span>
    {sub && (
      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{sub}</span>
    )}
    {badge !== undefined && (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        marginTop: '0.35rem',
        padding: '2px 8px', borderRadius: '10px', fontSize: '0.73rem', fontWeight: 700,
        background: badge > 0 ? 'rgba(56,189,248,0.12)' : 'var(--bg-input)',
        color: badge > 0 ? '#38bdf8' : 'var(--text-secondary)',
        border: badge > 0 ? '1px solid rgba(56,189,248,0.25)' : '1px solid var(--border)',
        width: 'fit-content'
      }}>
        {badge > 0 ? <TrendingUp size={11} /> : <Activity size={11} />}
        {badge > 0 ? `+${badge}` : '0'} {badgeLabel || 'hoje'}
      </span>
    )}
  </div>
)

export default function Dashboard({ movements, accessories, responsibles, orders, currentUser }) {
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

  const isAtendimento = currentUser?.sector === 'atendimento' && currentUser?.role !== 'admin'
  const isAdmin = currentUser?.role === 'admin'

  // ── Hoje (contagem fixa, independente de filtro) ──────────────────────────
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const todayMovCount = movements.filter(m => {
    if (m.isDeleted) return false
    return new Date(m.timestamp) >= todayStart
  }).length

  const todayOrderCount = (orders || []).filter(o => {
    if (!o.requestedAt) return false
    return new Date(o.requestedAt) >= todayStart
  }).length

  // ── Filtro de movimentações ────────────────────────────────────────────────
  const filterMovements = (movs) => {
    return movs.filter(m => {
      if (m.isDeleted) return false
      const mDate = new Date(m.timestamp)

      if (customStartDate || customEndDate) {
        let start = new Date(0)
        if (customStartDate) {
          const [yr, mo, dy] = customStartDate.split('-').map(Number)
          start = new Date(yr, mo - 1, dy, 0, 0, 0, 0)
        }
        let end = new Date()
        if (customEndDate) {
          const [yr, mo, dy] = customEndDate.split('-').map(Number)
          end = new Date(yr, mo - 1, dy, 23, 59, 59, 999)
        }
        return mDate >= start && mDate <= end
      }

      switch (quickFilter) {
        case 'day': return mDate >= todayStart
        case 'week': { const lw = new Date(todayStart); lw.setDate(lw.getDate() - 7); return mDate >= lw }
        case 'month': { const lm = new Date(todayStart); lm.setMonth(lm.getMonth() - 1); return mDate >= lm }
        case 'year': { const ly = new Date(todayStart); ly.setFullYear(ly.getFullYear() - 1); return mDate >= ly }
        default: return true
      }
    })
  }

  const handleQuickFilter = (f) => { setQuickFilter(f); setCustomStartDate(''); setCustomEndDate('') }

  const handleDateChange = (type, value) => {
    if (type === 'start') setCustomStartDate(value)
    if (type === 'end') setCustomEndDate(value)
    setQuickFilter('custom')
  }

  const filteredMovements = filterMovements(movements)

  const periodLabel = () => {
    if (quickFilter === 'day') return 'Hoje'
    if (quickFilter === 'week') return 'Última semana'
    if (quickFilter === 'month') return 'Último mês'
    if (quickFilter === 'year') return 'Último ano'
    if (quickFilter === 'custom') return 'Período personalizado'
    return 'Todos os registros'
  }

  // ── Processamento acessórios ──────────────────────────────────────────────
  const processAccessoryData = () => {
    const data = {}
    filteredMovements.forEach(m => {
      if (m.isDeleted) return
      const acc = accessories.find(a => a.id === m.accessoryId)
      if (!acc) return
      const key = acc.factoryCode
      if (!data[key]) data[key] = { name: key, checkout: 0, return: 0, total: 0 }
      if (m.isReturn) { data[key].return++ }
      else if (!m.annulled) { data[key].checkout++ }
      data[key].total++
    })
    return Object.values(data)
      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.total - a.total)
  }

  // ── Processamento responsáveis ────────────────────────────────────────────
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

  const getActiveResponsibleMovements = () => {
    if (!activeResponsible) return []
    return movements
      .filter(m => {
        const resp = responsibles.find(r => r.id === m.responsibleId)
        if (!resp || resp.name !== activeResponsible.name) return false
        const mDate = new Date(m.timestamp)
        if (customStartDate || customEndDate) {
          let start = new Date(0)
          if (customStartDate) {
            const [yr, mo, dy] = customStartDate.split('-').map(Number)
            start = new Date(yr, mo - 1, dy, 0, 0, 0, 0)
          }
          let end = new Date()
          if (customEndDate) {
            const [yr, mo, dy] = customEndDate.split('-').map(Number)
            end = new Date(yr, mo - 1, dy, 23, 59, 59, 999)
          }
          return mDate >= start && mDate <= end
        }
        switch (quickFilter) {
          case 'day': return mDate >= todayStart
          case 'week': { const lw = new Date(todayStart); lw.setDate(lw.getDate() - 7); return mDate >= lw }
          case 'month': { const lm = new Date(todayStart); lm.setMonth(lm.getMonth() - 1); return mDate >= lm }
          case 'year': { const ly = new Date(todayStart); ly.setFullYear(ly.getFullYear() - 1); return mDate >= ly }
          default: return true
        }
      })
      .map(m => {
        const acc = accessories.find(a => a.id === m.accessoryId)
        let inDate = null
        if (m.isReturn && m.returnInfo) inDate = m.returnInfo.timestamp
        else if (m.checkin) inDate = m.checkin.timestamp
        
        let status = 'Saída'
        let displayDate = m.timestamp
        
        if (m.isDeleted) {
          status = 'Excluído'
        } else if (m.annulled) {
          status = 'Anulado'
        } else if (m.isReturn || inDate) {
          status = 'Retorno'
          if (inDate) displayDate = inDate
        }
        
        return { code: acc ? acc.factoryCode : 'Descnh.', date: displayDate, status }
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  const processDailyTrend = () => {
    const data = {}
    filteredMovements.forEach(m => {
      const date = new Date(m.timestamp).toLocaleDateString('pt-BR')
      if (!data[date]) data[date] = { date, checkout: 0, return: 0 }
      if (m.isReturn) { data[date].return++ }
      else if (!m.annulled) { data[date].checkout++ }
    })
    return Object.values(data).sort((a, b) => {
      const da = new Date(a.date.split('/').reverse().join('-'))
      const db = new Date(b.date.split('/').reverse().join('-'))
      return da - db
    })
  }

  // ── Processamento pedidos ─────────────────────────────────────────────────
  const processOrderData = () => {
    if (!orders || !Array.isArray(orders)) {
      return { ordersByStatus: [], userStats: [], totalOrders: 0, pendingOrders: 0, inProgressOrders: 0, completedOrders: 0 }
    }
    const active = orders.filter(o => !o.annulled && !o.removed)
    const all = orders // inclui anulados e removidos para stats por usuário

    const ordersByStatus = [
      { name: 'Pendente', value: active.filter(o => o.status === 1).length, fill: '#eab308' },
      { name: 'Criado', value: active.filter(o => o.status === 2).length, fill: '#3b82f6' },
      { name: 'Pronto', value: active.filter(o => o.status === 3).length, fill: '#22c55e' },
      { name: 'Retirado', value: active.filter(o => o.status === 4).length, fill: '#a855f7' }
    ]

    // stats por usuário — contempla todos os pedidos (inclusive anulados e removidos)
    const byUser = {}
    orders.forEach(o => {
      const u = o.requestedBy
      if (!u) return
      if (!byUser[u]) byUser[u] = { user: u, total: 0, retirado: 0, andamento: 0, anulado: 0, removido: 0 }
      byUser[u].total++
      if (o.removed) byUser[u].removido++
      else if (o.annulled) byUser[u].anulado++
      else if (o.status === 4) byUser[u].retirado++
      else byUser[u].andamento++
    })
    const userStats = Object.values(byUser).sort((a, b) => b.total - a.total)

    return {
      ordersByStatus, userStats,
      totalOrders: active.length,
      pendingOrders: active.filter(o => o.status === 1).length,
      inProgressOrders: active.filter(o => o.status === 2 || o.status === 3).length,
      completedOrders: active.filter(o => o.status === 4).length
    }
  }


  const accData = processAccessoryData()
  const respData = processResponsibleData()
  const dailyTrend = processDailyTrend()
  const orderData = processOrderData()

  const CHART_COLORS = ['#38bdf8', '#10b981', '#fbbf24', '#f87171', '#a78bfa', '#fb923c']

  const formatDate = (isoStr) => {
    if (!isoStr) return '-'
    return new Date(isoStr).toLocaleString('pt-BR')
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 1: return 'Pendente'; case 2: return 'Criado'
      case 3: return 'Pronto'; case 4: return 'Retirado'; default: return '-'
    }
  }

  // ── Exportação Excel com 2 abas ───────────────────────────────────────────
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Aba 1: Movimentações
    const movData = movements.map(m => {
      const acc = accessories.find(a => a.id === m.accessoryId)
      const resp = responsibles.find(r => r.id === m.responsibleId)
      return {
        'Data Saída': new Date(m.timestamp).toLocaleString('pt-BR'),
        'Cód. Fábrica': acc ? acc.factoryCode : '(Removido)',
        'Nome Comercial': acc ? acc.commercialName : '(N/A)',
        'Responsável Saída': resp ? resp.name : '(Removido)',
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
      }
    })
    const ws1 = XLSX.utils.json_to_sheet(movData)
    XLSX.utils.book_append_sheet(wb, ws1, 'Movimentações')

    // Aba 2: Pedidos
    const ordData = (orders || []).map(o => ({
      'N° O.S.': o.osNumber,
      'Cliente': o.clientName,
      'Acessório': o.accessoryName,
      'Status': o.removed ? 'REMOVIDO' : o.annulled ? 'Anulado' : getStatusLabel(o.status),
      'Solicitado por': o.requestedBy || '-',
      'Data/Hora Solicitação': formatDate(o.requestedAt),
      'Criado por': o.createdBy || '-',
      'Data/Hora Criação': formatDate(o.createdAt),
      'Previsão de Chegada': formatDate(o.estimatedArrival),
      'Chegada reg. por': o.readyRegisteredBy || '-',
      'Data/Hora Chegada': formatDate(o.readyRegisteredAt),
      'Retirado por': o.withdrawnBy || '-',
      'Data/Hora Retirada': formatDate(o.withdrawnAt),
      'Saída reg. por': o.withdrawalRegisteredBy || '-',
      'Última Edição Por': o.lastEditedBy || '-',
      'Anulado': o.annulled ? 'Sim' : 'Não',
      'Motivo Anulação': o.annulledReason || '-',
      'Anulado por': o.annulledBy || '-',
      'Data/Hora Anulação': formatDate(o.annulledAt),
      'REMOVIDO': o.removed ? 'SIM' : 'NÃO',
      'MOTIVO DA REMOÇÃO': o.removedReason || '-',
      'REMOVIDO POR': o.removedBy || '-',
      'DATA/HORA REMOÇÃO': formatDate(o.removedAt)
    }))
    const ws2 = XLSX.utils.json_to_sheet(ordData)
    XLSX.utils.book_append_sheet(wb, ws2, 'Pedidos')

    XLSX.writeFile(wb, `relatorio_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ── Tooltip customizado ───────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem'
      }}>
        <p style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: '2px 0' }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="tab-content" style={{ padding: '0' }}>

      {/* ════════════════════════════════════════════════════════════════
          SEÇÃO: MOVIMENTAÇÕES (Admin e Estoque)
      ════════════════════════════════════════════════════════════════ */}
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Dashboard</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                {periodLabel()} · {filteredMovements.length} movimentações
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Filtros rápidos */}
              <div style={{
                display: 'flex', gap: '2px', alignItems: 'center',
                background: 'var(--bg-input)', padding: '4px', borderRadius: '10px',
                border: '1px solid var(--border)'
              }}>
                {[
                  { id: 'all', label: 'Tudo' }, { id: 'day', label: 'Hoje' },
                  { id: 'week', label: 'Sem' }, { id: 'month', label: 'Mês' },
                  { id: 'year', label: 'Ano' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleQuickFilter(f.id)}
                    style={{
                      padding: '0.3rem 0.65rem', borderRadius: '7px', fontSize: '0.8rem',
                      fontWeight: quickFilter === f.id ? 700 : 400,
                      background: quickFilter === f.id ? 'var(--accent)' : 'transparent',
                      color: quickFilter === f.id ? '#020617' : 'var(--text-secondary)',
                      border: 'none', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Intervalo de datas */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--bg-card)', padding: '0.35rem 0.75rem',
                borderRadius: '10px', border: '1px solid var(--border)'
              }}>
                <Calendar size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <input
                  type="date" value={customStartDate}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.25rem 0.5rem',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    colorScheme: 'dark',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>–</span>
                <input
                  type="date" value={customEndDate}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.25rem 0.5rem',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    colorScheme: 'dark',
                    cursor: 'pointer'
                  }}
                />
                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => { setCustomStartDate(''); setCustomEndDate(''); setQuickFilter('all') }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-secondary)', display: 'flex', padding: '2px',
                      borderRadius: '4px'
                    }}
                    title="Limpar datas"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Exportar */}
              <button
                className="btn-primary"
                onClick={exportToExcel}
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
              >
                <Download size={16} />
                Exportar Excel
              </button>
            </div>
          </div>

          {/* ── KPI Cards 4 colunas ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem'
          }}>
            <KpiCard
              label={`Movimentações (${periodLabel()})`}
              value={filteredMovements.length}
              sub={`De ${movements.filter(m => !m.isDeleted).length} registros totais`}
              icon={Activity}
              color="#38bdf8"
              badge={todayMovCount}
              badgeLabel="hoje"
            />
            <KpiCard
              label="Hoje"
              value={todayMovCount}
              sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
              icon={Clock}
              color={todayMovCount > 0 ? '#10b981' : '#6b7280'}
            />
            <KpiCard
              label="Itens no Catálogo"
              value={accessories.length}
              sub="Patrimônio total cadastrado"
              icon={Package}
              color="#fbbf24"
            />
            <KpiCard
              label="Corpo Técnico"
              value={responsibles.length}
              sub="Colaboradores ativos"
              icon={Users}
              color="#a78bfa"
            />
          </div>

          {/* ── Gráficos (2 colunas) ── */}
          {(accData.length > 0 || respData.length > 0) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              {/* Barras de acessórios */}
              {accData.length > 0 && (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '1.25rem', gap: '0.5rem', flexWrap: 'wrap'
                  }}>
                    <h4 style={{ margin: 0 }}>Acessórios Mais Movimentados</h4>
                    <input
                      type="text"
                      placeholder="Filtrar código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        padding: '0.3rem 0.65rem', borderRadius: '6px',
                        border: '1px solid var(--border)', background: 'var(--bg-input)',
                        color: 'var(--text-primary)', fontSize: '0.8rem', width: '140px'
                      }}
                    />
                  </div>
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={accData.slice(0, 8)} margin={{ top: 10, right: 10, left: -10, bottom: 5 }} barCategoryGap="28%">
                      <defs>
                        <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="gradRet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="var(--text-secondary)" fontSize={10}
                        tick={{ fill: 'var(--text-secondary)' }}
                        tickLine={false} axisLine={false}
                      />
                      <YAxis
                        stroke="var(--text-secondary)" fontSize={11}
                        tick={{ fill: 'var(--text-secondary)' }}
                        tickLine={false} axisLine={false} allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                      <Legend
                        wrapperStyle={{ fontSize: '0.82rem', paddingTop: '0.5rem' }}
                        iconType="circle"
                      />
                      <Bar dataKey="checkout" name="Saídas" fill="url(#gradOut)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="return" name="Retornos" fill="url(#gradRet)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Pizza de responsáveis */}
              {respData.length > 0 && (
                <div className="card" style={{ padding: '1.5rem' }} ref={chartRef}>
                  <h4 style={{ margin: '0 0 1.25rem' }}>Participação por Responsável</h4>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <defs>
                          {CHART_COLORS.map((color, i) => (
                            <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={color} stopOpacity={1} />
                              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie
                          data={respData}
                          cx="50%" cy="50%"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={3}
                          dataKey="count"
                          nameKey="name"
                          onClick={(d) => setActiveResponsible(d)}
                          style={{ cursor: 'pointer', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}
                        >
                          {respData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={`url(#pieGrad${i % CHART_COLORS.length})`}
                              stroke={CHART_COLORS[i % CHART_COLORS.length]}
                              strokeWidth={1}
                              opacity={activeResponsible ? (activeResponsible.name === respData[i]?.name ? 1 : 0.3) : 1}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Legend
                          verticalAlign="bottom" align="center"
                          iconType="circle" height={40}
                          wrapperStyle={{ fontSize: '0.8rem', fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Detalhe do responsável ao clicar */}
                  {activeResponsible && (
                    <div style={{
                      marginTop: '1rem', maxHeight: '180px', overflowY: 'auto',
                      background: 'var(--bg-input)', borderRadius: '8px',
                      padding: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{activeResponsible.name}</span>
                        <button
                          onClick={() => setActiveResponsible(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '3px 4px', textAlign: 'left', color: 'var(--text-secondary)' }}>Código</th>
                            <th style={{ padding: '3px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>Data/Hora</th>
                            <th style={{ padding: '3px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getActiveResponsibleMovements().map((mv, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '3px 4px', fontWeight: 600 }}>{mv.code}</td>
                              <td style={{ padding: '3px 4px', textAlign: 'center', color: 'var(--text-primary)' }}>
                                {new Date(mv.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                                  background: mv.status === 'Excluído' ? 'rgba(75,85,99,0.2)' : 
                                              mv.status === 'Anulado' ? 'rgba(239,68,68,0.15)' :
                                              mv.status === 'Retorno' ? 'rgba(16,185,129,0.15)' : 'rgba(56,189,248,0.15)',
                                  color: mv.status === 'Excluído' ? '#9ca3af' : 
                                         mv.status === 'Anulado' ? '#ef4444' :
                                         mv.status === 'Retorno' ? '#10b981' : '#38bdf8'
                                }}>
                                  {mv.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tendência diária (largura total) ── */}
          {dailyTrend.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', marginBottom: '0' }}>
              <h4 style={{ margin: '0 0 1.25rem' }}>Tendência Diária de Movimentações</h4>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="areaOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="areaRet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-secondary)" fontSize={11}
                    tick={{ fill: 'var(--text-secondary)' }}
                    tickLine={false} axisLine={false}
                  />
                  <YAxis
                    stroke="var(--text-secondary)" fontSize={11}
                    tick={{ fill: 'var(--text-secondary)' }}
                    tickLine={false} axisLine={false} allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, fill: 'transparent' }} />
                  <Legend
                    wrapperStyle={{ fontSize: '0.82rem', paddingTop: '0.5rem' }}
                    iconType="circle"
                  />
                  <Area
                    type="monotone" dataKey="checkout" name="Saídas"
                    stroke="#38bdf8" strokeWidth={2.5}
                    fill="url(#areaOut)" dot={{ fill: '#38bdf8', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone" dataKey="return" name="Retornos"
                    stroke="#10b981" strokeWidth={2.5}
                    fill="url(#areaRet)" dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

      {/* ════════════════════════════════════════════════════════════════
          SEÇÃO: PAINEL DE PEDIDOS — visível para TODOS
      ════════════════════════════════════════════════════════════════ */}
      <SectionDivider icon={Package} label="Painel de Pedidos" color="#a855f7" />

      {/* KPI cards de pedidos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <KpiCard label="Pedidos Pendentes" value={orderData.pendingOrders} icon={Clock} color="#eab308" badge={todayOrderCount} badgeLabel="solicitados hoje" />
        <KpiCard label="Criados" value={(orders || []).filter(o => !o.annulled && !o.removed && o.status === 2).length} icon={BarChart2} color="#3b82f6" />
        <KpiCard label="Prontos p/ Retirada" value={(orders || []).filter(o => !o.annulled && !o.removed && o.status === 3).length} icon={Package} color="#22c55e" />
        <KpiCard label="Retirados" value={orderData.completedOrders} icon={CheckCircle} color="#a855f7" />
      </div>

      {/* Gráficos de pedidos — 2 colunas */}
      {orderData.totalOrders > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          {/* Pizza de status */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem' }}>Distribuição por Status</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={orderData.ordersByStatus.filter(d => d.value > 0)}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {orderData.ordersByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.82rem', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Barras horizontais */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem' }}>Quantidade por Status</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={orderData.ordersByStatus}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} width={65} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" name="Pedidos" radius={[0, 5, 5, 0]}>
                  {orderData.ordersByStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Painel de solicitações por usuário — gráfico empilhado + tabela */}
      {orderData.userStats.length > 0 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Pedidos por Solicitante</h4>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Distribuição do ciclo completo: em andamento, retirados, anulados e removidos.
          </p>

          {/* Gráfico de barras empilhadas horizontais */}
          <ResponsiveContainer width="100%" height={Math.max(120, orderData.userStats.length * 48)}>
            <BarChart
              data={orderData.userStats}
              layout="vertical"
              margin={{ top: 4, right: 30, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
              <YAxis
                type="category" dataKey="user"
                stroke="var(--text-secondary)" fontSize={12}
                width={90} tick={{ fontWeight: 600 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Legend
                verticalAlign="top" wrapperStyle={{ fontSize: '0.8rem', paddingBottom: '0.75rem' }}
                iconType="circle"
              />
              <Bar dataKey="retirado" name="Retirado" fill="#a855f7" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="andamento" name="Em Andamento" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="anulado" name="Anulado" fill="#ef4444" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="removido" name="Removido" fill="#4b5563" stackId="a" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Tabela de números detalhados */}
          <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Usuário', 'Total', 'Retirado', 'Em Andamento', 'Anulado', 'Removido'].map(h => (
                    <th key={h} style={{
                      padding: '0.5rem 0.75rem',
                      textAlign: h === 'Usuário' ? 'left' : 'center',
                      fontSize: '0.68rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--text-secondary)'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderData.userStats.map((stat, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>{stat.user}</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {stat.total}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
                        background: stat.retirado > 0 ? 'rgba(168,85,247,0.15)' : 'transparent',
                        color: stat.retirado > 0 ? '#a855f7' : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '0.85rem'
                      }}>{stat.retirado}</span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
                        background: stat.andamento > 0 ? 'rgba(59,130,246,0.15)' : 'transparent',
                        color: stat.andamento > 0 ? '#3b82f6' : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '0.85rem'
                      }}>{stat.andamento}</span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
                        background: stat.anulado > 0 ? 'rgba(239,68,68,0.12)' : 'transparent',
                        color: stat.anulado > 0 ? '#ef4444' : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '0.85rem'
                      }}>{stat.anulado}</span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 8px', borderRadius: '10px',
                        background: stat.removido > 0 ? 'rgba(75,85,99,0.2)' : 'transparent',
                        color: stat.removido > 0 ? '#9ca3af' : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '0.85rem'
                      }}>{stat.removido}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {orderData.totalOrders === 0 && (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Package size={40} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>Nenhum pedido ativo encontrado.</p>
          {isAtendimento && (
            <p style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
              Acesse a aba <strong>Pedidos</strong> para realizar sua primeira solicitação.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
