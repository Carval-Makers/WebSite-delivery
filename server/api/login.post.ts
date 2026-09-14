import { getSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { login, password } = body

  if (!login || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Login e senha são obrigatórios' })
  }

  try {
    const supabase = getSupabase()
    
    // Busca o usuário
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('login', login)
      .eq('password', password)
      .single()

    if (error || !user) {
      throw createError({ statusCode: 401, statusMessage: 'Login ou senha inválidos' })
    }

    const { password: _, ...userWithoutPassword } = user
    return { success: true, user: userWithoutPassword }

  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Erro no Supabase:', error)
    throw createError({ statusCode: 500, statusMessage: 'Erro interno no servidor' })
  }
})
