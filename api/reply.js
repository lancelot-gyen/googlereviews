// Vercel Serverless Function
// POST /api/reply
// Body: { reviewId, replyText, userEmail }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { reviewId, replyText, userEmail } = req.body ?? {}

  if (!reviewId || !replyText) {
    return res.status(400).json({ error: '缺少必要參數：reviewId 或 replyText' })
  }

  // review_id 格式：accounts/{accountId}/locations/{locationId}/reviews/{reviewId}
  const parts = reviewId.split('/')
  if (parts.length < 6) {
    return res.status(400).json({ error: 'reviewId 格式錯誤，應為 accounts/.../locations/.../reviews/...' })
  }
  const accountId  = parts[1]
  const locationId = parts[3]
  const reviewPart = parts[5]

  // Step 1：用 refresh_token 換取 access_token
  let accessToken
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return res.status(500).json({ error: '取得 access_token 失敗', detail: tokenData })
    }
    accessToken = tokenData.access_token
  } catch (err) {
    return res.status(500).json({ error: '換取 token 時發生錯誤', detail: err.message })
  }

  // Step 2：呼叫 Google My Business Reviews API
  const apiUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewPart}/reply`

  try {
    const replyRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ comment: replyText }),
    })

    if (!replyRes.ok) {
      let errData = {}
      try { errData = await replyRes.json() } catch {}
      return res.status(replyRes.status).json({
        error: `Google API 回傳錯誤（${replyRes.status}）`,
        detail: errData,
      })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: '呼叫 Google API 時發生錯誤', detail: err.message })
  }
}
