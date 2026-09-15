import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { name, price, polygon_points } = body

    if (!name || price === undefined || !polygon_points) {
      throw createError({ statusCode: 400, statusMessage: 'Faltando campos obrigatórios' })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('delivery_zones')
      .insert([{ name, price, polygon_points }])
      .select()
      
    if (error) throw error
    return { data: data[0] }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
})
