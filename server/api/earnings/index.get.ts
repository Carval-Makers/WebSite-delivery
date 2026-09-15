import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const motoboyId = query.motoboyId

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

    let queryBuilder = supabase
      .from('motoboy_earnings')
      .select('id, motoboy_id, order_id, fee, created_at')
      .gte('created_at', shiftStartIso)
      .order('created_at', { ascending: false })

    if (motoboyId) {
      queryBuilder = queryBuilder.eq('motoboy_id', String(motoboyId))
    }

    const { data, error } = await queryBuilder

    if (error) {
      console.error('Supabase select error:', error)
      throw error
    }

    const earnings = data || []

    if (motoboyId) {
      const totalTaxas = earnings.reduce((acc, curr) => acc + Number(curr.fee || 0), 0)
      const totalDeliveries = earnings.length
      return { 
        taxas: totalTaxas, 
        deliveries: totalDeliveries,
        orders: earnings,
        shift_start: shiftStartIso
      }
    }

    // Se buscou de todos os motoboys (visão admin)
    const stats: Record<string, { taxas: number; deliveries: number; orders: any[] }> = {}
    let grandTotalTaxas = 0
    let grandTotalDeliveries = 0

    for (const item of earnings) {
      const boyId = String(item.motoboy_id)
      if (!stats[boyId]) {
        stats[boyId] = { taxas: 0, deliveries: 0, orders: [] }
      }
      const feeNum = Number(item.fee || 0)
      stats[boyId].taxas += feeNum
      stats[boyId].deliveries += 1
      stats[boyId].orders.push(item)
      grandTotalTaxas += feeNum
      grandTotalDeliveries += 1
    }

    return { 
      stats, 
      totalTaxas: grandTotalTaxas, 
      totalDeliveries: grandTotalDeliveries,
      shift_start: shiftStartIso
    }
  } catch (error: any) {
    console.error('Erro ao buscar ganhos do motoboy:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno ao buscar ganhos' })
  }
})
