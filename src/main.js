import './style.css'
import { supabase, assertSupabase } from './lib/supabase.js'
import { resolveRole } from './lib/auth.js'
import { DEV_MODE, getDevSession, devSignOut } from './lib/devAuth.js'
import { renderLogin, renderNoAccess } from './pages/login.js'
import { renderLayout, navigateTo } from './pages/layout.js'

async function init() {
  assertSupabase()

  let session = null

  if (DEV_MODE) {
    // ── 開發模式：從 localStorage 讀取假 session ──
    session = getDevSession()
  } else {
    // ── 正式模式：從 Supabase 讀取 Google OAuth session ──
    const { data } = await supabase.auth.getSession()
    session = data.session
  }

  if (!session) {
    renderLogin()
    return
  }

  const email = session.user.email
  const roleInfo = await resolveRole(email)

  if (!roleInfo) {
    renderNoAccess(email, () => {
      if (DEV_MODE) { devSignOut(); location.reload() }
      else supabase.auth.signOut().then(() => location.reload())
    })
    return
  }

  renderLayout(session.user, roleInfo)

  // 預設顯示評論列表
  const main = document.getElementById('main-content')
  const { renderReviews } = await import('./pages/reviews.js')
  renderReviews(main, session.user, roleInfo)

  // 正式模式：監聽 auth 狀態變化
  if (!DEV_MODE) {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') renderLogin()
    })
  }
}

init()
