import { supabase } from '../supabase.js'
import { fmt, fmtDate, canEdit } from '../utils.js'
import { navigate } from '../app.js'

export async function renderDashboard(role) {
  const cont = document.getElementById('view-dashboard')
  cont.innerHTML = `
    <div class="welcome-banner">
      <div class="welcome-title" id="dash-greeting">Cargando...</div>
      <div class="welcome-sub">${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Compass</div>
    </div>
    <div class="metrics-grid" id="dash-metrics"><div class="loading"><div class="spinner"></div> Cargando métricas...</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:4px">
      <div class="card"><div class="card-title"><i class="ti ti-alert-circle" style="color:var(--red)"></i> Facturas pendientes</div><div id="dash-pending"><div class="loading"><div class="spinner"></div></div></div></div>
      <div class="card"><div class="card-title"><i class="ti ti-users" style="color:var(--teal)"></i> Últimos clientes</div><div id="dash-clients"><div class="loading"><div class="spinner"></div></div></div></div>
    </div>`

  // Load data in parallel
  const [movRes, provRes, cliRes, { data: { user } }] = await Promise.all([
    supabase.from('movimientos').select('tipo, importe'),
    supabase.from('proveedores_movimientos').select('importe, abonado, proveedor_nombre, fecha_vencimiento').order('created_at', { ascending: false }),
    supabase.from('clientes_movimientos').select('cliente_nombre, nro_factura, importe, divisa').order('created_at', { ascending: false }).limit(5),
    supabase.auth.getUser()
  ])

  const movs = movRes.data || []
  const provs = provRes.data || []
  const clis = cliRes.data || []

  const totalIng = movs.filter(m => m.tipo === 'credito').reduce((a, b) => a + (+b.importe || 0), 0)
  const totalEgr = movs.filter(m => m.tipo === 'debito').reduce((a, b) => a + (+b.importe || 0), 0)
  const pendProv = provs.filter(p => !p.abonado).reduce((a, b) => a + (+b.importe || 0), 0)
  const saldo = totalIng - totalEgr

  document.getElementById('dash-greeting').textContent = `Bienvenido/a, ${user?.email?.split('@')[0] || ''}`
  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric-card green"><div class="metric-label">Total Ingresos</div><div class="metric-value pos">${fmt(totalIng)}</div><div class="metric-sub">Créditos acumulados</div></div>
    <div class="metric-card red"><div class="metric-label">Total Egresos</div><div class="metric-value neg">${fmt(totalEgr)}</div><div class="metric-sub">Débitos acumulados</div></div>
    <div class="metric-card ${saldo >= 0 ? 'teal' : 'red'}"><div class="metric-label">Saldo Neto</div><div class="metric-value ${saldo >= 0 ? 'pos' : 'neg'}">${fmt(saldo)}</div><div class="metric-sub">Ingresos − Egresos</div></div>
    <div class="metric-card amber"><div class="metric-label">Prov. Pendientes</div><div class="metric-value" style="color:var(--amber)">${fmt(pendProv)}</div><div class="metric-sub">${provs.filter(p => !p.abonado).length} facturas</div></div>`

  const pending = provs.filter(p => !p.abonado).slice(0, 5)
  document.getElementById('dash-pending').innerHTML = pending.length
    ? `<div class="table-wrap"><table><thead><tr><th>Proveedor</th><th>Importe</th><th>Vto.</th></tr></thead><tbody>${pending.map(r => `<tr><td>${r.proveedor_nombre}</td><td>${fmt(r.importe)}</td><td style="color:var(--red)">${fmtDate(r.fecha_vencimiento)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">Sin facturas pendientes</div></div>`

  document.getElementById('dash-clients').innerHTML = clis.length
    ? `<div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Factura</th><th>Importe</th></tr></thead><tbody>${clis.map(r => `<tr><td>${r.cliente_nombre}</td><td>${r.nro_factura || '—'}</td><td>${fmt(r.importe, r.divisa)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="empty"><div class="empty-icon">👥</div><div class="empty-text">Sin clientes registrados</div></div>`
}
