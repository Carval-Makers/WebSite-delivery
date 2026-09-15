import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID é obrigatório' })
  }

  try {
    const body = await readBody(event)
    const { name, price, polygon_points } = body

    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name
    if (price !== undefined) updateData.price = price
    if (polygon_points !== undefined) updateData.polygon_points = polygon_points

    if (Object.keys(updateData).length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Nenhum dado fornecido para atualização' })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('delivery_zones')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error
    return { success: true, data: data?.[0] }
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
})
