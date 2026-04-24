import { supabase } from '../lib/supabase.js'
import { getAccessibleStoreNames, canReply, canClose } from '../lib/auth.js'
import { toast } from '../lib/toast.js'

const PAGE_SIZE = 20

const STATUS_BADGE = {
  '未處理': 'badge-unprocessed',
  '處理中': 'badge-processing',
  '已回覆': 'badge-replied',
  '已結案': 'badge-closed',
}

const STAR_MAP = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }

function starsHtml(rating) {
  const n = STAR_MAP[rating] ?? parseInt(rating) ?? 0
  return `<span class="stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

export async function renderReviews(container, user, roleInfo) {
  const storeNames = await getAccessibleStoreNames(roleInfo)
  const allowReply = canReply(roleInfo.role)
  const allowClose = canClose(roleInfo.role)

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
            <option value="已結案">已結案</option>
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
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1

    wrap.innerHTML = `
      <div class="table-wrap">
        <div class="table-info">
          <span>共 <strong>${total}</strong> 筆評論</span>
          <span>第 ${currentPage} / ${totalPages} 頁</span>
        </div>
        ${rows.length === 0 ? `
          <div class="empty-state"><div class="icon">💬</div><p>目前沒有符合條件的評論</p></div>
        ` : `
        <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>門店</th><th>評論者</th><th>星級</th>
              <th>評論內容</th><th>評論時間</th><th>狀態</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="text-truncate" style="max-width:150px">${esc(r.branch_name ?? '—')}</td>
                <td style="white-space:nowrap">${esc(r.reviewer_name ?? '匿名')}</td>
                <td>${starsHtml(r.star_rating)}</td>
                <td class="text-truncate">${esc(r.review_content ?? '（無內容）')}</td>
                <td style="white-space:nowrap">${fmtDate(r.review_time)}</td>
                <td><span class="badge ${STATUS_BADGE[r.process_status] ?? ''}">${esc(r.process_status ?? '未處理')}</span></td>
                <td><button class="btn btn-secondary btn-sm btn-detail" data-id="${r.id}">查看</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        </div>
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
    document.getElementById('pg-prev')?.addEventListener('click', () => { currentPage--; loadReviews() })
    document.getElementById('pg-next')?.addEventListener('click', () => { currentPage++; loadReviews() })
  }

  function openModal(review) {
    const isClosed = review.is_closed
    const isReplied = review.process_status === '已回覆'
    const showCloseBtn = allowClose && isReplied && !isClosed

    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop'
    backdrop.innerHTML = `
      <div class="modal" style="max-width:700px">
        <div class="modal-header">
          <h3>評論詳情</h3>
          <button class="btn-close" id="modal-close">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
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
          </div>

          <div class="detail-row">
            <div class="detail-label">評論內容</div>
            <div class="detail-value" style="white-space:pre-wrap;background:var(--gray-50);padding:12px;border-radius:6px">${esc(review.review_content ?? '（無內容）')}</div>
          </div>

          ${review.ai_reply ? `
          <div class="detail-row" style="margin-top:16px">
            <div class="detail-label">🤖 AI 建議回覆 <span style="color:var(--gray-400);font-size:11px">${fmtDate(review.ai_analysis_time)}</span></div>
            <div class="ai-reply-box">${esc(review.ai_reply)}</div>
            ${allowReply && !isClosed ? `
            <button class="btn btn-secondary btn-sm" id="btn-copy-ai" style="margin-top:8px">
              📋 套用 AI 回覆
            </button>` : ''}
          </div>
          ` : ''}

          ${review.reply_content ? `
          <div class="detail-row" style="margin-top:16px">
            <div class="detail-label">✅ 已送出的回覆 <span style="color:var(--gray-400);font-size:11px">${esc(review.replied_by ?? '')} · ${fmtDate(review.reply_time)}</span></div>
            <div class="detail-value" style="white-space:pre-wrap;background:#e6f4ea;padding:12px;border-radius:6px">${esc(review.reply_content)}</div>
          </div>
          ` : ''}

          ${allowReply && !isClosed ? `
          <div class="detail-row" style="margin-top:16px">
            <div class="detail-label">回覆內容</div>
            <textarea class="form-input" id="reply-content" rows="4" placeholder="輸入回覆內容…" style="resize:vertical">${esc(review.reply_content ?? '')}</textarea>
          </div>
          ` : ''}

          <div class="detail-row" style="margin-top:16px">
            <div class="detail-label">處理狀態</div>
            ${allowReply && !isClosed ? `
            <select class="form-control status-select" id="modal-status" style="width:auto">
              <option value="未處理" ${review.process_status === '未處理' ? 'selected' : ''}>未處理</option>
              <option value="處理中" ${review.process_status === '處理中' ? 'selected' : ''}>處理中</option>
              <option value="已回覆" ${review.process_status === '已回覆' ? 'selected' : ''}>已回覆</option>
            </select>
            ` : `<span class="badge ${STATUS_BADGE[review.process_status] ?? ''}">${esc(review.process_status)}</span>`}
          </div>

          ${isClosed ? `
          <div class="detail-row" style="margin-top:8px">
            <div class="detail-label">結案資訊</div>
            <div class="detail-value" style="color:var(--gray-600);font-size:13px">
              由 ${esc(review.closed_by ?? '—')} 於 ${fmtDate(review.closed_at)} 結案
            </div>
          </div>` : ''}
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel">關閉</button>
          ${showCloseBtn ? `<button class="btn btn-secondary" id="btn-close-review" style="color:var(--gray-600)">📁 結案</button>` : ''}
          ${allowReply && !isClosed ? `<button class="btn btn-primary" id="btn-send-reply">送出回覆</button>` : ''}
        </div>
      </div>
    `

    document.body.appendChild(backdrop)
    const close = () => backdrop.remove()

    document.getElementById('modal-close').addEventListener('click', close)
    document.getElementById('modal-cancel').addEventListener('click', close)
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close() })

    // 套用 AI 回覆
    document.getElementById('btn-copy-ai')?.addEventListener('click', () => {
      document.getElementById('reply-content').value = review.ai_reply
    })

    // 送出回覆
    document.getElementById('btn-send-reply')?.addEventListener('click', async () => {
      const replyText = document.getElementById('reply-content')?.value.trim()
      if (!replyText) { toast('請填入回覆內容', 'error'); return }

      const newStatus = document.getElementById('modal-status')?.value ?? '已回覆'
      const btn = document.getElementById('btn-send-reply')
      btn.disabled = true
      btn.textContent = '送出中…'

      try {
        // 呼叫 Google API（透過 Vercel Serverless Function）
        if (review.review_id) {
          const apiRes = await fetch('/api/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewId: review.review_id, comment: replyText }),
          })
          if (!apiRes.ok) {
            const err = await apiRes.json()
            throw new Error(err.error ?? '回覆失敗')
          }
        }

        // 更新 Supabase
        const { error } = await supabase
          .from('google_reviews')
          .update({
            reply_content: replyText,
            replied_by: user.email,
            reply_time: new Date().toISOString(),
            process_status: replyText ? '已回覆' : newStatus,
          })
          .eq('id', review.id)

        if (error) throw error

        toast('回覆已送出', 'success')
        close()
        loadReviews()
      } catch (err) {
        toast('錯誤：' + err.message, 'error')
        btn.disabled = false
        btn.textContent = '送出回覆'
      }
    })

    // 結案
    document.getElementById('btn-close-review')?.addEventListener('click', async () => {
      if (!confirm('確定要結案？結案後無法再修改回覆。')) return
      const { error } = await supabase
        .from('google_reviews')
        .update({
          is_closed: true,
          closed_by: user.email,
          closed_at: new Date().toISOString(),
          process_status: '已結案',
        })
        .eq('id', review.id)

      if (error) { toast('結案失敗：' + error.message, 'error'); return }
      toast('評論已結案', 'success')
      close()
      loadReviews()
    })
  }

  loadReviews()
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
