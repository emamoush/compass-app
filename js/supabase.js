import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://zzcqqnofclgutqjqbung.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6Y3Fxbm9mY2xndXRxanFidW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODU5MTcsImV4cCI6MjA5NzE2MTkxN30.v9HjGLr7STR7kKjAo0Cuqzd2P5QHwKXQ9MKJcGw2FN0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── AUTH HELPERS ──
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

// Get user role from profiles table — con debug visual
export async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .single()

  // DEBUG: mostrar resultado en pantalla
  const msg = `getUserRole(${userId.slice(0,8)}...)\ndata: ${JSON.stringify(data)}\nerror: ${JSON.stringify(error)}`
  let dbg = document.getElementById('__debug')
  if (!dbg) {
    dbg = document.createElement('div')
    dbg.id = '__debug'
    dbg.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#1a1a2e;color:#00C2A0;padding:12px 16px;border-radius:8px;font-size:11px;font-family:monospace;z-index:99999;max-width:400px;white-space:pre-wrap;border:1px solid #00C2A0'
    document.body.appendChild(dbg)
  }
  dbg.textContent = msg

  if (error) return null
  return data
}

// Auth state listener
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
