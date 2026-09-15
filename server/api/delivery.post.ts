import { getSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { name, login, password } = body

  if (!login || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Login e senha são obrigatórios.' })
  }

  try {
    const supabase = getSupabase()
    
    const { data: existingUser } = await supabase.from('users').select('id').eq('login', login).maybeSingle()
    if (existingUser) {
      throw createError({ statusCode: 400, statusMessage: 'Este login já está em uso.' })
    }

    const { data, error } = await supabase.from('users').insert({
      name: name || login,
      login,
      password,
      role: 'delivery'
    }).select().single()

    if (error) throw error
    return { success: true, delivery: data }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Erro ao adicionar motoboy:', error)
    throw createError({ statusCode: 500, statusMessage: error.message || 'Erro interno' })
  }
})
