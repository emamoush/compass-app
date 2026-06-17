import { supabase } from '../supabase.js'
import { fmt, fmtDate, fmtNum, today, MONTHS, MONTHS_FULL, CATEGORIAS_BANCARIAS, canEdit, toast, openModal, closeModal, exportExcel, exportPDF } from '../utils.js'

let currentMonth = new Date().getMonth()
let currentYear = new Date().getFullYear()
let currentTab = 'cc-comun'
let currentRole = 'reader'
let cuentas = []

const CUENTA_TIPOS = {
  'cc-comun': 'corriente_pesos',
  'cc-especial': 'corriente_especial',
  'cc-dolares': 'corriente_dolares'
}
const CUENTA_LABELS = {
  'cc-comun': 'CC Común',
  'cc-especial': 'CC Especial',
  'cc-dolares': 'CC Dólares',
  'tarjetas': 'Tarjetas',
  'extractos': 'Extractos'
}

export async function renderTesoreria(role) {
  currentRole = role
  // Load cuentas
  const { data } = await supabase.from('cuentas_bancarias').select('*').eq('activa', true)
  cuentas = data || []

  const cont = document.getElementById('view-tesoreria')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Tesorería</div><div class="section-desc">Conciliación bancaria y movimientos</div></div>
      <div class="btn-row">
        <span class="export-label">Exportar:</span>
        <button class="btn btn-excel btn-sm" onclick="window._tesoExportExcel()"><i class="ti ti-file-spreadsheet"></i> Excel</button>
        <button class="btn btn-pdf btn-sm" onclick="window._tesoExportPDF()"><i class="ti ti-file-type-pdf"></i> PDF</button>
      </div>
    </div>
    <div class="tabs" id="teso-tabs">
      <div class="tab active" data-tab="cc-comun">CC Común</div>
      <div class="tab" data-tab="cc-especial">CC Especial</div>
      <div class="tab" data-tab="cc-dolares">CC Dólares</div>
      <div class="tab" data-tab="tarjetas">Tarjetas</div>
      <div class="tab" data-tab="extractos">Extractos</div>
    </div>
    <div id="teso-content"></div>`

  document.querySelectorAll('#teso-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab
      document.querySelectorAll('#teso-tabs .tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      renderTesoContent()
    })
  })

  window._tesoExportExcel = exportTesoExcel
  window._tesoExportPDF = exportTesoPDF
  renderTesoContent()
}

async function renderTesoContent() {
  const cont = document.getElementById('teso-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`

  if (currentTab === 'extractos') { renderExtractos(cont); return }
  if (currentTab === 'tarjetas') { await renderTarjetas(cont); return }

  const cuentaTipo = CUENTA_TIPOS[currentTab]
  const cuenta = cuentas.find(c => c.tipo === cuentaTipo)
  const divisa = currentTab === 'cc-dolares' ? 'USD' : 'ARS'

  const { data: movs } = await supabase
    .from('movimientos')
    .select('*')
    .eq('mes', currentMonth)
    .eq('anio', currentYear)
    .eq('cuenta_id', cuenta?.id || '00000000-0000-0000-0000-000000000000')
    .order('fecha', { ascending: true })

  const list = movs || []
  const cred = list.filter(m => m.tipo === 'credito').reduce((a, b) => a + (+b.importe || 0), 0)
  const deb = list.filter(m => m.tipo === 'debito').reduce((a, b) => a + (+b.importe || 0), 0)
  const saldo = cred - deb

  cont.innerHTML = `
    ${monthBar()}
    <div class="metrics-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="metric-card green"><div class="metric-label">Créditos</div><div class="metric-value pos">${fmt(cred, divisa)}</div></div>
      <div class="metric-card red"><div class="metric-label">Débitos</div><div class="metric-value neg">${fmt(deb, divisa)}</div></div>
      <div class="metric-card ${saldo >= 0 ? 'teal' : 'red'}"><div class="metric-label">Saldo</div><div class="metric-value ${saldo >= 0 ? 'pos' : 'neg'}">${fmt(saldo, divisa)}</div></div>
    </div>
    ${canEdit(currentRole) ? `<div style="margin-bottom:14px"><button class="btn btn-teal" id="btn-new-mov"><i class="ti ti-plus"></i> Nuevo movimiento</button></div>` : ''}
    <div class="card">
      <div class="card-title">${CUENTA_LABELS[currentTab]} · ${MONTHS_FULL[currentMonth]} ${currentYear}</div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th><th>Categoría</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody id="mov-tbody">${renderMovsTable(list, divisa)}</tbody></table></div>
    </div>
    <div class="card">
      <div class="card-title"><i class="ti ti-report" style="color:var(--amber)"></i> Gastos Bancarios — ${MONTHS_FULL[currentMonth]}</div>
      ${renderGastosBancarios(list, divisa)}
    </div>`

  attachMonthHandlers(renderTesoContent)
  document.getElementById('btn-new-mov')?.addEventListener('click', () => openMovModal(cuenta))
  attachDeleteHandlers('movimientos', renderTesoContent)
}

function renderMovsTable(list, divisa) {
  if (!list.length) return `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Sin movimientos este período</td></tr>`
  return list.map(m => `<tr>
    <td>${fmtDate(m.fecha)}</td>
    <td>${m.concepto || '—'}</td>
    <td><span class="tag ${m.tipo === 'credito' ? 'tag-green' : 'tag-red'}">${m.tipo === 'credito' ? 'Crédito' : 'Débito'}</span></td>
    <td style="font-weight:600;color:${m.tipo === 'credito' ? 'var(--green)' : 'var(--red)'}">
      ${m.tipo === 'credito' ? '+' : '−'}${fmt(m.importe, divisa)}
    </td>
    <td><span class="tag tag-gray">${m.categoria || 'General'}</span></td>
    ${canEdit(currentRole) ? `<td><button class="btn btn-danger btn-sm delete-row" data-id="${m.id}" data-table="movimientos"><i class="ti ti-trash"></i></button></td>` : ''}
  </tr>`).join('')
}

function renderGastosBancarios(list, divisa) {
  const gastos = CATEGORIAS_BANCARIAS.filter(c => c !== 'General')
  return `<div class="table-wrap"><table><thead><tr><th>Concepto</th><th>Importe</th></tr></thead><tbody>
    ${gastos.map(cat => {
      const total = list.filter(m => m.categoria === cat).reduce((a, b) => a + (+b.importe || 0), 0)
      return `<tr><td>${cat}</td><td style="font-weight:600;color:${total > 0 ? 'var(--red)' : 'var(--text3)'}">${total > 0 ? fmt(total, divisa) : '—'}</td></tr>`
    }).join('')}
  </tbody></table></div>`
}

async function renderTarjetas(cont) {
  const { data: movs } = await supabase
    .from('tarjetas_movimientos')
    .select('*')
    .eq('mes', currentMonth)
    .eq('anio', currentYear)
    .order('fecha', { ascending: true })

  const list = movs || []
  const total = list.reduce((a, b) => a + (+b.importe || 0), 0)

  cont.innerHTML = `
    ${monthBar()}
    <div class="metric-card amber" style="max-width:280px;margin-bottom:16px">
      <div class="metric-label">Total Tarjetas ${MONTHS_FULL[currentMonth]}</div>
      <div class="metric-value" style="color:var(--amber)">${fmt(total)}</div>
    </div>
    ${canEdit(currentRole) ? `<div style="margin-bottom:14px"><button class="btn btn-teal" id="btn-new-tarjeta"><i class="ti ti-plus"></i> Nueva conciliación</button></div>` : ''}
    <div class="card">
      <div class="card-title">Conciliación Tarjetas · ${MONTHS_FULL[currentMonth]} ${currentYear}</div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tarjeta</th><th>Concepto</th><th>Importe</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(m => `<tr>
        <td>${fmtDate(m.fecha)}</td><td>${m.tarjeta || '—'}</td><td>${m.concepto || '—'}</td>
        <td style="font-weight:600;color:var(--amber)">${fmt(m.importe)}</td>
        ${canEdit(currentRole) ? `<td><button class="btn btn-danger btn-sm delete-row" data-id="${m.id}" data-table="tarjetas_movimientos"><i class="ti ti-trash"></i></button></td>` : ''}
      </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">Sin movimientos</td></tr>`}
      </tbody></table></div>
    </div>`

  attachMonthHandlers(renderTesoContent)
  document.getElementById('btn-new-tarjeta')?.addEventListener('click', () => openTarjetaModal())
  attachDeleteHandlers('tarjetas_movimientos', renderTesoContent)
}

function renderExtractos(cont) {
  cont.innerHTML = `
    <div class="card">
      <div class="card-title"><i class="ti ti-file-upload" style="color:var(--teal)"></i> Extractos Bancarios</div>
      <div class="card-sub">Adjuntá los estados de cuenta para revisión del estudio contable</div>
      ${canEdit(currentRole) ? `
        <div class="form-grid">
          <div class="form-field"><label>Cuenta</label><select id="ext-cuenta"><option>CC Común</option><option>CC Especial</option><option>CC Dólares</option></select></div>
          <div class="form-field"><label>Período</label><input type="month" id="ext-mes"></div>
          <div class="form-field"><label>Archivo PDF</label><input type="file" accept=".pdf" id="ext-file"></div>
        </div>
        <div class="form-actions"><button class="btn btn-teal" onclick="window._uploadExtracto()"><i class="ti ti-upload"></i> Cargar extracto</button></div>
        <div class="divider"></div>` : ''}
      <div class="empty"><div class="empty-icon">📄</div><div class="empty-text">Los extractos cargados aparecerán aquí</div></div>
    </div>`
  window._uploadExtracto = () => toast('Extracto cargado ✓')
}

// ── MODAL MOVIMIENTO ──
function openMovModal(cuenta) {
  document.getElementById('modal-title').textContent = `Nuevo Movimiento — ${CUENTA_LABELS[currentTab]}`
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Fecha</label><input type="date" id="mov-fecha" value="${today()}"></div>
      <div class="form-field"><label>Concepto</label><input type="text" id="mov-concepto" placeholder="Descripción del movimiento"></div>
      <div class="form-field"><label>Tipo</label>
        <select id="mov-tipo"><option value="credito">Crédito (Ingreso)</option><option value="debito">Débito (Egreso)</option></select>
      </div>
      <div class="form-field"><label>Importe</label><input type="number" id="mov-importe" placeholder="0.00" step="0.01" min="0"></div>
      <div class="form-field"><label>Categoría</label>
        <select id="mov-cat">${CATEGORIAS_BANCARIAS.map(c => `<option>${c}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-mov-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-mov-btn').addEventListener('click', async () => {
    const fecha = document.getElementById('mov-fecha').value
    const concepto = document.getElementById('mov-concepto').value
    const tipo = document.getElementById('mov-tipo').value
    const importe = parseFloat(document.getElementById('mov-importe').value) || 0
    const categoria = document.getElementById('mov-cat').value
    if (!fecha || !importe) { toast('Completá fecha e importe', true); return }
    const { error } = await supabase.from('movimientos').insert({
      cuenta_id: cuenta?.id, fecha, concepto, tipo, importe, categoria,
      divisa: currentTab === 'cc-dolares' ? 'USD' : 'ARS',
      mes: currentMonth, anio: currentYear
    })
    if (error) { toast('Error al guardar', true); return }
    closeModal()
    toast('Movimiento guardado ✓')
    renderTesoContent()
  })
}

function openTarjetaModal() {
  document.getElementById('modal-title').textContent = 'Nueva Conciliación de Tarjeta'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Fecha</label><input type="date" id="tar-fecha" value="${today()}"></div>
      <div class="form-field"><label>Tarjeta</label><input type="text" id="tar-tarjeta" placeholder="Ej: Visa Macro 1234"></div>
      <div class="form-field"><label>Concepto</label><input type="text" id="tar-concepto" placeholder="Descripción"></div>
      <div class="form-field"><label>Importe</label><input type="number" id="tar-importe" placeholder="0.00" step="0.01" min="0"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-tar-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-tar-btn').addEventListener('click', async () => {
    const fecha = document.getElementById('tar-fecha').value
    const tarjeta = document.getElementById('tar-tarjeta').value
    const concepto = document.getElementById('tar-concepto').value
    const importe = parseFloat(document.getElementById('tar-importe').value) || 0
    if (!fecha || !importe) { toast('Completá fecha e importe', true); return }
    const { error } = await supabase.from('tarjetas_movimientos').insert({ fecha, tarjeta, concepto, importe, mes: currentMonth, anio: currentYear })
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast('Conciliación guardada ✓'); renderTesoContent()
  })
}

// ── EXPORTS ──
async function exportTesoExcel() {
  const cuentaTipo = CUENTA_TIPOS[currentTab]
  const cuenta = cuentas.find(c => c.tipo === cuentaTipo)
  const table = currentTab === 'tarjetas' ? 'tarjetas_movimientos' : 'movimientos'
  const { data } = await supabase.from(table).select('*').eq('mes', currentMonth).eq('anio', currentYear)
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const headers = currentTab === 'tarjetas'
    ? ['Fecha', 'Tarjeta', 'Concepto', 'Importe']
    : ['Fecha', 'Concepto', 'Tipo', 'Importe', 'Categoría']
  const rows = currentTab === 'tarjetas'
    ? data.map(m => [fmtDate(m.fecha), m.tarjeta || '', m.concepto || '', fmtNum(m.importe)])
    : data.map(m => [fmtDate(m.fecha), m.concepto || '', m.tipo === 'credito' ? 'Crédito' : 'Débito', fmtNum(m.importe), m.categoria || ''])
  exportExcel(CUENTA_LABELS[currentTab], headers, rows, `Compass_Tesoreria_${CUENTA_LABELS[currentTab]}_${MONTHS_FULL[currentMonth]}${currentYear}`)
}

async function exportTesoPDF() {
  const cuentaTipo = CUENTA_TIPOS[currentTab]
  const cuenta = cuentas.find(c => c.tipo === cuentaTipo)
  const { data } = await supabase.from('movimientos').select('*').eq('mes', currentMonth).eq('anio', currentYear)
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const divisa = currentTab === 'cc-dolares' ? 'USD' : 'ARS'
  const cred = data.filter(m => m.tipo === 'credito').reduce((a, b) => a + (+b.importe || 0), 0)
  const deb = data.filter(m => m.tipo === 'debito').reduce((a, b) => a + (+b.importe || 0), 0)
  const rows = data.map(m => [fmtDate(m.fecha), m.concepto || '', m.tipo === 'credito' ? 'Crédito' : 'Débito', fmtNum(m.importe), m.categoria || ''])
  rows.push([`Créditos: ${fmt(cred, divisa)}  |  Débitos: ${fmt(deb, divisa)}  |  Saldo: ${fmt(cred - deb, divisa)}`, '', '', '', ''])
  exportPDF('Tesorería', `${CUENTA_LABELS[currentTab]} · ${MONTHS_FULL[currentMonth]} ${currentYear}`, ['Fecha', 'Concepto', 'Tipo', 'Importe', 'Categoría'], rows, `Compass_Tesoreria_${MONTHS_FULL[currentMonth]}${currentYear}`)
}

// ── HELPERS ──
function monthBar() {
  return `<div class="month-bar">
    <button class="arrow-btn" id="prev-month">‹</button>
    ${MONTHS.map((m, i) => `<button class="month-btn ${i === currentMonth ? 'active' : ''}" data-m="${i}">${m}</button>`).join('')}
    <button class="arrow-btn" id="next-month">›</button>
    <span class="year-label">${currentYear}</span>
  </div>`
}

function attachMonthHandlers(cb) {
  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear-- }; cb()
  })
  document.getElementById('next-month')?.addEventListener('click', () => {
    currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++ }; cb()
  })
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', () => { currentMonth = parseInt(btn.dataset.m); cb() })
  })
}

function attachDeleteHandlers(table, cb) {
  document.querySelectorAll(`.delete-row[data-table="${table}"]`).forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este registro?')) return
      const { error } = await supabase.from(table).delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); cb()
    })
  })
}
