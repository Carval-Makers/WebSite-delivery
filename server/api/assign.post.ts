import { getSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { orderId, motoboyId, motoboyName } = body

  if (!orderId || !motoboyId) {
    throw createError({ statusCode: 400, statusMessage: 'Dados incompletos' })
  }

  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('assigned_orders').upsert({
      orderid: orderId, // lowercase from pg schema
      motoboyid: motoboyId,
      motoboyname: motoboyName,
      assignedat: new Date().toISOString()
    })
    
    // Se estava na lista de devolvidos, remove
    await supabase.from('returned_orders').delete().eq('order_id', orderId)
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Erro ao atribuir pedido:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
