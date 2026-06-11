// Vercel Serverless Function
// POST /api/import-reviews
// 從「Google評論」Google Sheet 匯入評論至 Supabase google_reviews
// 相同 review_id（資料庫已存在）自動跳過

const SHEET_ID  = '1O_VO757PAt7NDWbhNMAL7_b4WxkICJqH4KuKXND2S2U'
const SHEET_GID = '0'

// Sheet 標題列 → google_reviews 欄位
const COLUMN_MAP = {
  '評論ID':    'review_id',
  '評論人':    'reviewer_name',
  '分店名稱':  'branch_name',
  '星等':      'star_rating',
  '評論內容':  'review_content',
  'AI回覆':    'ai_reply',
  '評論時間':  'review_time',
  'AI分析時間': 'ai_analysis_time',
  '處理狀態':  'process_status',
  '回覆時間':  'reply_time',
}

const TIMESTAMP_COLS = new Set(['review_time', 'ai_analysis_time', 'reply_time'])
const BATCH_SIZE = 500

// CSV 解析（支援引號內的換行與逗號）
function parseCSV(text) {
  const rows = []
  let row = [], cur = '', inQuote = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = false
      } else cur += c
    } else {
      if (c === '"') inQuote = true
      else if (c === ',') { row.push(cur); cur = '' }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
      else if (c !== '\r') cur += c
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row) }
  return rows
}

// Sheet 時間格式（2026-04-21 18:52:56 / 2026/04/23 2:48:08）→ ISO（不做時區轉換）
function normalizeTimestamp(value) {
  const t = (value ?? '').trim()
  if (!t) return null
  const m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$/)
  if (!m) return null
  const pad = n => String(n).padStart(2, '0')
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4])}:${pad(m[5])}:${pad(m[6])}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: '伺服器未設定 Supabase 環境變數' })
  }

  // Step 1：抓取 Google Sheet CSV
  let csvText
  try {
    const csvRes = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
      { redirect: 'follow' }
    )
    if (!csvRes.ok) {
      return res.status(502).json({
        error: `無法讀取 Google Sheet（HTTP ${csvRes.status}），請確認共用權限為「知道連結的使用者：檢視者」`,
      })
    }
    csvText = await csvRes.text()
  } catch (err) {
    return res.status(502).json({ error: '讀取 Google Sheet 時發生錯誤', detail: err.message })
  }

  // Step 2：解析 CSV 並轉換為 google_reviews 欄位
  const rows = parseCSV(csvText)
  if (rows.length < 2) {
    return res.status(400).json({ error: 'Sheet 內容為空或缺少資料列' })
  }

  const header = rows[0].map(h => h.trim())
  const colIndex = {}
  header.forEach((h, i) => {
    if (COLUMN_MAP[h]) colIndex[COLUMN_MAP[h]] = i
  })
  if (colIndex.review_id === undefined) {
    return res.status(400).json({ error: 'Sheet 格式不符：找不到「評論ID」欄位' })
  }

  const records = []
  let invalid = 0
  for (const row of rows.slice(1)) {
    const reviewId = (row[colIndex.review_id] ?? '').trim()
    if (!reviewId) {
      if (row.some(v => (v ?? '').trim())) invalid++
      continue
    }
    const rec = {}
    for (const [field, idx] of Object.entries(colIndex)) {
      const raw = (row[idx] ?? '').trim()
      rec[field] = TIMESTAMP_COLS.has(field) ? normalizeTimestamp(raw) : (raw || null)
    }
    rec.review_id = reviewId
    if (!rec.process_status) rec.process_status = '未處理'
    records.push(rec)
  }

  // Step 3：分批 upsert（review_id 衝突時跳過），統計實際新增筆數
  let inserted = 0
  try {
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)
      const upsertRes = await fetch(
        `${supabaseUrl}/rest/v1/google_reviews?on_conflict=review_id&select=review_id`,
        {
          method: 'POST',
          headers: {
            'apikey':        supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type':  'application/json',
            'Prefer':        'resolution=ignore-duplicates,return=representation',
          },
          body: JSON.stringify(batch),
        }
      )
      if (!upsertRes.ok) {
        let detail = {}
        try { detail = await upsertRes.json() } catch {}
        return res.status(502).json({
          error: `寫入資料庫失敗（HTTP ${upsertRes.status}）`,
          detail,
          inserted,
        })
      }
      const insertedRows = await upsertRes.json()
      inserted += insertedRows.length
    }
  } catch (err) {
    return res.status(500).json({ error: '寫入資料庫時發生錯誤', detail: err.message, inserted })
  }

  return res.status(200).json({
    success:  true,
    total:    records.length,
    inserted,
    skipped:  records.length - inserted,
    invalid,
  })
}
