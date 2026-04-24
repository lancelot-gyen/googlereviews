import { supabase } from '../lib/supabase.js'
import { getAccessibleStoreNames } from '../lib/auth.js'

const STAR_MAP = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }

export async function renderDashboard(container, user, roleInfo) {
  container.innerHTML = `
    <div class="page-header"><h2>📊 數據總覽</h2></div>
    <div class="page-content">
      <div class="loading"><div class="spinner"></div> 計算中…</div>
    </div>
  `

  const storeNames = await getAccessibleStoreNames(roleInfo)

  const { data: reviews, error } = await supabase
    .from('google_reviews')
    .select('star_rating, process_status, branch_name')
    .in('branch_name', storeNames)

  if (error) {
    document.querySelector('.page-content').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>載入失敗：${error.message}</p></div>`
    return
  }

  const total = reviews.length
  const unprocessed = reviews.filter(r => r.process_status === '未處理').length
  const replied = reviews.filter(r => r.process_status === '已回覆').length

  const ratedReviews = reviews.filter(r => STAR_MAP[r.star_rating])
  const avgRating = ratedReviews.length
    ? (ratedReviews.reduce((s, r) => s + STAR_MAP[r.star_rating], 0) / ratedReviews.length).toFixed(2)
    : '—'

  // Per-store summary
  const byStore = {}
  for (const r of reviews) {
    if (!byStore[r.branch_name]) byStore[r.branch_name] = { total: 0, sum: 0, count: 0, unprocessed: 0 }
    byStore[r.branch_name].total++
    if (r.process_status === '未處理') byStore[r.branch_name].unprocessed++
    if (STAR_MAP[r.star_rating]) {
      byStore[r.branch_name].sum += STAR_MAP[r.star_rating]
      byStore[r.branch_name].count++
    }
  }

  const storeRows = Object.entries(byStore)
    .sort((a, b) => b[1].unprocessed - a[1].unprocessed)
    .map(([name, s]) => `
      <tr>
        <td>${esc(name)}</td>
        <td>${s.total}</td>
        <td>${s.count ? (s.sum / s.count).toFixed(2) : '—'}</td>
        <td>${s.unprocessed > 0 ? `<span class="badge badge-unprocessed">${s.unprocessed}</span>` : '0'}</td>
      </tr>
    `).join('')

  document.querySelector('.page-content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="icon-circle">📋</div>
        <div class="label">📋 評論總數</div>
        <div class="value">${total}</div>
        <div class="sub">可存取門店</div>
      </div>
      <div class="stat-card danger">
        <div class="icon-circle">⚠️</div>
        <div class="label">⚠️ 未處理</div>
        <div class="value" style="color:var(--danger)">${unprocessed}</div>
        <div class="sub">需要處理</div>
      </div>
      <div class="stat-card success">
        <div class="icon-circle">✅</div>
        <div class="label">✅ 已回覆</div>
        <div class="value" style="color:var(--success)">${replied}</div>
        <div class="sub">回覆完成</div>
      </div>
      <div class="stat-card accent">
        <div class="icon-circle">⭐</div>
        <div class="label">⭐ 平均星級</div>
        <div class="value">${avgRating}</div>
        <div class="sub">滿分 5.00 分</div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-info"><span>各門店統計</span></div>
      <table>
        <thead>
          <tr>
            <th>門店名稱</th>
            <th>評論數</th>
            <th>平均星級</th>
            <th>未處理</th>
          </tr>
        </thead>
        <tbody>
          ${storeRows || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--gray-400)">無資料</td></tr>'}
        </tbody>
      </table>
    </div>
  `
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
