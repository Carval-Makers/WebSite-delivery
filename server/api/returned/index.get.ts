import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async () => {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('returned_orders').select('*')
    if (error) throw error
    
    return data || []
  } catch (error) {
    console.error('Erro ao buscar devolvidos:', error)
    return []
  }
})
