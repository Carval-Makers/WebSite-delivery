// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      script: [
        { src: 'https://unpkg.com/@phosphor-icons/web' }
      ]
    }
  },
  
  runtimeConfig: {
    cardapioWebApi: process.env.CARDAPIO_WEB_API_KEY,
    cardapioWebUrl: process.env.CARDAPIO_WEB_URL || 'https://api.cardapioweb.com'
  }
})
