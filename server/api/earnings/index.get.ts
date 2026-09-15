import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const motoboyId = query.motoboyId

  if (!motoboyId) {
    throw createError({ statusCode: 400, statusMessage: 'motoboyId é obrigatório' })
  }

  try {
    const supabase = getSupabase()
    
    // Regra de Expediente (Shift Logic): O turno começa às 16:00 (Horário de Brasília, UTC-3)
    const now = new Date()
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    const brTime = new Date(utc - (3600000 * 3)) // Converte para UTC-3
    
    const shiftStartBr = new Date(brTime)
    if (brTime.getHours() < 16) {
      // Se for antes das 16h (ex: 02:00 da manhã), o turno começou ontem às 16h
      shiftStartBr.setDate(shiftStartBr.getDate() - 1)
    }
    // Seta para 16:00:00.000 (horário do brasil)
    shiftStartBr.setHours(16, 0, 0, 0)
    
    // Converte de volta para UTC para consultar o Supabase
    const shiftStartUtc = new Date(shiftStartBr.getTime() + (3600000 * 3))
    const shiftStartIso = shiftStartUtc.toISOString()

    // Busca os ganhos desde o início do turno
    const { data, error } = await supabase
      .from('motoboy_earnings')
      .select('fee')
      .eq('motoboy_id', String(motoboyId))
      .gte('created_at', shiftStartIso)

    if (error) {
      console.error('Supabase select error:', error)
      throw error
    }

    const totalTaxas = data.reduce((acc, curr) => acc + Number(curr.fee), 0)
    const totalDeliveries = data.length

    return { 
      taxas: totalTaxas, 
      deliveries: totalDeliveries,
      shift_start: shiftStartIso
    }
  } catch (error: any) {
    console.error('Erro ao buscar ganhos do motoboy:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno ao buscar ganhos' })
  }
})
