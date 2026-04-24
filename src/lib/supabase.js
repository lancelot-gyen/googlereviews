import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key)
  ? createClient(url, key)
  : null

export function assertSupabase() {
  if (!supabase) {
    document.getElementById('app').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f9fa">
        <div style="background:white;border-radius:12px;padding:40px;max-width:480px;box-shadow:0 4px 20px rgba(0,0,0,.1);text-align:center">
          <div style="font-size:48px;margin-bottom:16px">⚙️</div>
          <h2 style="font-size:20px;margin-bottom:12px;color:#202124">尚未設定環境變數</h2>
          <p style="color:#5f6368;margin-bottom:20px;line-height:1.6">
            請在專案根目錄建立 <code>.env</code> 檔案，並填入 Supabase 連線資訊：
          </p>
          <pre style="background:#f1f3f4;padding:16px;border-radius:8px;text-align:left;font-size:12px;overflow:auto">
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
          </pre>
        </div>
      </div>
    `
    throw new Error('Supabase not configured')
  }
}
