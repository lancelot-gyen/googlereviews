import { signInWithGoogle } from '../lib/auth.js'
import { DEV_MODE, devSignIn } from '../lib/devAuth.js'
import { toast } from '../lib/toast.js'

export function renderLogin() {
  if (DEV_MODE) {
    renderDevLogin()
  } else {
    renderGoogleLogin()
  }
}

// ── 開發模式：Email 輸入登入 ──────────────────────────────
function renderDevLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">🔥</div>
        <div class="login-brand-name">橘焱胡同集團</div>
        <h1>Google 評論管理系統</h1>

        <div class="dev-badge">
          <span class="dev-dot"></span> 開發測試模式
        </div>

        <p>請輸入帳號 Email 以模擬登入<br>
          <small>（此模式不需密碼，上線後將切換為 Google 登入）</small>
        </p>

        <div class="form-group" style="text-align:left;margin-bottom:12px;">
          <label class="form-label" for="dev-email">帳號 Email</label>
          <input
            id="dev-email"
            class="form-input"
            type="text"
            placeholder="請輸入 Email，例如：lancelot@gyen.com.tw"
            autocomplete="email"
            autofocus
          />
        </div>

        <button class="btn btn-primary btn-lg" id="btn-dev-login" style="width:100%;justify-content:center;margin-bottom:8px;">
          🔑 進入系統
        </button>

        <div class="login-footer">
          僅限授權帳號使用 · 橘焱胡同集團
        </div>
      </div>
    </div>
  `

  const emailInput = document.getElementById('dev-email')
  const loginBtn   = document.getElementById('btn-dev-login')

  const doLogin = () => {
    try {
      devSignIn(emailInput.value)
      location.reload()
    } catch (err) {
      toast(err.message, 'error')
      emailInput.focus()
    }
  }

  loginBtn.addEventListener('click', doLogin)
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin()
  })
}

// ── 正式模式：Google OAuth 登入 ──────────────────────────
function renderGoogleLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">🔥</div>
        <div class="login-brand-name">橘焱胡同集團</div>
        <h1>Google 評論管理系統</h1>
        <p>請使用公司 Google 帳號登入<br>以進入評論管理後台</p>
        <div class="login-divider">安全登入</div>
        <button class="btn-google" id="btn-google-login">
          <img src="https://www.google.com/favicon.ico" alt="Google" />
          使用 Google 帳號登入
        </button>
        <div class="login-footer">
          僅限授權帳號使用 · 橘焱胡同集團
        </div>
      </div>
    </div>
  `

  document.getElementById('btn-google-login').addEventListener('click', async () => {
    try {
      await signInWithGoogle()
    } catch (err) {
      toast('登入失敗：' + err.message, 'error')
    }
  })
}

// ── 無權限畫面 ────────────────────────────────────────────
export function renderNoAccess(email, onLogout) {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="no-access">
          <div class="icon">🔒</div>
          <h3>無存取權限</h3>
          <p>帳號 <strong>${esc(email)}</strong> 尚未被授權，<br>請聯繫系統管理員開通權限。</p>
        </div>
        <button class="btn btn-secondary" id="btn-logout" style="margin-top:24px;width:100%;justify-content:center;">
          ⏻ 登出並返回
        </button>
        <div class="login-footer">
          橘焱胡同集團 · Google 評論管理系統
        </div>
      </div>
    </div>
  `

  const handler = onLogout || (async () => {
    const { signOut } = await import('../lib/auth.js')
    await signOut()
    location.reload()
  })
  document.getElementById('btn-logout').addEventListener('click', handler)
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
