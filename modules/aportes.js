import { supabase } from '../supabase.js'
import { fmt, fmtDate, fmtNum, today, MONTHS, MONTHS_FULL, canEdit, isAdmin, toast, openModal, closeModal, exportExcel, exportPDF } from '../utils.js'

let currentMonth = new Date().getMonth()
let currentYear = new Date().getFullYear()
let currentRole = 'reader'

export async function renderAportes(role) {
  currentRole = role
  const cont = document.getElementById('view-aportes')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Aportes de Socios</div><div class="section-desc">Registro de aportes de capital</div></div>
      <div class="btn-row">
        ${canEdit(role) ? `<button class="btn btn-teal" id="btn-new-aporte"><i class="ti ti-plus"></i> Nuevo aporte</button>` : ''}
        <button class="btn btn-excel btn-sm" id="aporte-exp-excel"><i class="ti ti-file-spreadsheet"></i> Excel</button>
        <button class="btn btn-pdf btn-sm" id="aporte-exp-pdf"><i class="ti ti-file-type-pdf"></i> PDF</button>
      </div>
    </div>
    <div id="aportes-content"></div>`

  document.getElementById('btn-new-aporte')?.addEventListener('click', () => openAporteModal())
  document.getElementById('aporte-exp-excel').addEventListener('click', exportAportesExcel)
  document.getElementById('aporte-exp-pdf').addEventListener('click', exportAportesPDF)
  await renderContent()
}

async function renderContent() {
  const cont = document.getElementById('aportes-content')
  cont.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`

  const { data } = await supabase
    .from('aportes_socios')
    .select('*')
    .eq('mes', currentMonth)
    .eq('anio', currentYear)
    .order('fecha', { ascending: true })

  const list = data || []
  const total = list.reduce((a, b) => a + (+b.importe || 0), 0)

  cont.innerHTML = `
    <div class="month-bar">
      <button class="arrow-btn" id="prev-month">‹</button>
      ${MONTHS.map((m, i) => `<button class="month-btn ${i === currentMonth ? 'active' : ''}" data-m="${i}">${m}</button>`).join('')}
      <button class="arrow-btn" id="next-month">›</button>
      <span class="year-label">${currentYear}</span>
    </div>
    <div class="metric-card teal" style="max-width:300px;margin-bottom:16px">
      <div class="metric-label">Total Aportes — ${MONTHS_FULL[currentMonth]} ${currentYear}</div>
      <div class="metric-value pos">${fmt(total)}</div>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Socio</th><th>Concepto</th><th>Divisa</th><th>Importe</th>${canEdit(currentRole) ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.length ? list.map(a => `<tr>
        <td>${fmtDate(a.fecha)}</td>
        <td style="font-weight:500">${a.socio || '—'}</td>
        <td>${a.concepto || 'Aporte de Capital'}</td>
        <td><span class="tag tag-gray">${a.divisa || 'ARS'}</span></td>
        <td style="font-weight:700;color:var(--teal-dark)">${fmt(a.importe, a.divisa)}</td>
        ${canEdit(currentRole) ? `<td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm edit-aporte" data-id="${a.id}"><i class="ti ti-pencil"></i></button>
          <button class="btn btn-danger btn-sm delete-aporte" data-id="${a.id}"><i class="ti ti-trash"></i></button>
        </td>` : ''}
      </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">Sin aportes este período</td></tr>`}
      </tbody>
    </table></div></div>`

  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear-- }; renderContent()
  })
  document.getElementById('next-month')?.addEventListener('click', () => {
    currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++ }; renderContent()
  })
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', () => { currentMonth = parseInt(btn.dataset.m); renderContent() })
  })
  document.querySelectorAll('.edit-aporte').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = list.find(a => a.id === btn.dataset.id)
      if (item) openAporteModal(item)
    })
  })
  document.querySelectorAll('.delete-aporte').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este aporte?')) return
      const { error } = await supabase.from('aportes_socios').delete().eq('id', btn.dataset.id)
      if (error) { toast('Error al eliminar', true); return }
      toast('Eliminado ✓'); renderContent()
    })
  })
}

function openAporteModal(item = null) {
  const isEdit = !!item
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Aporte de Socio' : 'Nuevo Aporte de Socio'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Fecha Transferencia</label><input type="date" id="ap-fecha" value="${item?.fecha || today()}"></div>
      <div class="form-field"><label>Socio</label><input type="text" id="ap-socio" placeholder="Nombre del socio" value="${item?.socio || ''}"></div>
      <div class="form-field"><label>Divisa</label><select id="ap-divisa">
        <option value="ARS" ${item?.divisa === 'ARS' ? 'selected' : ''}>$ Pesos</option>
        <option value="USD" ${item?.divisa === 'USD' ? 'selected' : ''}>U$S Dólares</option>
      </select></div>
      <div class="form-field"><label>Importe</label><input type="number" id="ap-importe" placeholder="0.00" step="0.01" min="0" value="${item?.importe ?? ''}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-aporte-btn"><i class="ti ti-check"></i> Guardar</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-aporte-btn').addEventListener('click', async () => {
    const fecha = document.getElementById('ap-fecha').value
    const socio = document.getElementById('ap-socio').value
    const importe = parseFloat(document.getElementById('ap-importe').value) || 0
    if (!fecha || !socio || !importe) { toast('Completá todos los campos', true); return }
    const d = new Date(fecha)
    const payload = {
      fecha, socio, divisa: document.getElementById('ap-divisa').value,
      importe, concepto: 'Aporte de Capital',
      mes: d.getMonth(), anio: d.getFullYear()
    }
    const { error } = isEdit
      ? await supabase.from('aportes_socios').update(payload).eq('id', item.id)
      : await supabase.from('aportes_socios').insert(payload)
    if (error) { toast('Error al guardar', true); return }
    closeModal(); toast(isEdit ? 'Aporte actualizado ✓' : 'Aporte registrado ✓'); renderContent()
  })
}

async function exportAportesExcel() {
  const { data } = await supabase.from('aportes_socios').select('*').eq('mes', currentMonth).eq('anio', currentYear)
  if (!data?.length) { toast('Sin aportes este período', true); return }
  const rows = data.map(a => [fmtDate(a.fecha), a.socio || '', 'Aporte de Capital', a.divisa || 'ARS', fmtNum(a.importe)])
  exportExcel('Aportes', ['Fecha', 'Socio', 'Concepto', 'Divisa', 'Importe'], rows, `Compass_Aportes_${MONTHS_FULL[currentMonth]}${currentYear}`)
}
async function exportAportesPDF() {
  const { data } = await supabase.from('aportes_socios').select('*').eq('mes', currentMonth).eq('anio', currentYear)
  if (!data?.length) { toast('Sin aportes este período', true); return }
  const rows = data.map(a => [fmtDate(a.fecha), a.socio || '', 'Aporte de Capital', a.divisa || 'ARS', fmtNum(a.importe)])
  exportPDF('Aportes de Socios', `${MONTHS_FULL[currentMonth]} ${currentYear}`, ['Fecha', 'Socio', 'Concepto', 'Divisa', 'Importe'], rows, `Compass_Aportes_${MONTHS_FULL[currentMonth]}${currentYear}`)
}
