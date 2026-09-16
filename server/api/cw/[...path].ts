export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const path = event.context.params?.path || ''
  const query = getQuery(event)
  const method = event.method

  // Remove possible trailing slashes to avoid issues
  const baseUrl = (config.cardapioWebUrl || 'https://api.cardapioweb.com').replace(/\/$/, '')
  const cleanPath = (path || '').replace(/^\//, '')

  let targetUrl: string
  if (baseUrl.endsWith('/api') && cleanPath.startsWith('api/')) {
    targetUrl = `${baseUrl}/${cleanPath.slice(4)}`
  } else {
    targetUrl = `${baseUrl}/${cleanPath}`
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    if (config.cardapioWebApi) {
      headers['X-API-KEY'] = config.cardapioWebApi
      headers['Authorization'] = `Bearer ${config.cardapioWebApi}`
    }

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
      body
    })

    return response
  } catch (error: any) {
    console.error(`[CW Proxy] Erro na requisição [${method} ${targetUrl}]:`, error.statusCode || error.message, error.data || '')
    
    // Repassa o erro original se existir
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Erro interno de Proxy com a API Cardápio Web',
      data: error.data
    })
  }
})
