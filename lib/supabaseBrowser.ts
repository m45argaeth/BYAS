import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let initialized = false

// Client browser (anon key). Return null kalau env belum diisi, biar app tetap
// jalan mode lokal tanpa crash.
export function getSupabaseBrowser(): SupabaseClient | null {
  if (initialized) return client
  initialized = true
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    client = null
    return null
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return client
}
