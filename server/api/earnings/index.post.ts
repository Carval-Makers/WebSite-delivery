import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { motoboyId, orderId, fee } = body

  if (!motoboyId || !orderId || fee === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Dados incompletos para registrar taxa.' })
  }

  try {
    const supabase = getSupabase()
    
    // Insere o registro de ganho
    const { data, error } = await supabase.from('motoboy_earnings').insert({
      motoboy_id: String(motoboyId),
      order_id: String(orderId),
      fee: Number(fee)
    }).select().single()

    if (error) {
      console.error('Supabase insert error:', error)
      throw error
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Erro ao registrar ganho do motoboy:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno ao registrar ganho' })
  }
})
