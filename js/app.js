import { supabase, signIn, signOut, getUserRole } from './supabase.js'
import { toast, ROLE_LABELS } from './utils.js'
import { renderDashboard } from './modules/dashboard.js'
import { renderTesoreria } from './modules/tesoreria.js'
import { renderClientes } from './modules/clientes.js'
import { renderProveedores } from './modules/proveedores.js'
import { renderEgresos } from './modules/egresos.js'
import { renderBalance } from './modules/balance.js'
import { renderAportes } from './modules/aportes.js'
import { renderUsuarios } from './modules/usuarios.js'

// ── GLOBAL STATE ──
export let currentUser = null
export let currentRole = null

// ── INIT: verificar sesión existente al cargar ──
async function checkSession() {
  console.log('Checking existing session...')
  const { data: { session } } = await supabase.auth.getSession()
  console.log('Session:', session?.user?.email || 'none')
  if (session) {
    await loadUserAndInit(session)
  } else {
    showLogin()
  }
}

async function loadUserAndInit(session) {
  try {
    console.log('Loading profile for:', session.user.id)
    const profile = await getUserRole(session.user.id)
    console.log('Profile:', profile)
    currentUser = session.user
    currentRole = profile?.role || 'reader'
    console.log('Role:', currentRole)
    initApp(profile)
  } catch (e) {
    console.error('Error loading profile:', e)
    currentUser = session.user
    currentRole = 'reader'
    initApp(null)
  }
}

// ── LOGIN ──
document.getElementById('login-btn').addEventListener('click', handleLogin)
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hide')) handleLogin()
})

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-pass').value
  const btn = document.getElementById('login-btn')
  const err = document.getElementById('login-error')
  err.style.display = 'none'
  btn.disabled = true
  btn.textContent = 'Ingresando...'
  try {
    console.log('Signing in...')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    console.log('Sign in OK, loading session...')
    await loadUserAndInit(data.session)
  } catch (e) {
    console.error('Login error:', e)
    err.textContent = 'Correo o contraseña incorrectos.'
    err.style.display = 'block'
    btn.disabled = false
    btn.textContent = 'Ingresar'
  }
}

function initApp(profile) {
  try {
    console.log('Initializing app...')
    document.getElementById('login-screen').classList.add('hide')
    setTimeout(() => {
      document.getElementById('login-screen').style.display = 'none'
      document.getElementById('app').classList.add('visible')
    }, 400)

    const name = profile?.full_name || currentUser?.email || '?'
    document.getElementById('sidebar-avatar').textContent = name[0].toUpperCase()
    document.getElementById('sidebar-name').textContent = name
    document.getElementById('sidebar-role').textContent = ROLE_LABELS[currentRole] || currentRole
    document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('es-AR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

    const badge = document.getElementById('role-badge')
    badge.className = `badge-role badge-${currentRole}`
    badge.textContent = ROLE_LABELS[currentRole] || currentRole

    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = currentRole === 'admin' ? '' : 'none'
    })

    navigate('dashboard')
    console.log('App initialized OK')
  } catch (e) {
    console.error('Error in initApp:', e)
  }
}

function showLogin() {
  document.getElementById('app').classList.remove('visible')
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('login-screen').classList.remove('hide')
  document.getElementById('login-email').value = ''
  document.getElementById('login-pass').value = ''
  document.getElementById('login-error').style.display = 'none'
  document.getElementById('login-btn').disabled = false
  document.getElementById('login-btn').textContent = 'Ingresar'
}

// ── LOGOUT ──
document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabase.auth.signOut()
  showLogin()
})

// ── NAVIGATION ──
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  tesoreria: 'Tesorería',
  clientes: 'Clientes',
  proveedores: 'Proveedores',
  egresos: 'EGRs / No Proveedores',
  balance: 'Balance',
  aportes: 'Aportes de Socios',
  usuarios: 'Usuarios'
}

export function navigate(view) {
  try {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
    const target = document.getElementById('view-' + view)
    if (target) target.classList.add('active')
    document.querySelectorAll(`.nav-item[data-view="${view}"]`).forEach(n => n.classList.add('active'))
    document.getElementById('topbar-title').textContent = VIEW_TITLES[view] || view

    if (view === 'dashboard') renderDashboard(currentRole)
    else if (view === 'tesoreria') renderTesoreria(currentRole)
    else if (view === 'clientes') renderClientes(currentRole)
    else if (view === 'proveedores') renderProveedores(currentRole)
    else if (view === 'egresos') renderEgresos(currentRole)
    else if (view === 'balance') renderBalance(currentRole)
    else if (view === 'aportes') renderAportes(currentRole)
    else if (view === 'usuarios') renderUsuarios(currentRole)
  } catch (e) {
    console.error('Error navigating to', view, ':', e)
  }
}

// Nav click handlers
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.view))
})

// Modal
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('open')
  }
})
document.getElementById('modal-close-btn').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('open')
})

// ── ARRANCAR ──
window.navigate = navigate
checkSession()
