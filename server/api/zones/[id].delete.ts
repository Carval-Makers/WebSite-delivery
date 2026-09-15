import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    return createError({ statusCode: 400, statusMessage: 'ID é obrigatório' })
  }

  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return createError({ statusCode: 500, statusMessage: error.message })
  }
})
