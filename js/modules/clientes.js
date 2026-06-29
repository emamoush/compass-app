import { supabase } from '../supabase.js'
import { fmt, fmtDate, fmtNum, today, MEDIOS_PAGO, canEdit, toast, openModal, closeModal, exportExcel, exportPDF } from '../utils.js'

let currentTab = 'facturas'
let currentRole = 'reader'
const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributo', 'Exento', 'Consumidor Final']

export async function renderClientes(role) {
  currentRole = role
  const cont = document.getElementById('view-clientes')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Clientes</div><div class="section-desc">Facturación, recibos y base de clientes</div></div>
      <div class="btn-row" id="cli-header-actions"></div>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="facturas">Facturas</div>
      <div class="tab" data-tab="recibos">Recibos</div>
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
  renderContent()
}

async function renderContent() {
  if (currentTab === 'base') return renderBase()
  if (currentTab === 'recibos') return renderRecibos()
  return renderFacturas()
}

// ════════════════════════ FACTURAS ════════════════════════

async function renderFacturas() {
  const headerActions = document.getElementById('cli-header-actions')
  headerActions.innerHTML = `
    ${canEdit(currentRole) ? `<button class="btn btn-teal" id="btn-new-fac"><i class="ti ti-plus"></i> Nueva factura</button>` : ''}
    <button class="btn btn-excel btn-sm" id="btn-exp-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
    <button class="btn btn-pdf btn-sm" id="btn-exp-pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>`
  document.getElementById('btn-new-fac')?.addEventListener('click', () => openFacturaModal())
  document.getElementById('btn-exp-excel').addEventListener('click', exportFacExcel)
  document.getElementById('btn-exp-pdf').addEventListener('click', exportFacPDF)

  const cont = document.getElementById('clientes-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('facturas').select('*').order('fecha_factura', { ascending: false })
  const list = data || []

  const { data: recibos } = await supabase.from('recibos').select('factura_id, importe')
  const abonadoPorFactura = {}
  ;(recibos || []).forEach(r => { abonadoPorFactura[r.factura_id] = (abonadoPorFactura[r.factura_id] || 0) + (+r.importe || 0) })

  const total = list.reduce((a, b) => a + (+b.importe || 0), 0)
  const abonado = list.reduce((a, b) => a + (abonadoPorFactura[b.id] || 0), 0)
  const pend = total - abonado

  cont.innerHTML = `
    <div class="totals-bar">
      <div class="totals-item"><div class="totals-label">Total Facturado</div><div class="totals-val">${fmt(total)}</div></div>
      <div class="totals-item"><div class="totals-label">Cobrado (vía recibos)</div><div class="totals-val" style="color:var(--green)">${fmt(abonado)}</div></div>
      <div class="totals-item"><div class="totals-label">Pendiente</div><div class="totals-val" style="color:${pend > 0 ? 'var(--red)' : 'var(--green)'}">${fmt(pend)}</div></div>
    </div>
    <div class="filter-row"><input type="text" id="fac-search" placeholder="Buscar cliente o factura..." style="width:240px"></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Importe</th><th>Cobrado</th><th>Saldo</th><th>PDF</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody id="fac-tbody">${renderFacTable(list, abonadoPorFactura)}</tbody>
    </table></div></div>`

  document.getElementById('fac-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase()
    const filtered = list.filter(m => m.cliente_nombre?.toLowerCase().includes(q) || m.nro_factura?.toLowerCase().includes(q))
    document.getElementById('fac-tbody').innerHTML = renderFacTable(filtered, abonadoPorFactura)
    attachFacHandlers(list)
  })
  attachFacHandlers(list)
}

function renderFacTable(list, abonadoPorFactura) {
  if (!list.length) return `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">Sin facturas registradas</td></tr>`
  return list.map(m => {
    const cobrado = abonadoPorFactura[m.id] || 0
    const saldo = (+m.importe || 0) - cobrado
    return `<tr>
      <td>${fmtDate(m.fecha_factura)}</td>
      <td style="font-weight:500">${m.nro_factura || '—'}</td>
      <td>${m.cliente_nombre || '—'}</td>
      <td style="font-weight:600">${fmt(m.importe, m.divisa)}</td>
      <td style="color:var(--green)">${fmt(cobrado, m.divisa)}</td>
      <td style="font-weight:700;color:${saldo <= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(saldo, m.divisa)}</td>
      <td>${m.pdf_url ? `<a href="${m.pdf_url}" target="_blank" class="btn btn-ghost btn-sm"><i class="ti ti-file-text"></i></a>` : '—'}</td>
      ${canEdit(currentRole) ? `<td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm edit-fac" data-id="${m.id}"><i class="ti ti-pencil"></i></button>
        <button class="btn btn-danger btn-sm delete-fac" data-id="${m.id}"><i class="ti ti-trash"></i></button>
      </td>` : ''}
    </tr>`
  }).join('')
}

function attachFacHandlers(list) {
  document.querySelectorAll('.edit-fac').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list.find(m => m.id === btn.dataset.id)
      if (item) openFacturaModal(item)
    })
  })
  document.querySelectorAll('.delete-fac').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta factura? También se eliminarán los recibos vinculados.')) return
      const { error } = await supabase.from('facturas').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminada ✓'); renderFacturas()
    })
  })
}

function openFacturaModal(item = null) {
  const isEdit = !!item
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Factura' : 'Nueva Factura'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Fecha Factura</label><input type="date" id="fac-fecha" value="${item?.fecha_factura || today()}"></div>
      <div class="form-field"><label>Nro. Factura</label><input type="text" id="fac-nro" placeholder="0001-00012345" value="${item?.nro_factura || ''}"></div>
      <div class="form-field"><label>Cliente</label><input type="text" id="fac-cliente" placeholder="Razón social" value="${item?.cliente_nombre || ''}"></div>
      <div class="form-field"><label>Divisa</label><select id="fac-divisa">
        <option value="ARS" ${item?.divisa === 'ARS' ? 'selected' : ''}>$ Pesos</option>
        <option value="USD" ${item?.divisa === 'USD' ? 'selected' : ''}>U$S Dólares</option>
      </select></div>
      <div class="form-field"><label>Importe</label><input type="number" id="fac-importe" placeholder="0.00" step="0.01" min="0" value="${item?.importe ?? ''}"></div>
      <div class="form-field"><label>Prepago / Anticipo</label><input type="number" id="fac-prepago" placeholder="0.00" step="0.01" min="0" value="${item?.prepago ?? ''}"></div>
    </div>
    <div class="divider"></div>
    <div class="form-field">
      <label>Comprobante PDF</label>
      <div class="pdf-options">
        <label class="radio-opt"><input type="radio" name="pdf-mode" value="adjuntar" checked> Adjuntar PDF existente</label>
        <label class="radio-opt"><input type="radio" name="pdf-mode" value="generar"> Generar factura propia</label>
      </div>
      <div id="pdf-adjuntar-box"><input type="file" accept=".pdf" id="fac-pdf-file"></div>
      ${item?.pdf_url ? `<div class="hint">Ya tiene un PDF cargado: <a href="${item.pdf_url}" target="_blank">ver actual</a></div>` : ''}
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-fac-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()

  document.querySelectorAll('input[name="pdf-mode"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('pdf-adjuntar-box').style.display = r.value === 'adjuntar' && r.checked ? 'block' : (document.querySelector('input[name="pdf-mode"]:checked').value === 'adjuntar' ? 'block' : 'none')
    })
  })

  document.getElementById('save-fac-btn').addEventListener('click', async () => {
    const fecha = document.getElementById('fac-fecha').value
    const cliente = document.getElementById('fac-cliente').value
    const importe = parseFloat(document.getElementById('fac-importe').value) || 0
    const nro = document.getElementById('fac-nro').value
    if (!fecha || !cliente) { toast('Completá fecha y cliente', true); return }
    const d = new Date(fecha)
    const pdfMode = document.querySelector('input[name="pdf-mode"]:checked').value

    const saveBtn = document.getElementById('save-fac-btn')
    saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'

    let pdfUrl = item?.pdf_url || null
    let pdfGenerado = item?.pdf_generado || false

    if (pdfMode === 'adjuntar') {
      const file = document.getElementById('fac-pdf-file').files[0]
      if (file) {
        const path = `facturas/${Date.now()}_${file.name}`
        const { data: uploadData, error: upErr } = await supabase.storage.from('documentos').upload(path, file)
        if (upErr) { toast('Error al subir PDF: ' + upErr.message, true); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return }
        const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
        pdfUrl = urlData.publicUrl
        pdfGenerado = false
      }
    }

    const payload = {
      cliente_nombre: cliente, fecha_factura: fecha, nro_factura: nro,
      divisa: document.getElementById('fac-divisa').value, importe,
      prepago: parseFloat(document.getElementById('fac-prepago').value) || 0,
      mes: d.getMonth(), anio: d.getFullYear(),
      pdf_url: pdfUrl, pdf_generado: pdfGenerado
    }

    const { data: saved, error } = isEdit
      ? await supabase.from('facturas').update(payload).eq('id', item.id).select().single()
      : await supabase.from('facturas').insert(payload).select().single()

    if (error) { toast('Error al guardar', true); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return }

    if (pdfMode === 'generar') {
      generarFacturaPDF(saved)
      await supabase.from('facturas').update({ pdf_generado: true }).eq('id', saved.id)
    }

    closeModal(); toast(isEdit ? 'Factura actualizada ✓' : 'Factura guardada ✓'); renderFacturas()
  })
}

function generarFacturaPDF(fac) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  doc.setFontSize(18); doc.setTextColor(15, 31, 61)
  doc.text('FACTURA', 14, 20)
  doc.setFontSize(10); doc.setTextColor(91, 111, 138)
  doc.text(`Nro: ${fac.nro_factura || '—'}`, 14, 30)
  doc.text(`Fecha: ${fmtDate(fac.fecha_factura)}`, 14, 36)
  doc.text(`Cliente: ${fac.cliente_nombre}`, 14, 42)
  doc.autoTable({
    startY: 52,
    head: [['Concepto', 'Importe']],
    body: [['Servicios prestados', fmt(fac.importe, fac.divisa)], ['Prepago / Anticipo', fmt(fac.prepago || 0, fac.divisa)], ['Total', fmt((fac.importe || 0) - (fac.prepago || 0), fac.divisa)]],
    headStyles: { fillColor: [15, 31, 61] }
  })
  doc.save(`Factura_${fac.nro_factura || fac.id}.pdf`)
}

// ════════════════════════ RECIBOS ════════════════════════

async function renderRecibos() {
  const headerActions = document.getElementById('cli-header-actions')
  headerActions.innerHTML = `
    ${canEdit(currentRole) ? `<button class="btn btn-teal" id="btn-new-rec"><i class="ti ti-plus"></i> Nuevo recibo</button>` : ''}
    <button class="btn btn-excel btn-sm" id="btn-exp-rec-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>`
  document.getElementById('btn-new-rec')?.addEventListener('click', () => openReciboModal())
  document.getElementById('btn-exp-rec-excel').addEventListener('click', exportRecExcel)

  const cont = document.getElementById('clientes-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`

  const { data: recibos } = await supabase.from('recibos').select('*').order('fecha', { ascending: false })
  const { data: facturas } = await supabase.from('facturas').select('id, nro_factura, cliente_nombre')
  const facMap = {}
  ;(facturas || []).forEach(f => { facMap[f.id] = f })
  const list = recibos || []

  cont.innerHTML = `
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Factura vinculada</th><th>Cliente</th><th>Importe</th><th>Medio Pago</th><th>Comprobante</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(r => {
        const f = facMap[r.factura_id]
        return `<tr>
          <td>${fmtDate(r.fecha)}</td>
          <td style="font-weight:500">${f?.nro_factura || '— (factura eliminada)'}</td>
          <td>${f?.cliente_nombre || '—'}</td>
          <td style="font-weight:600;color:var(--green)">${fmt(r.importe, r.divisa)}</td>
          <td><span class="tag tag-blue">${r.medio_pago || '—'}</span></td>
          <td>${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" class="btn btn-ghost btn-sm"><i class="ti ti-file-text"></i></a>` : '—'}</td>
          ${canEdit(currentRole) ? `<td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm edit-rec" data-id="${r.id}"><i class="ti ti-pencil"></i></button>
            <button class="btn btn-danger btn-sm delete-rec" data-id="${r.id}"><i class="ti ti-trash"></i></button>
          </td>` : ''}
        </tr>`
      }).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Sin recibos registrados</td></tr>`}
      </tbody>
    </table></div></div>`

  document.querySelectorAll('.edit-rec').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list.find(r => r.id === btn.dataset.id)
      if (item) openReciboModal(item, facturas)
    })
  })
  document.querySelectorAll('.delete-rec').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este recibo?')) return
      const { error } = await supabase.from('recibos').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); renderRecibos()
    })
  })

  window._recibosFacturas = facturas
}

async function openReciboModal(item = null) {
  const isEdit = !!item
  const { data: facturas } = await supabase.from('facturas').select('id, nro_factura, cliente_nombre, fecha_factura').order('fecha_factura', { ascending: false })
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Recibo' : 'Nuevo Recibo'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field full-col"><label>Factura que cancela</label>
        <select id="rec-factura">
          <option value="">Seleccionar factura...</option>
          ${(facturas || []).map(f => `<option value="${f.id}" ${item?.factura_id === f.id ? 'selected' : ''}>${f.nro_factura || 'S/N'} — ${f.cliente_nombre} (${fmtDate(f.fecha_factura)})</option>`).join('')}
        </select>
      </div>
      <div class="form-field"><label>Fecha de Pago</label><input type="date" id="rec-fecha" value="${item?.fecha || today()}"></div>
      <div class="form-field"><label>Divisa</label><select id="rec-divisa">
        <option value="ARS" ${item?.divisa === 'ARS' ? 'selected' : ''}>$ Pesos</option>
        <option value="USD" ${item?.divisa === 'USD' ? 'selected' : ''}>U$S Dólares</option>
      </select></div>
      <div class="form-field"><label>Importe</label><input type="number" id="rec-importe" placeholder="0.00" step="0.01" min="0" value="${item?.importe ?? ''}"></div>
      <div class="form-field"><label>Medio de Pago</label><select id="rec-medio">${MEDIOS_PAGO.map(m => `<option ${item?.medio_pago === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="form-field full-col"><label>Comprobante (PDF / imagen)</label><input type="file" accept=".pdf,.jpg,.jpeg,.png" id="rec-file">
        ${item?.pdf_url ? `<div class="hint">Ya tiene comprobante: <a href="${item.pdf_url}" target="_blank">ver actual</a></div>` : ''}
      </div>
      <div class="form-field full-col"><label>Observaciones</label><input type="text" id="rec-obs" value="${item?.observaciones || ''}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-rec-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()

  document.getElementById('save-rec-btn').addEventListener('click', async () => {
    const facturaId = document.getElementById('rec-factura').value
    const fecha = document.getElementById('rec-fecha').value
    const importe = parseFloat(document.getElementById('rec-importe').value) || 0
    if (!facturaId || !fecha || !importe) { toast('Completá factura, fecha e importe', true); return }

    const saveBtn = document.getElementById('save-rec-btn')
    saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'

    let pdfUrl = item?.pdf_url || null
    const file = document.getElementById('rec-file').files[0]
    if (file) {
      const path = `recibos/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file)
      if (upErr) { toast('Error al subir comprobante: ' + upErr.message, true); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return }
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      pdfUrl = urlData.publicUrl
    }

    const payload = {
      factura_id: facturaId, fecha, importe,
      divisa: document.getElementById('rec-divisa').value,
      medio_pago: document.getElementById('rec-medio').value,
      observaciones: document.getElementById('rec-obs').value,
      pdf_url: pdfUrl
    }
    const { error } = isEdit
      ? await supabase.from('recibos').update(payload).eq('id', item.id)
      : await supabase.from('recibos').insert(payload)
    if (error) { toast('Error al guardar', true); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return }
    closeModal(); toast(isEdit ? 'Recibo actualizado ✓' : 'Recibo guardado ✓'); renderRecibos()
  })
}

// ════════════════════════ BASE DE CLIENTES ════════════════════════

async function renderBase() {
  document.getElementById('cli-header-actions').innerHTML = ''
  const cont = document.getElementById('clientes-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('clientes_db').select('*').eq('activo', true).order('razon_social')
  const list = data || []
  cont.innerHTML = `
    ${canEdit(currentRole) ? `<div style="margin-bottom:16px"><button class="btn btn-teal" id="btn-new-cliente-db"><i class="ti ti-user-plus"></i> Agregar cliente</button></div>` : ''}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Razón Social</th><th>CUIT</th><th>Dirección</th><th>Cond. IVA</th><th>Email</th><th>Teléfono</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(c => `<tr>
        <td style="font-weight:500">${c.razon_social}</td><td>${c.cuit || '—'}</td><td>${c.direccion || '—'}</td>
        <td><span class="tag tag-gray">${c.condicion_iva || '—'}</span></td><td>${c.email || '—'}</td><td>${c.telefono || '—'}</td>
        ${canEdit(currentRole) ? `<td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm edit-cli-db" data-id="${c.id}"><i class="ti ti-pencil"></i></button>
          <button class="btn btn-danger btn-sm delete-cli-db" data-id="${c.id}"><i class="ti ti-trash"></i></button>
        </td>` : ''}
      </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Sin clientes en la base</td></tr>`}
      </tbody>
    </table></div></div>`
  document.getElementById('btn-new-cliente-db')?.addEventListener('click', () => openClienteDBModal())
  document.querySelectorAll('.edit-cli-db').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list.find(c => c.id === btn.dataset.id)
      if (item) openClienteDBModal(item)
    })
  })
  document.querySelectorAll('.delete-cli-db').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este cliente de la base?')) return
      const { error } = await supabase.from('clientes_db').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); renderBase()
    })
  })
}

function openClienteDBModal(item = null) {
  const isEdit = !!item
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Cliente' : 'Agregar Cliente a la Base'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field full-col"><label>Razón Social</label><input type="text" id="cdb-nombre" value="${item?.razon_social || ''}"></div>
      <div class="form-field"><label>CUIT</label><input type="text" id="cdb-cuit" placeholder="XX-XXXXXXXX-X" value="${item?.cuit || ''}"></div>
      <div class="form-field"><label>Condición frente al IVA</label><select id="cdb-iva">${CONDICIONES_IVA.map(c => `<option ${item?.condicion_iva === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="form-field full-col"><label>Dirección</label><input type="text" id="cdb-dir" value="${item?.direccion || ''}"></div>
      <div class="form-field"><label>Email</label><input type="email" id="cdb-email" value="${item?.email || ''}"></div>
      <div class="form-field"><label>Teléfono</label><input type="text" id="cdb-tel" value="${item?.telefono || ''}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-cdb-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-cdb-btn').addEventListener('click', async () => {
    const nombre = document.getElementById('cdb-nombre').value
    if (!nombre) { toast('Ingresá la razón social', true); return }
    const payload = {
      razon_social: nombre, cuit: document.getElementById('cdb-cuit').value,
      condicion_iva: document.getElementById('cdb-iva').value,
      direccion: document.getElementById('cdb-dir').value,
      email: document.getElementById('cdb-email').value, telefono: document.getElementById('cdb-tel').value
    }
    const { error } = isEdit
      ? await supabase.from('clientes_db').update(payload).eq('id', item.id)
      : await supabase.from('clientes_db').insert(payload)
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast(isEdit ? 'Cliente actualizado ✓' : 'Cliente agregado ✓'); renderBase()
  })
}

// ════════════════════════ EXPORTS ════════════════════════

async function exportFacExcel() {
  const { data } = await supabase.from('facturas').select('*').order('fecha_factura', { ascending: false })
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [fmtDate(m.fecha_factura), m.nro_factura || '', m.cliente_nombre || '', m.divisa || 'ARS', fmtNum(m.importe), fmtNum(m.prepago || 0)])
  exportExcel('Facturas', ['Fecha', 'Nro. Factura', 'Cliente', 'Divisa', 'Importe', 'Prepago'], rows, `Compass_Facturas_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
async function exportFacPDF() {
  const { data } = await supabase.from('facturas').select('*').order('fecha_factura', { ascending: false })
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [fmtDate(m.fecha_factura), m.nro_factura || '', m.cliente_nombre || '', fmtNum(m.importe)])
  exportPDF('Facturas', `Listado al ${new Date().toLocaleDateString('es-AR')}`, ['Fecha', 'Factura', 'Cliente', 'Importe'], rows, `Compass_Facturas_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
async function exportRecExcel() {
  const { data } = await supabase.from('recibos').select('*').order('fecha', { ascending: false })
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(r => [fmtDate(r.fecha), fmtNum(r.importe), r.divisa || 'ARS', r.medio_pago || '', r.observaciones || ''])
  exportExcel('Recibos', ['Fecha', 'Importe', 'Divisa', 'Medio Pago', 'Observaciones'], rows, `Compass_Recibos_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
