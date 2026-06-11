import { signOut, ROLE_LABELS } from '../lib/auth.js'
import { DEV_MODE, devSignOut } from '../lib/devAuth.js'
import { toast } from '../lib/toast.js'

export function renderLayout(user, roleInfo) {
  const label = ROLE_LABELS[roleInfo.role] ?? roleInfo.role
  const initial = (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()
  const name = user.user_metadata?.full_name || user.email

  const isSuperAdmin = roleInfo.role === 'super_admin'

  document.getElementById('app').innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-brand">
            <span class="sidebar-logo-icon">🔥</span>
            <h1>評論管理系統</h1>
          </div>
          <span>橘焱胡同集團</span>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section">主選單</div>
          <div class="nav-item active" data-page="reviews">
            <span class="icon">📋</span> 評論列表
          </div>
          <div class="nav-item" data-page="dashboard">
            <span class="icon">📊</span> 數據總覽
          </div>
          ${isSuperAdmin ? `
          <div class="nav-section">系統管理</div>
          <div class="nav-item" data-page="admin">
            <span class="icon">⚙️</span> 資料管理
          </div>
          ` : ''}
        </nav>
        <div class="sidebar-user">
          <div class="user-avatar">${initial}</div>
          <div class="user-info">
            <div class="name">${name}</div>
            <div class="role">${label}</div>
          </div>
          <button class="btn-logout" id="btn-logout" title="登出">⏻</button>
        </div>
      </aside>
      <main class="main" id="main-content">
        <div class="loading"><div class="spinner"></div> 載入中…</div>
      </main>
    </div>
  `

  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (DEV_MODE) {
      devSignOut()
    } else {
      await signOut()
    }
    location.reload()
  })

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
      item.classList.add('active')
      navigateTo(item.dataset.page, user, roleInfo)
    })
  })
}

async function navigateTo(page, user, roleInfo, opts = {}) {
  const main = document.getElementById('main-content')
  main.innerHTML = '<div class="loading"><div class="spinner"></div> 載入中…</div>'

  if (page === 'reviews') {
    const { renderReviews } = await import('./reviews.js')
    renderReviews(main, user, roleInfo, opts)
  } else if (page === 'dashboard') {
    const { renderDashboard } = await import('./dashboard.js')
    renderDashboard(main, user, roleInfo)
  } else if (page === 'admin') {
    const { renderAdmin } = await import('./admin.js')
    renderAdmin(main, user, roleInfo)
  }
}

export { navigateTo }
