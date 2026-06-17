import { supabase } from '../supabase.js'
import { fmt, fmtNum, MONTHS_FULL, exportExcel, exportPDF, toast } from '../utils.js'

let currentYear = new Date().getFullYear()

export async function renderBalance(role) {
  const cont = document.getElementById('view-balance')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Balance</div><div class="section-desc">Resumen financiero mensual y anual</div></div>
      <div class="btn-row">
        <button class="arrow-btn" id="prev-year">‹ ${currentYear - 1}</button>
        <span style="font-size:15px;font-weight:700;color:var(--text);padding:0 8px">${currentYear}</span>
        <button class="arrow-btn" id="next-year">${currentYear + 1} ›</button>
        <button class="btn btn-excel btn-sm" id="bal-exp-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
        <button class="btn btn-pdf btn-sm" id="bal-exp-pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>
      </div>
    </div>
    <div id="balance-content"><div class="loading"><div class="spinner"></div> Cargando...</div></div>`

  document.getElementById('prev-year').addEventListener('click', () => { currentYear--; renderBalance(role) })
  document.getElementById('next-year').addEventListener('click', () => { currentYear++; renderBalance(role) })
  document.getElementById('bal-exp-excel').addEventListener('click', () => exportBalanceExcel())
  document.getElementById('bal-exp-pdf').addEventListener('click', () => exportBalancePDF())

  await loadBalance()
}

async function loadBalance() {
  const cont = document.getElementById('balance-content')

  const [movRes, provRes, egrRes] = await Promise.all([
    supabase.from('movimientos').select('tipo, importe, mes, anio').eq('anio', currentYear),
    supabase.from('proveedores_movimientos').select('importe, abonado, mes, anio').eq('anio', currentYear).eq('abonado', true),
    supabase.from('egrs').select('importe, abonado, mes, anio').eq('anio', currentYear).eq('abonado', true)
  ])

  const movs = movRes.data || []
  const provs = provRes.data || []
  const egrs = egrRes.data || []

  const months = MONTHS_FULL.map((name, i) => {
    const cred = movs.filter(m => m.mes === i && m.tipo === 'credito').reduce((a, b) => a + (+b.importe || 0), 0)
    const deb = movs.filter(m => m.mes === i && m.tipo === 'debito').reduce((a, b) => a + (+b.importe || 0), 0)
    const provEgr = provs.filter(m => m.mes === i).reduce((a, b) => a + (+b.importe || 0), 0)
    const otroEgr = egrs.filter(m => m.mes === i).reduce((a, b) => a + (+b.importe || 0), 0)
    const totalEgr = deb + provEgr + otroEgr
    return { name, cred, egr: totalEgr, saldo: cred - totalEgr }
  })

  const totalCred = months.reduce((a, b) => a + b.cred, 0)
  const totalEgr = months.reduce((a, b) => a + b.egr, 0)
  const saldoAnual = totalCred - totalEgr

  cont.innerHTML = `
    <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="metric-card green"><div class="metric-label">Total Ingresos ${currentYear}</div><div class="metric-value pos">${fmt(totalCred)}</div></div>
      <div class="metric-card red"><div class="metric-label">Total Egresos ${currentYear}</div><div class="metric-value neg">${fmt(totalEgr)}</div></div>
      <div class="metric-card ${saldoAnual >= 0 ? 'teal' : 'red'}"><div class="metric-label">Resultado Anual</div><div class="metric-value ${saldoAnual >= 0 ? 'pos' : 'neg'}">${fmt(saldoAnual)}</div></div>
    </div>
    <div class="card">
      <div class="card-title">Balance mensual — ${currentYear}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Resultado</th></tr></thead>
        <tbody>
          ${months.map(r => `<tr>
            <td style="font-weight:500">${r.name}</td>
            <td style="color:var(--green)">${r.cred > 0 ? fmt(r.cred) : '—'}</td>
            <td style="color:var(--red)">${r.egr > 0 ? fmt(r.egr) : '—'}</td>
            <td style="font-weight:700;color:${r.saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${r.cred > 0 || r.egr > 0 ? fmt(r.saldo) : '—'}</td>
          </tr>`).join('')}
          <tr style="background:var(--bg2);border-top:2px solid var(--border)">
            <td style="font-weight:700">TOTAL ${currentYear}</td>
            <td style="font-weight:700;color:var(--green)">${fmt(totalCred)}</td>
            <td style="font-weight:700;color:var(--red)">${fmt(totalEgr)}</td>
            <td style="font-weight:700;color:${saldoAnual >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(saldoAnual)}</td>
          </tr>
        </tbody>
      </table></div>
    </div>`
}

async function getBalanceData() {
  const [movRes, provRes, egrRes] = await Promise.all([
    supabase.from('movimientos').select('tipo, importe, mes').eq('anio', currentYear),
    supabase.from('proveedores_movimientos').select('importe, mes').eq('anio', currentYear).eq('abonado', true),
    supabase.from('egrs').select('importe, mes').eq('anio', currentYear).eq('abonado', true)
  ])
  return { movs: movRes.data || [], provs: provRes.data || [], egrs: egrRes.data || [] }
}

async function exportBalanceExcel() {
  const { movs, provs, egrs } = await getBalanceData()
  const rows = MONTHS_FULL.map((name, i) => {
    const cred = movs.filter(m => m.mes === i && m.tipo === 'credito').reduce((a, b) => a + (+b.importe || 0), 0)
    const deb = movs.filter(m => m.mes === i && m.tipo === 'debito').reduce((a, b) => a + (+b.importe || 0), 0)
    const extra = [...provs, ...egrs].filter(m => m.mes === i).reduce((a, b) => a + (+b.importe || 0), 0)
    const egr = deb + extra
    return [name, fmtNum(cred), fmtNum(egr), fmtNum(cred - egr)]
  })
  exportExcel('Balance', ['Mes', 'Ingresos', 'Egresos', 'Resultado'], rows, `Compass_Balance_${currentYear}`)
}

async function exportBalancePDF() {
  const { movs, provs, egrs } = await getBalanceData()
  const rows = MONTHS_FULL.map((name, i) => {
    const cred = movs.filter(m => m.mes === i && m.tipo === 'credito').reduce((a, b) => a + (+b.importe || 0), 0)
    const deb = movs.filter(m => m.mes === i && m.tipo === 'debito').reduce((a, b) => a + (+b.importe || 0), 0)
    const extra = [...provs, ...egrs].filter(m => m.mes === i).reduce((a, b) => a + (+b.importe || 0), 0)
    const egr = deb + extra
    return [name, fmtNum(cred), fmtNum(egr), fmtNum(cred - egr)]
  })
  exportPDF('Balance', `Ejercicio anual ${currentYear}`, ['Mes', 'Ingresos', 'Egresos', 'Resultado'], rows, `Compass_Balance_${currentYear}`)
}
