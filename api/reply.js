/**
 * Vercel Serverless Function
 * POST /api/reply
 * Body: { reviewId, comment }
 *
 * 使用 GOOGLE_REFRESH_TOKEN 換取 Access Token，
 * 再呼叫 Google My Business API 送出回覆。
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { reviewId, comment } = req.body ?? {}

  if (!reviewId || !comment) {
    return res.status(400).json({ error: 'reviewId and comment are required' })
  }

  try {
    // Step 1: 用 Refresh Token 換 Access Token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error('取得 Access Token 失敗：' + (tokenData.error_description ?? tokenData.error))
    }

    // Step 2: 呼叫 Google My Business API 送出回覆
    const apiRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${reviewId}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      }
    )

    if (!apiRes.ok) {
      const errData = await apiRes.json().catch(() => ({}))
      throw new Error('Google API 錯誤：' + (errData?.error?.message ?? apiRes.statusText))
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[api/reply]', err)
    return res.status(500).json({ error: err.message })
  }
}
