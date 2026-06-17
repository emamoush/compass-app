// ── FORMAT HELPERS ──
export const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const ROLE_LABELS = { admin: 'Administrador', operator: 'Operador', reader: 'Lector' }
export const CATEGORIAS_BANCARIAS = ['General','Imp. Ley 25.413','Sircreb','Comisión Transferencia','Gastos Bancarios','Mantenimiento de Cuenta','Imp. Comex','Comisión Cheque']
export const MEDIOS_PAGO = ['Transferencia Macro CC $','E-cheq','Comex','Tarjeta de Crédito']

export function fmt(n, divisa = 'ARS') {
  const curr = divisa === 'USD' ? 'U$S ' : '$ '
  if (n === undefined || n === null || isNaN(n)) return curr + '0,00'
  return curr + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00').toLocaleDateString('es-AR')
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function currentMes() { return new Date().getMonth() }
export function currentAnio() { return new Date().getFullYear() }

// ── TOAST ──
export function toast(msg, isError = false) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = isError ? 'error' : ''
  t.style.opacity = '1'
  t.style.transform = 'translateY(0)'
  clearTimeout(t._t)
  t._t = setTimeout(() => {
    t.style.opacity = '0'
    t.style.transform = 'translateY(10px)'
  }, 3000)
}

// ── MODAL ──
export function openModal() { document.getElementById('modal-overlay').classList.add('open') }
export function closeModal() { document.getElementById('modal-overlay').classList.remove('open') }

// ── LOADING ──
export function loading(container) {
  document.getElementById(container).innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`
}

// ── MONTH BAR HTML ──
export function monthBarHTML(currentMonth, currentYear, onMonthChange) {
  return `
    <div class="month-bar">
      <button class="arrow-btn" onclick="${onMonthChange}(-1)">‹</button>
      ${MONTHS.map((m, i) => `<button class="month-btn ${i === currentMonth ? 'active' : ''}" onclick="${onMonthChange}Month(${i})">${m}</button>`).join('')}
      <button class="arrow-btn" onclick="${onMonthChange}(1)">›</button>
      <span class="year-label">${currentYear}</span>
    </div>`
}

// ── EXPORT EXCEL ──
export function exportExcel(sheetName, headers, rows, filename) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = headers.map((_, i) => ({ wch: Math.max(headers[i].length, ...rows.map(r => String(r[i] || '').length), 12) }))
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename + '.xlsx')
  toast('Excel exportado ✓')
}

// ── EXPORT PDF ──
export function exportPDF(title, subtitle, headers, rows, filename) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' })
  doc.setFontSize(16); doc.setTextColor(15, 31, 61)
  doc.text('Compass — ' + title, 14, 18)
  doc.setFontSize(10); doc.setTextColor(91, 111, 138)
  doc.text(subtitle + '  ·  ' + new Date().toLocaleDateString('es-AR'), 14, 26)
  doc.autoTable({
    startY: 33, head: [headers], body: rows,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 31, 61], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    tableLineColor: [221, 227, 238], tableLineWidth: 0.3
  })
  doc.save(filename + '.pdf')
  toast('PDF exportado ✓')
}

// ── PERMISSIONS ──
export function canEdit(role) { return role === 'admin' || role === 'operator' }
export function isAdmin(role) { return role === 'admin' }
