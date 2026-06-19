import { supabase } from '../supabase.js'
import { toast, ROLE_LABELS, openModal, closeModal } from '../utils.js'

export async function renderUsuarios(role) {
  if (role !== 'admin') {
    document.getElementById('view-usuarios').innerHTML = `<div class="empty"><div class="empty-icon">🔒</div><div class="empty-text">Acceso restringido a administradores</div></div>`
    return
  }

  const cont = document.getElementById('view-usuarios')
  cont.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Usuarios</div><div class="section-desc">Gestión de accesos y roles del sistema</div></div>
      <button class="btn btn-teal" id="btn-new-user"><i class="ti ti-user-plus"></i> Crear usuario</button>
    </div>
    <div id="users-content"><div class="loading"><div class="spinner"></div> Cargando...</div></div>`

  document.getElementById('btn-new-user').addEventListener('click', () => openUserModal())
  await loadUsers()
}

async function loadUsers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  const cont = document.getElementById('users-content')
  const list = data || []

  cont.innerHTML = `
    <div class="card">
      <div class="card-title">Usuarios registrados</div>
      <div class="card-sub">Los usuarios con rol Lector solo pueden ver información. Los Operadores pueden cargar y editar. El Administrador tiene acceso total.</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nombre</th><th>Rol</th><th>Creado</th></tr></thead>
        <tbody>${list.length ? list.map(u => `<tr>
          <td style="font-weight:500">${u.full_name || '—'}</td>
          <td><span class="badge-role badge-${u.role}" style="display:inline-block">${ROLE_LABELS[u.role] || u.role}</span></td>
          <td style="color:var(--text2);font-size:12px">${new Date(u.created_at).toLocaleDateString('es-AR')}</td>
        </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:24px">Sin usuarios</td></tr>`}
        </tbody>
      </table></div>
    </div>
    <div class="card" style="background:var(--amber-light);border-color:var(--amber)">
      <div class="card-title" style="color:#92400e"><i class="ti ti-info-circle"></i> Importante</div>
      <p style="font-size:13px;color:#78350f;line-height:1.7">
        Para crear un usuario nuevo, ingresá su email y nombre. El sistema le enviará un correo de confirmación. 
        Podés asignarle el rol directamente desde aquí.<br><br>
        Para cambiar la contraseña de un usuario, debés hacerlo desde el panel de Supabase → Authentication → Users.
      </p>
    </div>`
}

function openUserModal() {
  document.getElementById('modal-title').textContent = 'Crear Nuevo Usuario'
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid">
      <div class="form-field"><label>Nombre completo</label><input type="text" id="nu-nombre" placeholder="Nombre y apellido"></div>
      <div class="form-field"><label>Email</label><input type="email" id="nu-email" placeholder="correo@empresa.com"></div>
      <div class="form-field"><label>Contraseña temporal</label><input type="password" id="nu-pass" placeholder="Mínimo 6 caracteres"></div>
      <div class="form-field"><label>Rol</label>
        <select id="nu-rol">
          <option value="operator">Operador</option>
          <option value="reader">Lector (Estudio Contable)</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-teal" id="save-user-btn"><i class="ti ti-check"></i> Crear usuario</button>
      <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancelar</button>
    </div>`
  openModal()
  document.getElementById('save-user-btn').addEventListener('click', async () => {
    const nombre = document.getElementById('nu-nombre').value
    const email = document.getElementById('nu-email').value
    const pass = document.getElementById('nu-pass').value
    const rol = document.getElementById('nu-rol').value
    if (!nombre || !email || !pass) { toast('Completá todos los campos', true); return }
    if (pass.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', true); return }

    const { data, error } = await supabase.auth.admin.createUser({
      email, password: pass,
      user_metadata: { full_name: nombre, role: rol },
      email_confirm: true
    })
    if (error) {
      // Fallback: sign up normal (sin admin API en frontend)
      const { error: e2 } = await supabase.auth.signUp({
        email, password: pass,
        options: { data: { full_name: nombre, role: rol } }
      })
      if (e2) { toast('Error: ' + e2.message, true); return }
    }
    closeModal()
    toast('Usuario creado ✓ — El usuario puede ingresar con su email y contraseña')
    await loadUsers()
  })
}
