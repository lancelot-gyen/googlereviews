import { supabase } from '../lib/supabase.js'
import { getAccessibleStoreNames } from '../lib/auth.js'
import { toast } from '../lib/toast.js'

const PAGE_SIZE = 20

const STATUS_BADGE = {
  '未處理': 'badge-unprocessed',
  '處理中': 'badge-processing',
  '已回覆': 'badge-replied',
}

const STAR_MAP = {
  'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5,
}

function starsHtml(rating) {
  const n = STAR_MAP[rating] ?? parseInt(rating) ?? 0
  return '<span class="stars">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>'
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

export async function renderReviews(container, user, roleInfo) {
  const storeNames = await getAccessibleStoreNames(roleInfo)

  let currentPage = 1
  let filters = { store: '', star: '', status: '', search: '' }

  const uniqueStores = storeNames.slice().sort()

  container.innerHTML = `
    <div class="page-header">
      <h2>📋 評論列表</h2>
    </div>
    <div class="page-content">
      <div class="filter-bar">
        ${uniqueStores.length > 1 ? `
        <div class="filter-group">
          <label>門店</label>
          <select class="form-control" id="f-store">
            <option value="">全部門店</option>
            ${uniqueStores.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="filter-group">
          <label>星級</label>
          <select class="form-control" id="f-star">
            <option value="">全部</option>
            <option value="ONE">⭐ 1星</option>
            <option value="TWO">⭐⭐ 2星</option>
            <option value="THREE">⭐⭐⭐ 3星</option>
            <option value="FOUR">⭐⭐⭐⭐ 4星</option>
            <option value="FIVE">⭐⭐⭐⭐⭐ 5星</option>
          </select>
        </div>
        <div class="filter-group">
          <label>狀態</label>
          <select class="form-control" id="f-status">
            <option value="">全部</option>
            <option value="未處理">未處理</option>
            <option value="處理中">處理中</option>
            <option value="已回覆">已回覆</option>
          </select>
        </div>
        <div class="filter-group">
          <label>搜尋評論</label>
          <input class="form-control" id="f-search" placeholder="關鍵字…" style="min-width:180px" />
        </div>
        <button class="btn btn-primary" id="btn-search">搜尋</button>
        <button class="btn btn-secondary" id="btn-reset">重置</button>
      </div>

      <div id="reviews-table-wrap"></div>
    </div>
  `

  const doSearch = () => {
    filters.store = document.getElementById('f-store')?.value ?? ''
    filters.star = document.getElementById('f-star').value
    filters.status = document.getElementById('f-status').value
    filters.search = document.getElementById('f-search').value.trim()
    currentPage = 1
    loadReviews()
  }

  document.getElementById('btn-search').addEventListener('click', doSearch)
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (document.getElementById('f-store')) document.getElementById('f-store').value = ''
    document.getElementById('f-star').value = ''
    document.getElementById('f-status').value = ''
    document.getElementById('f-search').value = ''
    filters = { store: '', star: '', status: '', search: '' }
    currentPage = 1
    loadReviews()
  })
  document.getElementById('f-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch()
  })

  async function loadReviews() {
    const wrap = document.getElementById('reviews-table-wrap')
    wrap.innerHTML = '<div class="loading"><div class="spinner"></div> 載入評論…</div>'

    try {
      let query = supabase
        .from('google_reviews')
        .select('*', { count: 'exact' })
        .in('branch_name', storeNames)
        .order('review_time', { ascending: false })

      if (filters.store) query = query.eq('branch_name', filters.store)
      if (filters.star) query = query.eq('star_rating', filters.star)
      if (filters.status) query = query.eq('process_status', filters.status)
      if (filters.search) query = query.ilike('review_content', `%${filters.search}%`)

      const from = (currentPage - 1) * PAGE_SIZE
      query = query.range(from, from + PAGE_SIZE - 1)

      const { data, count, error } = await query
      if (error) throw error

      renderTable(wrap, data ?? [], count ?? 0)
    } catch (err) {
      wrap.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>載入失敗：${err.message}</p></div>`
    }
  }

  function renderTable(wrap, rows, total) {
    const totalPages = Math.ceil(total / PAGE_SIZE)

    wrap.innerHTML = `
      <div class="table-wrap">
        <div class="table-info">
          <span>共 <strong>${total}</strong> 筆評論</span>
          <span>第 ${currentPage} / ${totalPages || 1} 頁</span>
        </div>
        ${rows.length === 0 ? `
          <div class="empty-state"><div class="icon">💬</div><p>目前沒有符合條件的評論</p></div>
        ` : `
        <table>
          <thead>
            <tr>
              <th>門店</th>
              <th>評論者</th>
              <th>星級</th>
              <th>評論內容</th>
              <th>評論時間</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="text-truncate" style="max-width:160px">${esc(r.branch_name ?? '—')}</td>
                <td>${esc(r.reviewer_name ?? '匿名')}</td>
                <td>${starsHtml(r.star_rating)}</td>
                <td class="text-truncate">${esc(r.review_content ?? '（無內容）')}</td>
                <td style="white-space:nowrap">${fmtDate(r.review_time)}</td>
                <td>
                  <span class="badge ${STATUS_BADGE[r.process_status] ?? ''}">${esc(r.process_status ?? '未處理')}</span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm btn-detail" data-id="${r.id}">查看</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="pagination">
          <button class="page-btn" id="pg-prev" ${currentPage <= 1 ? 'disabled' : ''}>‹</button>
          ${Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => Math.abs(p - currentPage) <= 2)
            .map(p => `<button class="page-btn ${p === currentPage ? 'active' : ''}" data-pg="${p}">${p}</button>`)
            .join('')}
          <button class="page-btn" id="pg-next" ${currentPage >= totalPages ? 'disabled' : ''}>›</button>
        </div>
        `}
      </div>
    `

    wrap.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => openModal(rows.find(r => r.id == btn.dataset.id)))
    })

    wrap.querySelectorAll('[data-pg]').forEach(btn => {
      btn.addEventListener('click', () => { currentPage = +btn.dataset.pg; loadReviews() })
    })

    wrap.getElementById?.('pg-prev')
    document.getElementById('pg-prev')?.addEventListener('click', () => { currentPage--; loadReviews() })
    document.getElementById('pg-next')?.addEventListener('click', () => { currentPage++; loadReviews() })
  }

  function openModal(review) {
    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>評論詳情</h3>
          <button class="btn-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <div class="detail-label">門店</div>
            <div class="detail-value">${esc(review.branch_name ?? '—')}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">評論者</div>
            <div class="detail-value">${esc(review.reviewer_name ?? '匿名')}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">星級</div>
            <div class="detail-value">${starsHtml(review.star_rating)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">評論時間</div>
            <div class="detail-value">${fmtDate(review.review_time)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">評論內容</div>
            <div class="detail-value" style="white-space:pre-wrap">${esc(review.review_content ?? '（無內容）')}</div>
          </div>
          ${review.ai_reply ? `
          <div class="detail-row">
            <div class="detail-label">🤖 AI 建議回覆</div>
            <div class="ai-reply-box">${esc(review.ai_reply)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">AI 分析時間</div>
            <div class="detail-value">${fmtDate(review.ai_analysis_time)}</div>
          </div>
          ` : ''}
          <div class="detail-row">
            <div class="detail-label">處理狀態</div>
            <select class="form-control status-select" id="modal-status" style="width:auto">
              <option value="未處理" ${review.process_status === '未處理' ? 'selected' : ''}>未處理</option>
              <option value="處理中" ${review.process_status === '處理中' ? 'selected' : ''}>處理中</option>
              <option value="已回覆" ${review.process_status === '已回覆' ? 'selected' : ''}>已回覆</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel">取消</button>
          <button class="btn btn-primary" id="modal-save">儲存狀態</button>
        </div>
      </div>
    `

    document.body.appendChild(backdrop)
    const close = () => backdrop.remove()

    backdrop.getElementById?.('modal-close')
    document.getElementById('modal-close').addEventListener('click', close)
    document.getElementById('modal-cancel').addEventListener('click', close)
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close() })

    document.getElementById('modal-save').addEventListener('click', async () => {
      const newStatus = document.getElementById('modal-status').value
      const { error } = await supabase
        .from('google_reviews')
        .update({ process_status: newStatus, reply_time: newStatus === '已回覆' ? new Date().toISOString() : null })
        .eq('id', review.id)

      if (error) {
        toast('更新失敗：' + error.message, 'error')
      } else {
        toast('狀態已更新', 'success')
        close()
        loadReviews()
      }
    })
  }

  loadReviews()
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
