import './style.css'
import { supabase, assertSupabase } from './lib/supabase.js'
import { resolveRole } from './lib/auth.js'
import { renderLogin, renderNoAccess } from './pages/login.js'
import { renderLayout, navigateTo } from './pages/layout.js'

async function init() {
  assertSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    renderLogin()
    return
  }

  const email = session.user.email
  const roleInfo = await resolveRole(email)

  if (!roleInfo) {
    renderNoAccess(email)
    return
  }

  renderLayout(session.user, roleInfo)

  // Load default page
  const main = document.getElementById('main-content')
  const { renderReviews } = await import('./pages/reviews.js')
  renderReviews(main, session.user, roleInfo)

  // Handle auth state changes (logout / new login)
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      renderLogin()
    }
  })
}

init()
