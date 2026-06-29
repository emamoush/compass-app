import { supabase } from '../supabase.js'
import { fmt, fmtNum, MONTHS_FULL, exportExcel, exportPDF, toast } from '../utils.js'

let currentYear = new Date().getFullYear()
let tipoCambio = null

export async function renderBalance(role) {
  const cont = document.getElementById('view-balance')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Balance</div><div class="section-desc">Resumen financiero por moneda — mensual y anual</div></div>
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

async function getBalanceData() {
  const [movRes, provRes, egrRes] = await Promise.all([
    supabase.from('movimientos').select('tipo, importe, divisa, mes, anio').eq('anio', currentYear),
    supabase.from('proveedores_movimientos').select('importe, divisa, abonado, mes, anio').eq('anio', currentYear).eq('abonado', true),
    supabase.from('egrs').select('importe, divisa, abonado, mes, anio').eq('anio', currentYear).eq('abonado', true)
  ])
  return { movs: movRes.data || [], provs: provRes.data || [], egrs: egrRes.data || [] }
}

function calcByMonth(movs, provs, egrs, divisa) {
  return MONTHS_FULL.map((name, i) => {
    const credM = movs.filter(m => m.mes === i && m.tipo === 'credito' && (m.divisa || 'ARS') === divisa).reduce((a, b) => a + (+b.importe || 0), 0)
    const debM = movs.filter(m => m.mes === i && m.tipo === 'debito' && (m.divisa || 'ARS') === divisa).reduce((a, b) => a + (+b.importe || 0), 0)
    const provEgr = provs.filter(m => m.mes === i && (m.divisa || 'ARS') === divisa).reduce((a, b) => a + (+b.importe || 0), 0)
    const otroEgr = egrs.filter(m => m.mes === i && (m.divisa || 'ARS') === divisa).reduce((a, b) => a + (+b.importe || 0), 0)
    const totalEgr = debM + provEgr + otroEgr
    return { name, cred: credM, egr: totalEgr, saldo: credM - totalEgr }
  })
}

async function loadBalance() {
  const cont = document.getElementById('balance-content')
  const { movs, provs, egrs } = await getBalanceData()

  const monthsARS = calcByMonth(movs, provs, egrs, 'ARS')
  const monthsUSD = calcByMonth(movs, provs, egrs, 'USD')

  const totalCredARS = monthsARS.reduce((a, b) => a + b.cred, 0)
  const totalEgrARS = monthsARS.reduce((a, b) => a + b.egr, 0)
  const saldoARS = totalCredARS - totalEgrARS

  const totalCredUSD = monthsUSD.reduce((a, b) => a + b.cred, 0)
  const totalEgrUSD = monthsUSD.reduce((a, b) => a + b.egr, 0)
  const saldoUSD = totalCredUSD - totalEgrUSD

  const hayUSD = totalCredUSD !== 0 || totalEgrUSD !== 0

  cont.innerHTML = `
    <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="metric-card green"><div class="metric-label">Ingresos ${currentYear} (ARS)</div><div class="metric-value pos">${fmt(totalCredARS, 'ARS')}</div></div>
      <div class="metric-card red"><div class="metric-label">Egresos ${currentYear} (ARS)</div><div class="metric-value neg">${fmt(totalEgrARS, 'ARS')}</div></div>
      <div class="metric-card ${saldoARS >= 0 ? 'teal' : 'red'}"><div class="metric-label">Resultado ARS</div><div class="metric-value ${saldoARS >= 0 ? 'pos' : 'neg'}">${fmt(saldoARS, 'ARS')}</div></div>
    </div>
    ${hayUSD ? `
    <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
      <div class="metric-card green"><div class="metric-label">Ingresos ${currentYear} (USD)</div><div class="metric-value pos">${fmt(totalCredUSD, 'USD')}</div></div>
      <div class="metric-card red"><div class="metric-label">Egresos ${currentYear} (USD)</div><div class="metric-value neg">${fmt(totalEgrUSD, 'USD')}</div></div>
      <div class="metric-card ${saldoUSD >= 0 ? 'teal' : 'red'}"><div class="metric-label">Resultado USD</div><div class="metric-value ${saldoUSD >= 0 ? 'pos' : 'neg'}">${fmt(saldoUSD, 'USD')}</div></div>
    </div>` : ''}

    <div class="card">
      <div class="card-title">Balance mensual en Pesos (ARS) — ${currentYear}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Resultado</th></tr></thead>
        <tbody>
          ${monthsARS.map(r => `<tr>
            <td style="font-weight:500">${r.name}</td>
            <td style="color:var(--green)">${r.cred > 0 ? fmt(r.cred, 'ARS') : '—'}</td>
            <td style="color:var(--red)">${r.egr > 0 ? fmt(r.egr, 'ARS') : '—'}</td>
            <td style="font-weight:700;color:${r.saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${r.cred > 0 || r.egr > 0 ? fmt(r.saldo, 'ARS') : '—'}</td>
          </tr>`).join('')}
          <tr style="background:var(--bg2);border-top:2px solid var(--border)">
            <td style="font-weight:700">TOTAL ${currentYear}</td>
            <td style="font-weight:700;color:var(--green)">${fmt(totalCredARS, 'ARS')}</td>
            <td style="font-weight:700;color:var(--red)">${fmt(totalEgrARS, 'ARS')}</td>
            <td style="font-weight:700;color:${saldoARS >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(saldoARS, 'ARS')}</td>
          </tr>
        </tbody>
      </table></div>
    </div>

    ${hayUSD ? `
    <div class="card">
      <div class="card-title">Balance mensual en Dólares (USD) — ${currentYear}</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Resultado</th></tr></thead>
        <tbody>
          ${monthsUSD.map(r => `<tr>
            <td style="font-weight:500">${r.name}</td>
            <td style="color:var(--green)">${r.cred > 0 ? fmt(r.cred, 'USD') : '—'}</td>
            <td style="color:var(--red)">${r.egr > 0 ? fmt(r.egr, 'USD') : '—'}</td>
            <td style="font-weight:700;color:${r.saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${r.cred > 0 || r.egr > 0 ? fmt(r.saldo, 'USD') : '—'}</td>
          </tr>`).join('')}
          <tr style="background:var(--bg2);border-top:2px solid var(--border)">
            <td style="font-weight:700">TOTAL ${currentYear}</td>
            <td style="font-weight:700;color:var(--green)">${fmt(totalCredUSD, 'USD')}</td>
            <td style="font-weight:700;color:var(--red)">${fmt(totalEgrUSD, 'USD')}</td>
            <td style="font-weight:700;color:${saldoUSD >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(saldoUSD, 'USD')}</td>
          </tr>
        </tbody>
      </table></div>
    </div>

    <div class="card" style="border:1px dashed var(--border)">
      <div class="card-title"><i class="ti ti-calculator" style="color:var(--amber)"></i> Conciliación opcional — Total General en Pesos</div>
      <div class="card-sub">Este total es solo una conversión de referencia. No se guarda ni reemplaza los balances reales en cada moneda.</div>
      <div class="form-grid" style="margin-top:10px">
        <div class="form-field"><label>Tipo de Cambio (USD → ARS)</label><input type="number" id="bal-tc" placeholder="Ej: 1350.00" step="0.01" min="0" value="${tipoCambio || ''}"></div>
      </div>
      <button class="btn btn-teal btn-sm" id="bal-calc-tc" style="margin-top:8px"><i class="ti ti-refresh"></i> Calcular</button>
      <div id="bal-tc-result" style="margin-top:14px"></div>
    </div>` : ''}`

  document.getElementById('bal-calc-tc')?.addEventListener('click', () => {
    const tc = parseFloat(document.getElementById('bal-tc').value)
    if (!tc || tc <= 0) { toast('Ingresá un tipo de cambio válido', true); return }
    tipoCambio = tc
    const saldoUSDenARS = saldoUSD * tc
    const totalGeneral = saldoARS + saldoUSDenARS
    document.getElementById('bal-tc-result').innerHTML = `
      <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="metric-card teal"><div class="metric-label">Resultado ARS</div><div class="metric-value">${fmt(saldoARS, 'ARS')}</div></div>
        <div class="metric-card teal"><div class="metric-label">Resultado USD × TC (${fmtNum(tc)})</div><div class="metric-value">${fmt(saldoUSDenARS, 'ARS')}</div></div>
        <div class="metric-card ${totalGeneral >= 0 ? 'green' : 'red'}"><div class="metric-label">Total General (ARS)</div><div class="metric-value ${totalGeneral >= 0 ? 'pos' : 'neg'}">${fmt(totalGeneral, 'ARS')}</div></div>
      </div>`
  })
}

async function exportBalanceExcel() {
  const { movs, provs, egrs } = await getBalanceData()
  const monthsARS = calcByMonth(movs, provs, egrs, 'ARS')
  const monthsUSD = calcByMonth(movs, provs, egrs, 'USD')
  const rows = MONTHS_FULL.map((name, i) => [
    name,
    fmtNum(monthsARS[i].cred), fmtNum(monthsARS[i].egr), fmtNum(monthsARS[i].saldo),
    fmtNum(monthsUSD[i].cred), fmtNum(monthsUSD[i].egr), fmtNum(monthsUSD[i].saldo)
  ])
  exportExcel('Balance', ['Mes', 'Ingresos ARS', 'Egresos ARS', 'Resultado ARS', 'Ingresos USD', 'Egresos USD', 'Resultado USD'], rows, `Compass_Balance_${currentYear}`)
}

async function exportBalancePDF() {
  const { movs, provs, egrs } = await getBalanceData()
  const monthsARS = calcByMonth(movs, provs, egrs, 'ARS')
  const monthsUSD = calcByMonth(movs, provs, egrs, 'USD')
  const rows = MONTHS_FULL.map((name, i) => [
    name,
    fmtNum(monthsARS[i].cred), fmtNum(monthsARS[i].egr), fmtNum(monthsARS[i].saldo),
    fmtNum(monthsUSD[i].cred), fmtNum(monthsUSD[i].egr), fmtNum(monthsUSD[i].saldo)
  ])
  exportPDF('Balance', `Ejercicio anual ${currentYear} — ARS y USD separados`, ['Mes', 'Ing. ARS', 'Egr. ARS', 'Result. ARS', 'Ing. USD', 'Egr. USD', 'Result. USD'], rows, `Compass_Balance_${currentYear}`)
}
