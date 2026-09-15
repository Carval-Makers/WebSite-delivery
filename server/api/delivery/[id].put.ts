import { getSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')
  if (!idParam) {
    throw createError({ statusCode: 400, statusMessage: 'ID não fornecido' })
  }

  const id = parseInt(idParam, 10)
  const body = await readBody(event)
  const { login, password, name } = body

  if (!login) {
    throw createError({ statusCode: 400, statusMessage: 'O campo login é obrigatório.' })
  }

  try {
    const supabase = getSupabase()

    // Verifica se outro usuário já usa esse login
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('login', login)
      .neq('id', id)
      .maybeSingle()

    if (existingUser) {
      throw createError({ statusCode: 400, statusMessage: 'Este login já está em uso por outro usuário.' })
    }

    const updateData: Record<string, any> = {
      login,
      name: name || login
    }

    // Se forneceu uma nova senha, atualiza também
    if (password && String(password).trim() !== '') {
      updateData.password = password
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { success: true, delivery: data }
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error('Erro ao editar motoboy:', error)
    throw createError({ statusCode: 500, statusMessage: error.message || 'Erro interno ao editar motoboy' })
  }
})
