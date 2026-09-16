import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { motoboyId, orderId, fee } = body

  if (!motoboyId || !orderId || fee === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Dados incompletos para registrar taxa.' })
  }

  // DEMO_TUTORIAL não deve contabilizar
  if (String(orderId) === 'DEMO_TUTORIAL') {
    return { success: true, ignored: true, message: 'DEMO_TUTORIAL não contabiliza.' }
  }

  try {
    const supabase = getSupabase()
    
    // Evita duplicar ganhos se o pedido já foi registrado anteriormente
    const { data: existing } = await supabase
      .from('motoboy_earnings')
      .select('id, fee')
      .eq('order_id', String(orderId))
      .maybeSingle()

    if (existing) {
      return { success: true, alreadyRecorded: true, data: existing }
    }

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
