import { createClient } from '@supabase/supabase-js'

export const getSupabase = () => {
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_KEY || ''
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing in .env')
  }

  return createClient(supabaseUrl, supabaseKey)
}
