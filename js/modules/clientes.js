import { supabase } from '../supabase.js'
import { fmt, fmtDate, fmtNum, today, MEDIOS_PAGO, canEdit, toast, openModal, closeModal, exportExcel, exportPDF } from '../utils.js'

let currentTab = 'movimientos'
let currentRole = 'reader'

export async function renderClientes(role) {
  currentRole = role
  const cont = document.getElementById('view-clientes')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Clientes</div><div class="section-desc">Estado de cuenta y base de clientes</div></div>
      <div class="btn-row">
        ${canEdit(role) ? `<button class="btn btn-teal" id="btn-new-cli"><i class="ti ti-plus"></i> Nuevo movimiento</button>` : ''}
        <button class="btn btn-excel btn-sm" id="btn-exp-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
        <button class="btn btn-pdf btn-sm" id="btn-exp-pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>
      </div>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="movimientos">Movimientos</div>
      <div class="tab" data-tab="base">Base de Clientes</div>
    </div>
    <div id="clientes-content"></div>`

  document.querySelectorAll('#view-clientes .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab
      document.querySelectorAll('#view-clientes .tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      renderContent()
    })
  })
  document.getElementById('btn-new-cli')?.addEventListener('click', () => openMovModal())
  document.getElementById('btn-exp-excel').addEventListener('click', exportCliExcel)
  document.getElementById('btn-exp-pdf').addEventListener('click', exportCliPDF)
  renderContent()
}

async function renderContent() {
  if (currentTab === 'base') { await renderBase(); return }
  await renderMovimientos()
}

async function renderMovimientos() {
  const cont = document.getElementById('clientes-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('clientes_movimientos').select('*').order('fecha_factura', { ascending: false })
  const list = data || []
  const total = list.reduce((a, b) => a + (+b.importe || 0), 0)
  const abonado = list.reduce((a, b) => a + (+b.importe_abonado || 0), 0)
  const pend = total - abonado

  cont.innerHTML = `
    <div class="totals-bar">
      <div class="totals-item"><div class="totals-label">Total Facturado</div><div class="totals-val">${fmt(total)}</div></div>
      <div class="totals-item"><div class="totals-label">Monto Abonado</div><div class="totals-val" style="color:var(--green)">${fmt(abonado)}</div></div>
      <div class="totals-item"><div class="totals-label">Monto Pendiente</div><div class="totals-val" style="color:${pend > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(pend)}</div></div>
    </div>
    <div class="filter-row"><input type="text" id="cli-search" placeholder="Buscar cliente o factura..." style="width:240px"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Importe</th><th>Abonado</th><th>Prepago</th><th>Medio Pago</th><th>Saldo</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody id="cli-tbody">${renderTable(list)}</tbody>
    </table></div></div>`

  document.getElementById('cli-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase()
    const filtered = list.filter(m => m.cliente_nombre?.toLowerCase().includes(q) || m.nro_factura?.toLowerCase().includes(q))
    document.getElementById('cli-tbody').innerHTML = renderTable(filtered)
    attachDeleteCli()
  })
  attachDeleteCli()
}

function renderTable(list) {
  if (!list.length) return `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">Sin movimientos registrados</td></tr>`
  return list.map(m => {
    const saldo = (+m.importe || 0) - (+m.importe_abonado || 0)
    return `<tr>
      <td>${fmtDate(m.fecha_factura)}</td>
      <td style="font-weight:500">${m.nro_factura || '—'}</td>
      <td>${m.cliente_nombre || '—'}</td>
      <td style="font-weight:600">${fmt(m.importe, m.divisa)}</td>
      <td style="color:var(--green)">${fmt(m.importe_abonado, m.divisa)}</td>
      <td>${m.prepago ? fmt(m.prepago, m.divisa) : '—'}</td>
      <td><span class="tag tag-blue">${m.medio_pago || '—'}</span></td>
      <td style="font-weight:700;color:${saldo <= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(saldo, m.divisa)}</td>
      ${canEdit(currentRole) ? `<td><button class="btn btn-danger btn-sm delete-cli" data-id="${m.id}"><i class="ti ti-trash"></i></button></td>` : ''}
    </tr>`
  }).join('')
}

function attachDeleteCli() {
  document.querySelectorAll('.delete-cli').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este movimiento?')) return
      const { error } = await supabase.from('clientes_movimientos').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); renderMovimientos()
    })
  })
}

async function renderBase() {
  const cont = document.getElementById('clientes-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('clientes_db').select('*').eq('activo', true).order('razon_social')
  const list = data || []
  cont.innerHTML = `
    ${canEdit(currentRole) ? `<div style="margin-bottom:16px"><button class="btn btn-teal" id="btn-new-cliente-db"><i class="ti ti-user-plus"></i> Agregar cliente</button></div>` : ''}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Razón Social</th><th>CUIT</th><th>Email</th><th>Teléfono</th><th>Observaciones</th></tr></thead>
      <tbody>${list.length ? list.map(c => `<tr><td style="font-weight:500">${c.razon_social}</td><td>${c.cuit || '—'}</td><td>${c.email || '—'}</td><td>${c.telefono || '—'}</td><td>${c.observaciones || '—'}</td></tr>`).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">Sin clientes en la base</td></tr>`}
      </tbody>
    </table></div></div>`
  document.getElementById('btn-new-cliente-db')?.addEventListener('click', () => openClienteDBModal())
}

function openMovModal() {
  document.getElementById('modal-title').textContent = 'Nuevo Movimiento de Cliente'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Fecha Factura</label><input type="date" id="cli-fecha" value="${today()}"></div>
      <div class="form-field"><label>Nro. Factura</label><input type="text" id="cli-nrofac" placeholder="0001-00012345"></div>
      <div class="form-field"><label>Cliente</label><input type="text" id="cli-nombre" placeholder="Razón social o nombre"></div>
      <div class="form-field"><label>Divisa</label><select id="cli-divisa"><option value="ARS">$ Pesos</option><option value="USD">U$S Dólares</option></select></div>
      <div class="form-field"><label>Importe Total</label><input type="number" id="cli-importe" placeholder="0.00" step="0.01" min="0"></div>
      <div class="form-field"><label>Importe Abonado</label><input type="number" id="cli-abonado" placeholder="0.00" step="0.01" min="0"></div>
      <div class="form-field"><label>Prepago / Anticipo</label><input type="number" id="cli-prepago" placeholder="0.00" step="0.01" min="0"></div>
      <div class="form-field"><label>Medio de Pago</label><select id="cli-medio">${MEDIOS_PAGO.map(m => `<option>${m}</option>`).join('')}</select></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-cli-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-cli-btn').addEventListener('click', async () => {
    const fecha = document.getElementById('cli-fecha').value
    const nombre = document.getElementById('cli-nombre').value
    const importe = parseFloat(document.getElementById('cli-importe').value) || 0
    if (!fecha || !nombre) { toast('Completá fecha y cliente', true); return }
    const d = new Date(fecha)
    const { error } = await supabase.from('clientes_movimientos').insert({
      cliente_nombre: nombre,
      fecha_factura: fecha,
      nro_factura: document.getElementById('cli-nrofac').value,
      divisa: document.getElementById('cli-divisa').value,
      importe,
      importe_abonado: parseFloat(document.getElementById('cli-abonado').value) || 0,
      prepago: parseFloat(document.getElementById('cli-prepago').value) || 0,
      medio_pago: document.getElementById('cli-medio').value,
      mes: d.getMonth(), anio: d.getFullYear()
    })
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast('Movimiento guardado ✓'); renderMovimientos()
  })
}

function openClienteDBModal() {
  document.getElementById('modal-title').textContent = 'Agregar Cliente a la Base'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Razón Social</label><input type="text" id="cdb-nombre"></div>
      <div class="form-field"><label>CUIT</label><input type="text" id="cdb-cuit" placeholder="XX-XXXXXXXX-X"></div>
      <div class="form-field"><label>Email</label><input type="email" id="cdb-email"></div>
      <div class="form-field"><label>Teléfono</label><input type="text" id="cdb-tel"></div>
      <div class="form-field full-col"><label>Observaciones</label><input type="text" id="cdb-obs"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-cdb-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-cdb-btn').addEventListener('click', async () => {
    const nombre = document.getElementById('cdb-nombre').value
    if (!nombre) { toast('Ingresá la razón social', true); return }
    const { error } = await supabase.from('clientes_db').insert({ razon_social: nombre, cuit: document.getElementById('cdb-cuit').value, email: document.getElementById('cdb-email').value, telefono: document.getElementById('cdb-tel').value, observaciones: document.getElementById('cdb-obs').value })
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast('Cliente agregado ✓'); renderBase()
  })
}

async function exportCliExcel() {
  const { data } = await supabase.from('clientes_movimientos').select('*').order('fecha_factura', { ascending: false })
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [fmtDate(m.fecha_factura), m.nro_factura || '', m.cliente_nombre || '', m.divisa || 'ARS', fmtNum(m.importe), fmtNum(m.importe_abonado), fmtNum(m.prepago || 0), m.medio_pago || '', fmtNum((+m.importe || 0) - (+m.importe_abonado || 0))])
  exportExcel('Clientes', ['Fecha Factura', 'Nro. Factura', 'Cliente', 'Divisa', 'Importe', 'Abonado', 'Prepago', 'Medio Pago', 'Saldo'], rows, `Compass_Clientes_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
async function exportCliPDF() {
  const { data } = await supabase.from('clientes_movimientos').select('*').order('fecha_factura', { ascending: false })
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [fmtDate(m.fecha_factura), m.nro_factura || '', m.cliente_nombre || '', fmtNum(m.importe), fmtNum(m.importe_abonado), fmtNum((+m.importe || 0) - (+m.importe_abonado || 0)), m.medio_pago || ''])
  exportPDF('Clientes', `Estado de cuenta · ${new Date().toLocaleDateString('es-AR')}`, ['Fecha', 'Factura', 'Cliente', 'Importe', 'Abonado', 'Saldo', 'Medio Pago'], rows, `Compass_Clientes_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
