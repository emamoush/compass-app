import { supabase } from '../supabase.js'
import { fmt, fmtDate, fmtNum, today, canEdit, toast, openModal, closeModal, exportExcel, exportPDF } from '../utils.js'

let currentRole = 'reader'

export async function renderEgresos(role) {
  currentRole = role
  const cont = document.getElementById('view-egresos')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">EGRs / No Proveedores</div><div class="section-desc">Egresos a prestadores sin factura</div></div>
      <div class="btn-row">
        ${canEdit(role) ? `<button class="btn btn-teal" id="btn-new-egr"><i class="ti ti-plus"></i> Nuevo egreso</button>` : ''}
        <button class="btn btn-excel btn-sm" id="btn-exp-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
        <button class="btn btn-pdf btn-sm" id="btn-exp-pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>
      </div>
    </div>
    <div id="egr-content"></div>`

  document.getElementById('btn-new-egr')?.addEventListener('click', () => openEgrModal())
  document.getElementById('btn-exp-excel').addEventListener('click', exportEgrExcel)
  document.getElementById('btn-exp-pdf').addEventListener('click', exportEgrPDF)
  await renderEgresosContent()
}

async function renderEgresosContent() {
  const cont = document.getElementById('egr-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
  const { data } = await supabase.from('egrs').select('*').order('fecha_vencimiento', { ascending: true })
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
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Entidad</th><th>Comprobante</th><th>Concepto</th><th>Vto.</th><th>Importe</th><th>Observaciones</th><th>Estado</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody id="egr-tbody">${renderTable(list)}</tbody>
    </table></div></div>`
  attachHandlers(list)
}

function renderTable(list) {
  if (!list.length) return `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">Sin egresos registrados</td></tr>`
  return list.map(m => `<tr>
    <td style="font-weight:500">${m.entidad || '—'}</td>
    <td>${m.nro_comprobante || '—'}</td>
    <td>${m.concepto || '—'}</td>
    <td>${fmtDate(m.fecha_vencimiento)}</td>
    <td style="font-weight:600">${fmt(m.importe, m.divisa)}</td>
    <td style="font-size:12px;color:var(--text2)">${m.observaciones || '—'}</td>
    <td>${canEdit(currentRole)
      ? `<button class="abonado-btn ${m.abonado ? 'done' : ''} toggle-egr" data-id="${m.id}" data-val="${m.abonado}">${m.abonado ? '✓ Abonado' : 'Marcar abonado'}</button>`
      : `<span class="tag ${m.abonado ? 'tag-green' : 'tag-amber'}">${m.abonado ? 'Abonado' : 'Pendiente'}</span>`
    }</td>
    ${canEdit(currentRole) ? `<td><button class="btn btn-danger btn-sm delete-egr" data-id="${m.id}"><i class="ti ti-trash"></i></button></td>` : ''}
  </tr>`).join('')
}

function attachHandlers() {
  document.querySelectorAll('.toggle-egr').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newVal = btn.dataset.val === 'true' ? false : true
      const { error } = await supabase.from('egrs').update({ abonado: newVal }).eq('id', btn.dataset.id)
      if (error) { toast('Error al actualizar', true); return }
      toast(newVal ? 'Marcado como abonado ✓' : 'Marcado como pendiente')
      renderEgresosContent()
    })
  })
  document.querySelectorAll('.delete-egr').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este egreso?')) return
      const { error } = await supabase.from('egrs').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); renderEgresosContent()
    })
  })
}

function openEgrModal() {
  document.getElementById('modal-title').textContent = 'Nuevo Egreso / No Proveedor'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Individuo / Entidad</label><input type="text" id="egr-ent" placeholder="Nombre o razón social"></div>
      <div class="form-field"><label>Nro. Comprobante</label><input type="text" id="egr-comp" placeholder="Factura, recibo, VEP, etc."></div>
      <div class="form-field"><label>Concepto</label><input type="text" id="egr-conc" placeholder="Descripción del gasto"></div>
      <div class="form-field"><label>Fecha Vencimiento</label><input type="date" id="egr-venc"></div>
      <div class="form-field"><label>Divisa</label><select id="egr-divisa"><option value="ARS">$ Pesos</option><option value="USD">U$S Dólares</option></select></div>
      <div class="form-field"><label>Importe</label><input type="number" id="egr-importe" placeholder="0.00" step="0.01" min="0"></div>
      <div class="form-field full-col"><label>Observaciones</label><input type="text" id="egr-obs" placeholder="Notas adicionales..."></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-egr-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-egr-btn').addEventListener('click', async () => {
    const entidad = document.getElementById('egr-ent').value
    const importe = parseFloat(document.getElementById('egr-importe').value) || 0
    const venc = document.getElementById('egr-venc').value
    if (!entidad) { toast('Ingresá la entidad', true); return }
    const d = venc ? new Date(venc) : new Date()
    const { error } = await supabase.from('egrs').insert({
      entidad,
      nro_comprobante: document.getElementById('egr-comp').value,
      concepto: document.getElementById('egr-conc').value,
      fecha_vencimiento: venc || null,
      divisa: document.getElementById('egr-divisa').value,
      importe,
      observaciones: document.getElementById('egr-obs').value,
      abonado: false,
      mes: d.getMonth(), anio: d.getFullYear()
    })
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast('Egreso guardado ✓'); renderEgresosContent()
  })
}

async function exportEgrExcel() {
  const { data } = await supabase.from('egrs').select('*').order('fecha_vencimiento')
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [m.entidad || '', m.nro_comprobante || '', m.concepto || '', fmtDate(m.fecha_vencimiento), m.divisa || 'ARS', fmtNum(m.importe), m.observaciones || '', m.abonado ? 'Abonado' : 'Pendiente'])
  exportExcel('EGRs', ['Entidad', 'Comprobante', 'Concepto', 'Vto.', 'Divisa', 'Importe', 'Observaciones', 'Estado'], rows, `Compass_EGRs_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
async function exportEgrPDF() {
  const { data } = await supabase.from('egrs').select('*').order('fecha_vencimiento')
  if (!data?.length) { toast('Sin datos para exportar', true); return }
  const rows = data.map(m => [m.entidad || '', m.nro_comprobante || '', m.concepto || '', fmtDate(m.fecha_vencimiento), fmtNum(m.importe), m.abonado ? 'Abonado' : 'Pendiente'])
  exportPDF('EGRs / No Proveedores', `Reporte al ${new Date().toLocaleDateString('es-AR')}`, ['Entidad', 'Comprobante', 'Concepto', 'Vto.', 'Importe', 'Estado'], rows, `Compass_EGRs_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}`)
}
