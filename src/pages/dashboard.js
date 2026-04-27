import { supabase } from '../lib/supabase.js'
import { getAccessibleStoreNames } from '../lib/auth.js'
import { navigateTo } from './layout.js'

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
    container.querySelector('.page-content').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>載入失敗：${error.message}</p></div>`
    return
  }

  const total       = reviews.length
  const unprocessed = reviews.filter(r => r.process_status === '未處理').length
  const replied     = reviews.filter(r => r.process_status === '已回覆').length

  const ratedReviews = reviews.filter(r => STAR_MAP[r.star_rating])
  const avgRating = ratedReviews.length
    ? (ratedReviews.reduce((s, r) => s + STAR_MAP[r.star_rating], 0) / ratedReviews.length).toFixed(2)
    : '—'

  // 各門店統計
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

  const sortedStores = Object.entries(byStore)
    .sort((a, b) => b[1].unprocessed - a[1].unprocessed || b[1].total - a[1].total)

  const storeRows = sortedStores.map(([name, s]) => {
    const avg = s.count ? (s.sum / s.count).toFixed(2) : '—'
    const stars = s.count ? starBar(s.sum / s.count) : ''
    return `
      <tr class="store-row" data-store="${esc(name)}" title="點擊查看 ${esc(name)} 的評論">
        <td>
          <span class="store-name-link">
            <span class="store-name-text">${esc(name)}</span>
            <span class="store-arrow">›</span>
          </span>
        </td>
        <td><strong>${s.total}</strong></td>
        <td>
          <span class="rating-cell">
            <span class="rating-num ${ratingClass(s.count ? s.sum / s.count : 0)}">${avg}</span>
            ${stars}
          </span>
        </td>
        <td>
          ${s.unprocessed > 0
            ? `<span class="badge badge-unprocessed">⚠ ${s.unprocessed} 筆待處理</span>`
            : `<span class="badge badge-replied">✓ 全部處理</span>`}
        </td>
      </tr>
    `
  }).join('')

  container.querySelector('.page-content').innerHTML = `
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
      <div class="table-info">
        <span>各門店統計 <span style="color:var(--gray-400);font-size:12px">（點擊門店名稱可查看評論）</span></span>
        <span>${sortedStores.length} 間門店</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>門店名稱</th>
            <th>評論數</th>
            <th>平均星級</th>
            <th>處理狀態</th>
          </tr>
        </thead>
        <tbody>
          ${storeRows || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--gray-400)">無資料</td></tr>'}
        </tbody>
      </table>
    </div>
  `

  // 點擊門店列 → 跳轉評論頁並自動篩選該門店
  container.querySelectorAll('.store-row').forEach(row => {
    row.addEventListener('click', () => {
      const storeName = row.dataset.store

      // 更新側欄 active 狀態
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
      document.querySelector('.nav-item[data-page="reviews"]')?.classList.add('active')

      navigateTo('reviews', user, roleInfo, { filterStore: storeName })
    })
  })
}

function ratingClass(avg) {
  if (avg >= 4) return 'rating-high'
  if (avg >= 3) return 'rating-mid'
  return 'rating-low'
}

function starBar(avg) {
  const full  = Math.floor(avg)
  const half  = avg - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return `<span class="stars-sm">${'★'.repeat(full)}${'½'.repeat(half)}${'☆'.repeat(empty)}</span>`
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
