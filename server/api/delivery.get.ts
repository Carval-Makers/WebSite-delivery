import { getSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  try {
    const supabase = getSupabase()
    const { data: motoboys, error } = await supabase
      .from('users')
      .select('id, name, login')
      .eq('role', 'delivery')

    if (error) throw error
    return motoboys || []
  } catch (error) {
    console.error('Erro ao listar motoboys:', error)
    return []
  }
})
