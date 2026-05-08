import { supabase } from '../lib/supabase.js'
import { getAccessibleStoreNames } from '../lib/auth.js'
import { navigateTo } from './layout.js'

const STAR_MAP = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }

export async function renderDashboard(container, user, roleInfo) {
  container.innerHTML = `
    <div class="page-header"><h2>📊 數據總覽</h2></div>
    <div class="page-content">
      <div class="loading"><div class="spinner"></div> 載入中…</div>
    </div>
  `

  const allStoreNames = await getAccessibleStoreNames(roleInfo)
  const uniqueStores  = allStoreNames.slice().sort()

  // 預設日期：近 30 天
  const today    = new Date()
  const d30ago   = new Date(today); d30ago.setDate(today.getDate() - 30)
  const fmtInput = d => d.toISOString().slice(0, 10)

  let filters = { store: '', dateFrom: fmtInput(d30ago), dateTo: fmtInput(today) }

  // ── 渲染外框（filter bar + 資料區）──
  container.querySelector('.page-content').innerHTML = `
    <div class="filter-bar">
      ${uniqueStores.length > 1 ? `
      <div class="filter-group">
        <label>門店</label>
        <select class="form-control" id="d-store" style="min-width:200px">
          <option value="">全部門店</option>
          ${uniqueStores.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="filter-group">
        <label>評論日期（起）</label>
        <input type="date" class="form-control" id="d-from" value="${filters.dateFrom}" />
      </div>
      <div class="filter-group">
        <label>評論日期（迄）</label>
        <input type="date" class="form-control" id="d-to" value="${filters.dateTo}" />
      </div>
      <button class="btn btn-primary" id="btn-d-search">套用</button>
      <button class="btn btn-secondary" id="btn-d-reset">重置</button>
    </div>
    <div id="dashboard-body">
      <div class="loading"><div class="spinner"></div> 計算中…</div>
    </div>
  `

  const doLoad = () => loadDashboard(allStoreNames, filters, container, user, roleInfo)

  document.getElementById('btn-d-search').addEventListener('click', () => {
    filters.store    = document.getElementById('d-store')?.value ?? ''
    filters.dateFrom = document.getElementById('d-from').value
    filters.dateTo   = document.getElementById('d-to').value
    doLoad()
  })

  document.getElementById('btn-d-reset').addEventListener('click', () => {
    filters = { store: '', dateFrom: fmtInput(d30ago), dateTo: fmtInput(today) }
    if (document.getElementById('d-store')) document.getElementById('d-store').value = ''
    document.getElementById('d-from').value = filters.dateFrom
    document.getElementById('d-to').value   = filters.dateTo
    doLoad()
  })

  // Enter 鍵也可觸發
  ;['d-from', 'd-to'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', () => {
      filters.store    = document.getElementById('d-store')?.value ?? ''
      filters.dateFrom = document.getElementById('d-from').value
      filters.dateTo   = document.getElementById('d-to').value
      doLoad()
    })
  )

  doLoad()
}

async function loadDashboard(allStoreNames, filters, container, user, roleInfo) {
  const body = document.getElementById('dashboard-body')
  body.innerHTML = '<div class="loading"><div class="spinner"></div> 計算中…</div>'

  // 決定查詢的門店範圍
  const targetStores = filters.store ? [filters.store] : allStoreNames

  // 日期轉換（dateTo 包含當天整天）
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00').toISOString() : null
  const dateTo   = filters.dateTo   ? new Date(filters.dateTo   + 'T23:59:59').toISOString() : null

  let query = supabase
    .from('google_reviews')
    .select('star_rating, process_status, branch_name, review_time')
    .in('branch_name', targetStores)

  if (dateFrom) query = query.gte('review_time', dateFrom)
  if (dateTo)   query = query.lte('review_time', dateTo)

  const { data: reviews, error } = await query

  if (error) {
    body.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>載入失敗：${error.message}</p></div>`
    return
  }

  // ── 統計卡片 ──
  const total       = reviews.length
  const unprocessed = reviews.filter(r => r.process_status === '未處理').length
  const replied     = reviews.filter(r => r.process_status === '已回覆').length

  const ratedReviews = reviews.filter(r => STAR_MAP[r.star_rating])
  const avgRating = ratedReviews.length
    ? (ratedReviews.reduce((s, r) => s + STAR_MAP[r.star_rating], 0) / ratedReviews.length).toFixed(2)
    : '—'

  // ── 各門店統計 ──
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
    const avg   = s.count ? (s.sum / s.count).toFixed(2) : '—'
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

  // ── 篩選條件說明文字 ──
  const filterDesc = [
    filters.store    ? `門店：${filters.store}` : '全部門店',
    filters.dateFrom ? `${filters.dateFrom}` : '',
    filters.dateTo   ? `～ ${filters.dateTo}` : '',
  ].filter(Boolean).join('　')

  body.innerHTML = `
    <div class="dashboard-filter-desc">
      📅 ${filterDesc}
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="icon-circle">📋</div>
        <div class="label">📋 評論總數</div>
        <div class="value">${total}</div>
        <div class="sub">${filters.store || '全部門店'}</div>
      </div>
      <div class="stat-card danger">
        <div class="icon-circle">⚠️</div>
        <div class="label">⚠️ 未處理</div>
        <div class="value" style="color:var(--danger)">${unprocessed}</div>
        <div class="sub">待處理（${total ? ((unprocessed/total)*100).toFixed(0) : 0}%）</div>
      </div>
      <div class="stat-card success">
        <div class="icon-circle">✅</div>
        <div class="label">✅ 已回覆</div>
        <div class="value" style="color:var(--success)">${replied}</div>
        <div class="sub">回覆率 ${total ? ((replied/total)*100).toFixed(0) : 0}%</div>
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
        <span>${sortedStores.length} 間門店・共 ${total} 筆</span>
      </div>
      ${total === 0 ? `
        <div class="empty-state"><div class="icon">📭</div><p>此條件下沒有評論資料</p></div>
      ` : `
      <table>
        <thead>
          <tr>
            <th>門店名稱</th>
            <th>評論數</th>
            <th>平均星級</th>
            <th>處理狀態</th>
          </tr>
        </thead>
        <tbody>${storeRows}</tbody>
      </table>
      `}
    </div>
  `

  // 點擊門店列 → 跳轉評論頁
  body.querySelectorAll('.store-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
      document.querySelector('.nav-item[data-page="reviews"]')?.classList.add('active')
      navigateTo('reviews', user, roleInfo, { filterStore: row.dataset.store })
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
