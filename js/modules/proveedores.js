import { supabase } from '../supabase.js'
import { fmt, fmtDate, fmtNum, today, MEDIOS_PAGO, canEdit, toast, openModal, closeModal, exportExcel, exportPDF } from '../utils.js'

let currentTab = 'facturas'
let currentRole = 'reader'

export async function renderProveedores(role) {
  currentRole = role
  const cont = document.getElementById('view-proveedores')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Proveedores</div><div class="section-desc">Facturas y pagos a proveedores</div></div>
      <div class="btn-row">
        ${canEdit(role) ? `<button class="btn btn-teal" id="btn-new-prov"><i class="ti ti-plus"></i> Nueva factura</button>` : ''}
        <button class="btn btn-excel btn-sm" id="btn-exp-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
        <button class="btn btn-pdf btn-sm" id="btn-exp-pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>
      </div>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="facturas">Facturas</div>
      <div class="tab" data-tab="base">Base de Proveedores</div>
    </div>
    <div id="prov-content"></div>`

  document.querySelectorAll('#view-proveedores .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab
      document.querySelectorAll('#view-proveedores .tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      renderContent()
    })
  })
  document.getElementById('btn-new-prov')?.addEventListener('click', () => openProvModal())
  document.getElementById('btn-exp-excel').addEventListener('click', exportProvExcel)
  document.getElementById('btn-exp-pdf').addEventListener('click', exportProvPDF)
  renderContent()
}

async function renderContent() {
  if (currentTab === 'base') { await renderBase(); return }
  await renderFacturas()
}

async function renderFacturas() {
  const cont = document.getElementById('prov-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('proveedores_movimientos').select('*').order('fecha_factura', { ascending: false })
  const list = data || []
  const total = list.reduce((a, b) => a + (+b.importe || 0), 0)
  const abonado = list.filter(m => m.abonado).reduce((a, b) => a + (+b.importe || 0), 0)
  const pend = total - abonado

  cont.innerHTML = `
    <div class="totals-bar">
      <div class="totals-item"><div class="totals-label">Total</div><div class="totals-val">${fmt(total)}</div></div>
      <div class="totals-item"><div class="totals-label">Monto Abonado</div><div class="totals-val" style="color:var(--green)">${fmt(abonado)}</div></div>
      <div class="totals-item"><div class="totals-label">Monto Pendiente</div><div class="totals-val" style="color:${pend > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(pend)}</div></div>
    </div>
    <div class="filter-row">
      <input type="text" id="prov-search" placeholder="Buscar proveedor..." style="width:220px">
      <select id="prov-estado"><option value="">Todos</option><option value="pend">Pendientes</option><option value="abonado">Abonados</option></select>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Factura</th><th>Proveedor</th><th>Importe</th><th>Vto.</th><th>Forma Pago</th><th>Estado</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody id="prov-tbody">${renderTable(list)}</tbody>
    </table></div></div>`

  const applyFilter = () => {
    const q = document.getElementById('prov-search').value.toLowerCase()
    const estado = document.getElementById('prov-estado').value
    const filtered = list.filter(m =>
      (!q || m.proveedor_nombre?.toLowerCase().includes(q) || m.nro_factura?.toLowerCase().includes(q)) &&
      (!estado || (estado === 'pend' ? !m.abonado : m.abonado))
    )
    document.getElementById('prov-tbody').innerHTML = renderTable(filtered)
    attachHandlers(list)
  }
  document.getElementById('prov-search').addEventListener('input', applyFilter)
  document.getElementById('prov-estado').addEventListener('change', applyFilter)
  attachHandlers(list)
}

function renderTable(list) {
  if (!list.length) return `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">Sin facturas registradas</td></tr>`
  return list.map(m => `<tr>
    <td>${fmtDate(m.fecha_factura)}</td>
    <td style="font-weight:500">${m.nro_factura || '—'}</td>
    <td>${m.proveedor_nombre || '—'}</td>
    <td style="font-weight:600">${fmt(m.importe, m.divisa)}</td>
    <td style="color:var(--text2)">${fmtDate(m.fecha_vencimiento)}</td>
    <td><span class="tag tag-blue">${m.forma_pago || '—'}</span></td>
    <td>${canEdit(currentRole)
      ? `<button class="abonado-btn ${m.abonado ? 'done' : ''} toggle-abonado" data-id="${m.id}" data-val="${m.abonado}">${m.abonado ? '✓ Abonado' : 'Marcar abonado'}</button>`
      : `<span class="tag ${m.abonado ? 'tag-green' : 'tag-amber'}">${m.abonado ? 'Abonado' : 'Pendiente'}</span>`
    }</td>
    ${canEdit(currentRole) ? `<td style="white-space:nowrap">
      <button class="btn btn-ghost btn-sm edit-prov" data-id="${m.id}"><i class="ti ti-pencil"></i></button>
      <button class="btn btn-danger btn-sm delete-prov" data-id="${m.id}"><i class="ti ti-trash"></i></button>
    </td>` : ''}
  </tr>`).join('')
}

function attachHandlers(list) {
  document.querySelectorAll('.toggle-abonado').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newVal = btn.dataset.val === 'true' ? false : true
      const { error } = await supabase.from('proveedores_movimientos').update({ abonado: newVal }).eq('id', btn.dataset.id)
      if (error) { toast('Error al actualizar', true); return }
      toast(newVal ? 'Marcado como abonado ✓' : 'Marcado como pendiente')
      renderFacturas()
    })
  })
  document.querySelectorAll('.edit-prov').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list.find(m => m.id === btn.dataset.id)
      if (item) openProvModal(item)
    })
  })
  document.querySelectorAll('.delete-prov').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta factura?')) return
      const { error } = await supabase.from('proveedores_movimientos').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); renderFacturas()
    })
  })
}

async function renderBase() {
  const cont = document.getElementById('prov-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('proveedores_db').select('*').eq('activo', true).order('razon_social')
  const list = data || []
  cont.innerHTML = `
    ${canEdit(currentRole) ? `<div style="margin-bottom:16px"><button class="btn btn-teal" id="btn-new-prov-db"><i class="ti ti-building-store"></i> Agregar proveedor</button></div>` : ''}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Razón Social</th><th>CUIT</th><th>Email</th><th>Teléfono</th><th>Observaciones</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(p => `<tr>
        <td style="font-weight:500">${p.razon_social}</td><td>${p.cuit || '—'}</td><td>${p.email || '—'}</td><td>${p.telefono || '—'}</td><td>${p.observaciones || '—'}</td>
        ${canEdit(currentRole) ? `<td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm edit-prov-db" data-id="${p.id}"><i class="ti ti-pencil"></i></button>
          <button class="btn btn-danger btn-sm delete-prov-db" data-id="${p.id}"><i class="ti ti-trash"></i></button>
        </td>` : ''}
      </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Sin proveedores en la base</td></tr>`}
      </tbody>
    </table></div></div>`
  document.getElementById('btn-new-prov-db')?.addEventListener('click', () => openProvDBModal())
  document.querySelectorAll('.edit-prov-db').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list.find(p => p.id === btn.dataset.id)
      if (item) openProvDBModal(item)
    })
  })
  document.querySelectorAll('.delete-prov-db').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este proveedor de la base?')) return
      const { error } = await supabase.from('proveedores_db').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); renderBase()
    })
  })
}

function openProvModal(item = null) {
  const isEdit = !!item
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Factura de Proveedor' : 'Nueva Factura de Proveedor'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Fecha Factura</label><input type="date" id="prov-fecha" value="${item?.fecha_factura || today()}"></div>
      <div class="form-field"><label>Nro. Factura</label><input type="text" id="prov-nrofac" placeholder="0001-00012345" value="${item?.nro_factura || ''}"></div>
      <div class="form-field"><label>Proveedor</label><input type="text" id="prov-nombre" placeholder="Razón social" value="${item?.proveedor_nombre || ''}"></div>
      <div class="form-field"><label>Importe</label><input type="number" id="prov-importe" placeholder="0.00" step="0.01" min="0" value="${item?.importe ?? ''}"></div>
      <div class="form-field"><label>Divisa</label><select id="prov-divisa">
        <option value="ARS" ${item?.divisa === 'ARS' ? 'selected' : ''}>$ Pesos</option>
        <option value="USD" ${item?.divisa === 'USD' ? 'selected' : ''}>U$S Dólares</option>
      </select></div>
      <div class="form-field"><label>Fecha Vencimiento</label><input type="date" id="prov-venc" value="${item?.fecha_vencimiento || ''}"></div>
      <div class="form-field"><label>Forma de Pago</label><select id="prov-forma">${MEDIOS_PAGO.map(m => `<option ${item?.forma_pago === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="form-field"><label>Importe Abonado</label><input type="number" id="prov-abonado" placeholder="0.00" step="0.01" min="0" value="${item?.importe_abonado ?? ''}"></div>
      ${isEdit ? `<div class="form-field"><label>Estado</label><select id="prov-abonado-sel">
        <option value="false" ${!item.abonado ? 'selected' : ''}>Pendiente</option>
        <option value="true" ${item.abonado ? 'selected' : ''}>Abonado</option>
      </select></div>` : ''}
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-prov-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-prov-btn').addEventListener('click', async () => {
    const fecha = document.getElementById('prov-fecha').value
    const nombre = document.getElementById('prov-nombre').value
    const importe = parseFloat(document.getElementById('prov-importe').value) || 0
    if (!fecha || !nombre) { toast('Completá fecha y proveedor', true); return }
    const d = new Date(fecha)
    const payload = {
      proveedor_nombre: nombre,
      fecha_factura: fecha,
      nro_factura: document.getElementById('prov-nrofac').value,
      importe,
      divisa: document.getElementById('prov-divisa').value,
      fecha_vencimiento: document.getElementById('prov-venc').value || null,
      forma_pago: document.getElementById('prov-forma').value,
      importe_abonado: parseFloat(document.getElementById('prov-abonado').value) || 0,
      mes: d.getMonth(), anio: d.getFullYear()
    }
    if (isEdit) {
      payload.abonado = document.getElementById('prov-abonado-sel').value === 'true'
    } else {
      payload.abonado = false
    }
    const { error } = isEdit
      ? await supabase.from('proveedores_movimientos').update(payload).eq('id', item.id)
      : await supabase.from('proveedores_movimientos').insert(payload)
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast(isEdit ? 'Factura actualizada ✓' : 'Factura guardada ✓'); renderFacturas()
  })
}

function openProvDBModal(item = null) {
  const isEdit = !!item
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Proveedor' : 'Agregar Proveedor a la Base'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Razón Social</label><input type="text" id="pdb-nombre" value="${item?.razon_social || ''}"></div>
      <div class="form-field"><label>CUIT</label><input type="text" id="pdb-cuit" placeholder="XX-XXXXXXXX-X" value="${item?.cuit || ''}"></div>
      <div class="form-field"><label>Email</label><input type="email" id="pdb-email" value="${item?.email || ''}"></div>
      <div class="form-field"><label>Teléfono</label><input type="text" id="pdb-tel" value="${item?.telefono || ''}"></div>
      <div class="form-field full-col"><label>Observaciones</label><input type="text" id="pdb-obs" value="${item?.observaciones || ''}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-pdb-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-pdb-btn').addEventListener('click', async () => {
    const nombre = document.getElementById('pdb-nombre').value
    if (!nombre) { toast('Ingresá la razón social', true); return }
    const payload = { razon_social: nombre, cuit: document.getElementById('pdb-cuit').value, email: document.getElementById('pdb-email').value, telefono: document.getElementById('pdb-tel').value, observaciones: document.getElementById('pdb-obs').value }
    const { error } = isEdit
      ? await supabase.from('proveedores_db').update(payload).eq('id', item.id)
      : await supabase.from('proveedores_db').insert(payload)
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast(isEdit ? 'Proveedor actualizado ✓' : 'Proveedor agregado ✓'); renderBase()
  })
}

async function exportProvExcel() {
  const { data } = await supabase.from('proveedores_movimientos').select('*').order('fecha_factura', { ascending: false })
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [fmtDate(m.fecha_factura), m.nro_factura || '', m.proveedor_nombre || '', fmtNum(m.importe), m.divisa || 'ARS', fmtDate(m.fecha_vencimiento), m.forma_pago || '', m.abonado ? 'Sí' : 'No'])
  exportExcel('Proveedores', ['Fecha Factura', 'Nro. Factura', 'Proveedor', 'Importe', 'Divisa', 'Vto.', 'Forma Pago', 'Abonado'], rows, `Compass_Proveedores_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
async function exportProvPDF() {
  const { data } = await supabase.from('proveedores_movimientos').select('*').order('fecha_factura', { ascending: false })
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [fmtDate(m.fecha_factura), m.nro_factura || '', m.proveedor_nombre || '', fmtNum(m.importe), fmtDate(m.fecha_vencimiento), m.forma_pago || '', m.abonado ? 'Abonado' : 'Pendiente'])
  exportPDF('Proveedores', `Reporte al ${new Date().toLocaleDateString('es-AR')}`, ['Fecha', 'Factura', 'Proveedor', 'Importe', 'Vto.', 'Forma Pago', 'Estado'], rows, `Compass_Proveedores_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
