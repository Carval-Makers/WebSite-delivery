import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  if (!idParam) {
    throw createError({ statusCode: 400, statusMessage: 'ID não fornecido' })
  }

  const id = parseInt(idParam, 10)

  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Erro ao remover motoboy:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
