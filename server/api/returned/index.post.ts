import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { orderId, motoboyName } = body

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId ausente' })
  }

  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('returned_orders').upsert({
      order_id: String(orderId),
      motoboy_name: motoboyName || 'Desconhecido'
    })
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Erro ao registrar devolvido:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno ao registrar devolução' })
  }
})
