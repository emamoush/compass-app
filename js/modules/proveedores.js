import { supabase } from '../supabase.js'
import { fmt, fmtDate, fmtNum, today, MEDIOS_PAGO, canEdit, toast, openModal, closeModal, exportExcel, exportPDF } from '../utils.js'

let currentTab = 'facturas'
let currentRole = 'reader'
const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributo', 'Exento', 'Consumidor Final']

export async function renderProveedores(role) {
  currentRole = role
  const cont = document.getElementById('view-proveedores')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Proveedores</div><div class="section-desc">Facturas, pagos y órdenes de pago</div></div>
      <div class="btn-row" id="prov-header-actions"></div>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="facturas">Facturas</div>
      <div class="tab" data-tab="ordenes">Órdenes de Pago</div>
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
  renderContent()
}

async function renderContent() {
  if (currentTab === 'base') return renderBase()
  if (currentTab === 'ordenes') return renderOrdenes()
  return renderFacturas()
}

// ════════════════════════ FACTURAS ════════════════════════

async function renderFacturas() {
  document.getElementById('prov-header-actions').innerHTML = `
    ${canEdit(currentRole) ? `<button class="btn btn-teal" id="btn-new-prov"><i class="ti ti-plus"></i> Nueva factura</button>` : ''}
    <button class="btn btn-excel btn-sm" id="btn-exp-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
    <button class="btn btn-pdf btn-sm" id="btn-exp-pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>`
  document.getElementById('btn-new-prov')?.addEventListener('click', () => openProvModal())
  document.getElementById('btn-exp-excel').addEventListener('click', exportProvExcel)
  document.getElementById('btn-exp-pdf').addEventListener('click', exportProvPDF)

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

// ════════════════════════ ÓRDENES DE PAGO ════════════════════════

async function renderOrdenes() {
  document.getElementById('prov-header-actions').innerHTML = `
    ${canEdit(currentRole) ? `<button class="btn btn-teal" id="btn-new-orden"><i class="ti ti-file-invoice"></i> Generar Orden de Pago</button>` : ''}`
  document.getElementById('btn-new-orden')?.addEventListener('click', () => openOrdenModal())

  const cont = document.getElementById('prov-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('ordenes_pago').select('*').order('fecha', { ascending: false })
  const list = data || []

  cont.innerHTML = `
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Nro. Orden</th><th>Fecha</th><th>Proveedor</th><th>Moneda</th><th>Importe</th><th>Pesificado</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(o => `<tr>
        <td style="font-weight:600">${o.numero}</td>
        <td>${new Date(o.fecha).toLocaleDateString('es-AR')}</td>
        <td>${o.proveedor_nombre}</td>
        <td><span class="tag tag-gray">${o.moneda}</span></td>
        <td style="font-weight:600">${fmt(o.importe_total, o.moneda)}</td>
        <td>${o.importe_pesificado ? fmt(o.importe_pesificado, 'ARS') : '—'}</td>
        ${canEdit(currentRole) ? `<td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm reprint-orden" data-id="${o.id}"><i class="ti ti-printer"></i></button>
          <button class="btn btn-danger btn-sm delete-orden" data-id="${o.id}"><i class="ti ti-trash"></i></button>
        </td>` : ''}
      </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Sin órdenes de pago generadas</td></tr>`}
      </tbody>
    </table></div></div>`

  document.querySelectorAll('.reprint-orden').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = list.find(x => x.id === btn.dataset.id)
      if (o) generarOrdenPagoPDF(o)
    })
  })
  document.querySelectorAll('.delete-orden').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta orden de pago? (no afecta el estado de las facturas)')) return
      const { error } = await supabase.from('ordenes_pago').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminada ✓'); renderOrdenes()
    })
  })
}

async function openOrdenModal() {
  const { data: proveedores } = await supabase.from('proveedores_db').select('*').eq('activo', true).order('razon_social')
  const { data: cuentas } = await supabase.from('cuentas_bancarias').select('*').eq('activa', true)

  document.getElementById('modal-title').textContent = 'Generar Orden de Pago'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field full-col"><label>Proveedor</label>
        <select id="op-proveedor">
          <option value="">Seleccionar proveedor...</option>
          ${(proveedores || []).map(p => `<option value="${p.id}" data-nombre="${p.razon_social}" data-cuit="${p.cuit || ''}">${p.razon_social}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="op-facturas-box" class="hint">Elegí un proveedor para ver sus facturas pendientes.</div>
    <div id="op-totales-box"></div>
    <div class="divider"></div>
    <div class="form-grid" id="op-imputacion-box" style="display:none">
      <div class="form-field"><label>Concepto Retención</label><input type="text" id="op-ret-concepto" placeholder="Ej: Retención de Ganancias" value="Retención de Ganancias"></div>
      <div class="form-field"><label>Importe Retención</label><input type="number" id="op-ret-importe" placeholder="0.00" step="0.01" min="0" value="0"></div>
      <div class="form-field full-col"><label>Cuenta de Origen</label>
        <select id="op-cuenta">
          <option value="">Seleccionar cuenta...</option>
          ${(cuentas || []).map(c => `<option value="${c.nombre || c.tipo}">${c.nombre || c.tipo}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-orden-btn" disabled><i class="ti ti-check"></i> Generar Orden</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()

  document.getElementById('op-proveedor').addEventListener('change', async (e) => {
    const provId = e.target.value
    const box = document.getElementById('op-facturas-box')
    document.getElementById('save-orden-btn').disabled = true
    document.getElementById('op-imputacion-box').style.display = 'none'
    document.getElementById('op-totales-box').innerHTML = ''
    if (!provId) { box.innerHTML = `<div class="hint">Elegí un proveedor para ver sus facturas pendientes.</div>`; return }

    const provNombre = e.target.selectedOptions[0].dataset.nombre

    box.innerHTML = `<div class="loading"><div class="spinner"></div> Buscando facturas...</div>`
    const { data: facturas } = await supabase.from('proveedores_movimientos').select('*').eq('proveedor_nombre', provNombre).eq('abonado', false).order('fecha_vencimiento')

    if (!facturas?.length) {
      box.innerHTML = `<div class="hint">Este proveedor no tiene facturas pendientes.</div>`
      return
    }

    box.innerHTML = `
      <label style="font-size:13px;font-weight:600;color:var(--text2);display:block;margin:10px 0 6px">Facturas pendientes — tildá las que incluís en la orden</label>
      <div class="card" style="padding:0">
        <div class="table-wrap"><table>
          <thead><tr><th></th><th>Factura</th><th>Fecha Emisión</th><th>Vto.</th><th>Importe</th></tr></thead>
          <tbody>${facturas.map(f => `<tr>
            <td><input type="checkbox" class="op-fac-check" data-id="${f.id}" data-importe="${f.importe}" data-divisa="${f.divisa}" data-nro="${f.nro_factura || ''}" data-fecha="${f.fecha_factura}"></td>
            <td>${f.nro_factura || '—'}</td>
            <td>${fmtDate(f.fecha_factura)}</td>
            <td>${fmtDate(f.fecha_vencimiento)}</td>
            <td>${fmt(f.importe, f.divisa)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`

    document.querySelectorAll('.op-fac-check').forEach(chk => {
      chk.addEventListener('change', recalcOrden)
    })
  })

  function recalcOrden() {
    const checked = [...document.querySelectorAll('.op-fac-check:checked')]
    const totalesBox = document.getElementById('op-totales-box')
    const saveBtn = document.getElementById('save-orden-btn')
    const impBox = document.getElementById('op-imputacion-box')

    if (!checked.length) {
      totalesBox.innerHTML = ''
      saveBtn.disabled = true
      impBox.style.display = 'none'
      return
    }

    const divisas = new Set(checked.map(c => c.dataset.divisa))
    const divisa = divisas.size === 1 ? [...divisas][0] : 'MIXTA'
    const total = checked.reduce((a, c) => a + parseFloat(c.dataset.importe), 0)

    let tcInput = ''
    if (divisa === 'USD' || divisa === 'MIXTA') {
      tcInput = `<div class="form-field"><label>Tipo de Cambio (para pesificar)</label><input type="number" id="op-tc" placeholder="Ej: 1350.00" step="0.01" min="0"></div>`
    }

    totalesBox.innerHTML = `
      <div class="form-grid" style="margin-top:14px">
        <div class="form-field"><label>Total Seleccionado</label><div class="metric-card teal" style="padding:10px 14px"><div class="metric-value" style="font-size:20px">${fmt(total, divisa === 'MIXTA' ? 'ARS' : divisa)}</div></div></div>
        ${tcInput}
      </div>`

    document.getElementById('op-tc')?.addEventListener('input', () => {})
    saveBtn.disabled = false
    impBox.style.display = 'grid'
  }

  document.getElementById('save-orden-btn').addEventListener('click', async () => {
    const checked = [...document.querySelectorAll('.op-fac-check:checked')]
    if (!checked.length) { toast('Seleccioná al menos una factura', true); return }

    const provSel = document.getElementById('op-proveedor')
    const provNombre = provSel.selectedOptions[0].dataset.nombre
    const provCuit = provSel.selectedOptions[0].dataset.cuit
    const provId = provSel.value

    const divisas = new Set(checked.map(c => c.dataset.divisa))
    const divisa = divisas.size === 1 ? [...divisas][0] : 'MIXTA'
    const total = checked.reduce((a, c) => a + parseFloat(c.dataset.importe), 0)
    const tc = parseFloat(document.getElementById('op-tc')?.value) || null
    const pesificado = (divisa === 'USD' || divisa === 'MIXTA') && tc ? total * tc : null

    const retConcepto = document.getElementById('op-ret-concepto').value
    const retImporte = parseFloat(document.getElementById('op-ret-importe').value) || 0
    const cuentaOrigen = document.getElementById('op-cuenta').value

    const saveBtn = document.getElementById('save-orden-btn')
    saveBtn.disabled = true; saveBtn.textContent = 'Generando...'

    // Generar número de orden correlativo simple basado en timestamp
    const numero = '00' + Math.floor(Date.now() / 1000).toString().slice(-8)

    const facturasInfo = checked.map(c => ({
      id: c.dataset.id, nro: c.dataset.nro, fecha: c.dataset.fecha,
      importe: parseFloat(c.dataset.importe), divisa: c.dataset.divisa
    }))

    const payload = {
      numero, proveedor_id: provId || null, proveedor_nombre: provNombre, proveedor_cuit: provCuit,
      moneda: divisa === 'MIXTA' ? 'ARS' : divisa, tipo_cambio: tc,
      facturas_ids: facturasInfo, importe_total: total, importe_pesificado: pesificado,
      retencion_concepto: retConcepto, retencion_importe: retImporte, cuenta_origen: cuentaOrigen
    }

    const { data: saved, error } = await supabase.from('ordenes_pago').insert(payload).select().single()
    if (error) { toast('Error al generar la orden', true); saveBtn.disabled = false; saveBtn.textContent = 'Generar Orden'; return }

    // Marcar facturas como abonadas
    for (const f of facturasInfo) {
      await supabase.from('proveedores_movimientos').update({ abonado: true }).eq('id', f.id)
    }

    generarOrdenPagoPDF(saved)
    closeModal()
    toast('Orden de pago generada ✓')
    renderOrdenes()
  })
}

function generarOrdenPagoPDF(orden) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  const facturas = Array.isArray(orden.facturas_ids) ? orden.facturas_ids : JSON.parse(orden.facturas_ids || '[]')

  doc.setFontSize(16); doc.setTextColor(15, 31, 61)
  doc.text('ORDEN DE PAGO', 14, 18)

  doc.setFontSize(10); doc.setTextColor(40, 40, 40)
  doc.text(`N° Orden de Pago:`, 14, 30); doc.text(String(orden.numero), 60, 30)
  doc.text(`Fecha:`, 140, 30); doc.text(new Date(orden.fecha).toLocaleString('es-AR'), 160, 30)
  doc.text(`Proveedor:`, 14, 37); doc.text(orden.proveedor_nombre, 60, 37)
  doc.text(`C.U.I.T.:`, 14, 44); doc.text(orden.proveedor_cuit || '—', 60, 44)
  doc.text(`Moneda:`, 140, 44); doc.text(orden.moneda === 'USD' ? 'DOLARES' : 'PESOS', 160, 44)

  const showPesificado = orden.moneda === 'USD' && orden.importe_pesificado
  const head = showPesificado
    ? [['Nro. Comprobante', 'Fecha Emisión', 'Importe M/O', 'T.C.', 'Importe Pesificado']]
    : [['Nro. Comprobante', 'Fecha Emisión', 'Importe']]
  const body = facturas.map(f => showPesificado
    ? [f.nro || '—', fmtDate(f.fecha), fmtNum(f.importe), fmtNum(orden.tipo_cambio), fmtNum(f.importe * orden.tipo_cambio)]
    : [f.nro || '—', fmtDate(f.fecha), fmtNum(f.importe)]
  )

  doc.autoTable({
    startY: 52, head, body,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 31, 61], textColor: 255 },
    foot: showPesificado
      ? [['TOTALES', '', fmtNum(orden.importe_total), '', fmtNum(orden.importe_pesificado)]]
      : [['TOTALES', '', fmtNum(orden.importe_total)]],
    footStyles: { fillColor: [240, 244, 250], textColor: [15, 31, 61], fontStyle: 'bold' }
  })

  let y = doc.lastAutoTable.finalY + 12
  doc.setFontSize(11); doc.setTextColor(15, 31, 61)
  doc.text('IMPUTACIÓN', 14, y); y += 7
  doc.setFontSize(10); doc.setTextColor(60, 60, 60)
  if (orden.retencion_concepto) { doc.text(orden.retencion_concepto, 14, y); doc.text(fmtNum(orden.retencion_importe || 0), 160, y); y += 6 }
  if (orden.cuenta_origen) { doc.text('Cuenta de origen: ' + orden.cuenta_origen, 14, y); y += 6 }
  y += 4
  doc.setFontSize(11); doc.setTextColor(15, 31, 61)
  doc.text('TOTAL ORDEN:', 14, y)
  doc.text(fmtNum(showPesificado ? orden.importe_pesificado : orden.importe_total), 160, y)

  doc.save(`OrdenPago_${orden.numero}.pdf`)
}

// ════════════════════════ BASE DE PROVEEDORES ════════════════════════

async function renderBase() {
  document.getElementById('prov-header-actions').innerHTML = ''
  const cont = document.getElementById('prov-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('proveedores_db').select('*').eq('activo', true).order('razon_social')
  const list = data || []
  cont.innerHTML = `
    ${canEdit(currentRole) ? `<div style="margin-bottom:16px"><button class="btn btn-teal" id="btn-new-prov-db"><i class="ti ti-building-store"></i> Agregar proveedor</button></div>` : ''}
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Razón Social</th><th>CUIT</th><th>Dirección</th><th>Cond. IVA</th><th>Email</th><th>Teléfono</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(p => `<tr>
        <td style="font-weight:500">${p.razon_social}</td><td>${p.cuit || '—'}</td><td>${p.direccion || '—'}</td>
        <td><span class="tag tag-gray">${p.condicion_iva || '—'}</span></td><td>${p.email || '—'}</td><td>${p.telefono || '—'}</td>
        ${canEdit(currentRole) ? `<td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm edit-prov-db" data-id="${p.id}"><i class="ti ti-pencil"></i></button>
          <button class="btn btn-danger btn-sm delete-prov-db" data-id="${p.id}"><i class="ti ti-trash"></i></button>
        </td>` : ''}
      </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Sin proveedores en la base</td></tr>`}
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

function openProvDBModal(item = null) {
  const isEdit = !!item
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Proveedor' : 'Agregar Proveedor a la Base'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field full-col"><label>Razón Social</label><input type="text" id="pdb-nombre" value="${item?.razon_social || ''}"></div>
      <div class="form-field"><label>CUIT</label><input type="text" id="pdb-cuit" placeholder="XX-XXXXXXXX-X" value="${item?.cuit || ''}"></div>
      <div class="form-field"><label>Condición frente al IVA</label><select id="pdb-iva">${CONDICIONES_IVA.map(c => `<option ${item?.condicion_iva === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="form-field full-col"><label>Dirección</label><input type="text" id="pdb-dir" value="${item?.direccion || ''}"></div>
      <div class="form-field"><label>Email</label><input type="email" id="pdb-email" value="${item?.email || ''}"></div>
      <div class="form-field"><label>Teléfono</label><input type="text" id="pdb-tel" value="${item?.telefono || ''}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-pdb-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-pdb-btn').addEventListener('click', async () => {
    const nombre = document.getElementById('pdb-nombre').value
    if (!nombre) { toast('Ingresá la razón social', true); return }
    const payload = {
      razon_social: nombre, cuit: document.getElementById('pdb-cuit').value,
      condicion_iva: document.getElementById('pdb-iva').value,
      direccion: document.getElementById('pdb-dir').value,
      email: document.getElementById('pdb-email').value, telefono: document.getElementById('pdb-tel').value
    }
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
