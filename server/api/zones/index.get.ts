import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('delivery_zones').select('*')
    if (error) throw error
    return { data }
  } catch (error: any) {
    return createError({ statusCode: 500, statusMessage: error.message })
  }
})
