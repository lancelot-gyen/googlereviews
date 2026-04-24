import { signInWithGoogle } from '../lib/auth.js'
import { toast } from '../lib/toast.js'

export function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">⭐</div>
        <h1>Google 評論管理系統</h1>
        <p>請使用公司 Google 帳號登入以繼續</p>
        <button class="btn-google" id="btn-google-login">
          <img src="https://www.google.com/favicon.ico" alt="Google" />
          使用 Google 帳號登入
        </button>
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

export function renderNoAccess(email) {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="no-access">
          <div class="icon">🚫</div>
          <h3>無存取權限</h3>
          <p>帳號 <strong>${email}</strong> 尚未被授權，<br>請聯繫管理員開通權限。</p>
        </div>
        <button class="btn btn-secondary" id="btn-logout" style="margin-top:24px;width:100%;justify-content:center;">
          登出
        </button>
      </div>
    </div>
  `

  document.getElementById('btn-logout').addEventListener('click', async () => {
    const { signOut } = await import('../lib/auth.js')
    await signOut()
    location.reload()
  })
}
