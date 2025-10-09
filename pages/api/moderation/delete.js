import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE // **bảo mật** — chỉ lưu ở Vercel Environment

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'missing id' })

  // simple auth: kiểm tra header token admin (bạn cần thiết lập)
  const adminSecret = req.headers['x-admin-token']
  if (adminSecret !== process.env.MOD_API_TOKEN) return res.status(403).json({ error: 'forbidden' })

  const { error } = await supabaseAdmin.from('messages').update({ deleted: true }).eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}
