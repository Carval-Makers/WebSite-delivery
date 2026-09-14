import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const orderId = getRouterParam(event, 'orderId')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId não fornecido' })
  }

  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('assigned_orders').delete().eq('orderid', orderId)
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Erro ao remover atribuição:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
