export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const path = event.context.params?.path || ''
  const query = getQuery(event)
  const method = event.method

  // Remove possible trailing slashes to avoid issues
  const baseUrl = config.cardapioWebUrl.replace(/\/$/, '')
  const targetUrl = `${baseUrl}/${path}`

  try {
    const headers: HeadersInit = {
      'X-API-KEY': config.cardapioWebApi,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    // Se a API exigir a Partner Key também, podemos adicionar:
    // 'X-PARTNER-KEY': config.cardapioWebPartnerKey

    let body
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await readBody(event)
      } catch {
        body = undefined
      }
    }

    const response = await $fetch(targetUrl, {
      method,
      query,
      headers,
      body,
      redirect: 'manual' // Evita seguir redirects que dão erro
    })

    return response
  } catch (error: any) {
    console.error('Erro no Proxy Cardápio Web:', error)
    
    // Repassa o erro original se existir
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Erro interno de Proxy com a API Legacy',
      data: error.data
    })
  }
})
