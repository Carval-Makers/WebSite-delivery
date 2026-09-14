import { getSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, name, lat, lng } = body

  if (!userId || !name || lat === undefined || lng === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Dados incompletos' })
  }

  try {
    const supabase = getSupabase()
    
    const { error } = await supabase.from('online_locations').upsert({
      userid: userId, // lowercase from pg schema
      name,
      lat,
      lng,
      lastupdate: new Date().toISOString()
    })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar localização:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno' })
  }
})
