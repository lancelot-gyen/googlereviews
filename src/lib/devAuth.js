// ============================================================
// 開發模式登入（Dev Auth）
// 不走 Google OAuth，以輸入 Email 方式模擬登入
// 上線後將 DEV_MODE 改為 false 即可還原 Google 登入
// ============================================================

export const DEV_MODE = true

const DEV_SESSION_KEY = 'dev_session_email'

/** 取得開發模式的假 session（格式相容 Supabase session） */
export function getDevSession() {
  const email = localStorage.getItem(DEV_SESSION_KEY)
  if (!email) return null
  return {
    user: {
      id: 'dev-user-' + btoa(email),
      email,
      user_metadata: {
        full_name: email.split('@')[0],
        avatar_url: null,
      },
    },
  }
}

/** 開發模式登入：儲存 email 到 localStorage */
export function devSignIn(email) {
  if (!email || !email.includes('@')) {
    throw new Error('請輸入有效的 Email 地址')
  }
  localStorage.setItem(DEV_SESSION_KEY, email.trim().toLowerCase())
}

/** 開發模式登出：清除 localStorage */
export function devSignOut() {
  localStorage.removeItem(DEV_SESSION_KEY)
}
