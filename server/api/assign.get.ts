import { getSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const motoboyId = query.motoboyId ? Number(query.motoboyId) : null

  try {
    const supabase = getSupabase()
    let request = supabase.from('assigned_orders').select('*')
    if (motoboyId) {
      request = request.eq('motoboyid', motoboyId)
    }
    
    const { data: assignments, error } = await request
    
    if (error) throw error
    
    const mapped = assignments?.map(a => ({
      orderId: a.orderid,
      motoboyId: a.motoboyid,
      motoboyName: a.motoboyname,
      assignedAt: a.assignedat
    })) || []
    
    return mapped
  } catch (error) {
    console.error('Erro ao buscar atribuições:', error)
    return []
  }
})
