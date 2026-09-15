import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const orderId = event.context.params?.orderId

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId ausente' })
  }

  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('returned_orders').delete().eq('order_id', orderId)
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Erro ao deletar devolvido:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno ao remover devolução' })
  }
})
