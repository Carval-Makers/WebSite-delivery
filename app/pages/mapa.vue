<template>
  <div class="map-container">
    <ClientOnly>
      <div id="map" class="map-wrapper"></div>
      <template #fallback>
        <div class="map-loading">
          <div class="loader"></div>
          <p>Carregando mapa GPS...</p>
        </div>
      </template>
    </ClientOnly>

    <!-- UI Overlay (opcional para o futuro) -->
    <div class="map-overlay-top">
      <div class="glass-panel profile-badge">
        <span v-if="userRole === 'admin'">Loja Ativa</span>
        <span v-else>Motoboy Online: {{ userName }}</span>
      </div>
    </div>

    <!-- Fab Admin "Motoboy" -->
    <button 
      v-if="userRole === 'admin'" 
      class="fab-motoboy btn-primary"
      @click="togglePanel"
    >
      🏍️ Motoboy
    </button>

    <!-- Fab Admin "Demonstrativo" -->
    <button 
      v-if="userRole === 'admin'" 
      class="fab-demo btn-primary"
      @click="toggleDemoPanel"
    >
      🎮 Demonstrativo
    </button>

    <!-- Fab Motoboy "Parar Rota" -->
    <button 
      v-if="userRole === 'delivery' && isRouting" 
      class="fab-motoboy-parar btn-danger"
      @click="triggerStopRoute"
    >
      🛑 Parar Rota
    </button>

    <!-- Fab Motoboy "Melhor Rota" -->
    <button 
      v-if="userRole === 'delivery' && !isRouting && cwOrders.length > 0" 
      class="fab-motoboy-parar btn-primary"
      style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);"
      @click="calculateBestRoute"
    >
      ⭐ Melhor Rota
    </button>


    <!-- Painel Lateral / Modal Demonstrativo -->
    <div v-if="isDemoPanelOpen && userRole === 'admin'" class="panel-overlay">
      <div class="glass-panel delivery-panel" style="max-height: 400px;">
        <div class="panel-header">
          <h2>Simulador</h2>
          <button class="btn-icon" @click="toggleDemoPanel">❌</button>
        </div>
        <div class="panel-content" style="padding: 15px;">
          <p style="margin-bottom: 15px; font-size: 14px; color: var(--color-text-secondary);">
            Envie uma corrida fantasma para um motoboy testar o app na rua.
          </p>
          
          <select v-model="selectedDemoMotoboy" class="form-input" style="width:100%; margin-bottom: 15px;">
            <option value="">-- Selecione o Motoboy --</option>
            <option v-for="boy in motoboys" :key="boy.id" :value="boy.id">
              {{ boy.name }}
            </option>
          </select>
          
          <button class="btn-primary" style="width: 100%; padding: 12px; margin-bottom: 10px;" @click="assignDemo">
            🚀 Iniciar Simulação
          </button>
          <button class="btn-danger" style="width: 100%; padding: 12px;" @click="unassignDemo">
            🛑 Cancelar Simulação
          </button>
        </div>
      </div>
    </div>

    <!-- Painel Lateral / Modal Glassmorphism -->
    <div v-if="isPanelOpen" class="panel-overlay">
      <div class="glass-panel delivery-panel">
        <div class="panel-header">
          <h2>Motoboys</h2>
          <button class="btn-icon" @click="toggleAddForm" title="Registrar novo motoboy">
            <span v-if="!showAddForm">➕</span>
            <span v-else>❌</span>
          </button>
        </div>

        <!-- Formulário de Adição -->
        <div v-if="showAddForm" class="add-form">
          <input type="text" v-model="newDelivery.name" placeholder="Nome" class="form-input" />
          <input type="text" v-model="newDelivery.login" placeholder="Login" class="form-input" />
          <input type="password" v-model="newDelivery.password" placeholder="Senha" class="form-input" />
          <button class="btn-primary btn-small" @click="addDelivery" :disabled="isSaving">
            {{ isSaving ? 'Salvando...' : 'Salvar' }}
          </button>
          <p v-if="addError" class="error-text">{{ addError }}</p>
        </div>

        <!-- Lista -->
        <div class="delivery-list" v-if="!isLoading">
          <div v-for="boy in motoboys" :key="boy.id" class="delivery-item">
            <div class="delivery-info">
              <span class="delivery-name">{{ boy.name }}</span>
              <span class="delivery-login">@{{ boy.login }}</span>
            </div>
            <button class="btn-icon btn-delete" @click="deleteDelivery(boy.id)" title="Deletar">
              ➖
            </button>
          </div>
          
          <div v-if="motoboys.length === 0" class="empty-state">
            Nenhum motoboy cadastrado.
          </div>
        </div>
        <div v-else class="loading-state">
          Carregando...
        </div>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// --- ESTADO GERAL ---
const userRole = ref('')
const userId = ref(null)
const userName = ref('')
const isRouting = ref(false) // Estado para mostrar/esconder o botão de parar rota
let map = null
let L = null


// --- ESTADO DO ADMIN ---
const isPanelOpen = ref(false)
const isDemoPanelOpen = ref(false)
const selectedDemoMotoboy = ref('')
const showAddForm = ref(false)
const motoboys = ref([])
const cwOrders = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const addError = ref('')
const newDelivery = ref({ name: '', login: '', password: '' })

// Rastreamento (Polling)
let trackingInterval = null
const deliveryMarkers = {} // Guarda os pinos dos motoboys (admin)
const orderMarkers = {} // Guarda pinos de pedidos
const assignments = ref([]) // Lista de atribuições

// Estados da Rota (GPS do Motoboy)
let routePolyline = null
let activeRouteDest = null
let currentMotoboyPos = null
let lastMotoboyPos = null
let myMotoboyMarker = null

let isDemoMode = false
let demoRouteCoords = []
let demoIndex = 0
let demoInterval = null

onMounted(async () => {
  // Pega dados do usuário
  const userData = localStorage.getItem('user')
  if (!userData) {
    if (import.meta.client) window.location.href = '/'
    return
  }

  try {
    const user = JSON.parse(userData)
    userRole.value = user.role
    userId.value = user.id
    userName.value = user.name
  } catch(e) {}

  // Inicializa Mapa
  L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  map = L.map('map', { zoomControl: false }).setView([-22.549, -41.975], 15)

  // Usando OpenStreetMap Padrão (Claro e gratuito)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)

  // Marcador fixo da Loja usando DivIcon para não quebrar a imagem em produção
  const storeIcon = L.divIcon({
    html: '<div style="font-size: 32px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.4));">🏪</div>',
    className: 'custom-moto-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  })
  
  const storeMarker = L.marker([-22.549, -41.975], { icon: storeIcon }).addTo(map)
  storeMarker.bindPopup("<b>Loja / Base</b><br>Alameda Campomar, 1435").openPopup()

  L.control.zoom({ position: 'bottomleft' }).addTo(map)

  // Inicia Lógica de Rastreamento dependendo da Role
  if (userRole.value === 'delivery') {
    startDeliveryTracking()
    
    // Funções de rota agora estão definidas corretamente dentro do import.meta.client para evitar sobreposição
  } else if (userRole.value === 'admin') {
    startAdminTracking()
    fetchMotoboys() // Precisamos da lista de motoboys para o select de despacho
    
    // Expõe a função globalmente para ser chamada pelo HTML injetado do Leaflet
    window.assignOrder = async (orderId) => {
      const select = document.getElementById(`select-motoboy-${orderId}`)
      if (!select || !select.value) {
        alert('Selecione um motoboy primeiro!')
        return
      }
      
      const motoboyId = Number(select.value)
      const motoboyName = select.options[select.selectedIndex].text

      try {
        // 1. Salva a atribuição no nosso banco local (Rápido)
        await $fetch('/api/assign', {
          method: 'POST',
          body: { orderId, motoboyId, motoboyName }
        })
        
        // 2. Avisa o Cardápio Web em background (Fire and Forget para não travar a tela)
        if (orderId !== 'DEMO_TUTORIAL') {
          $fetch(`/api/cw/api/partner/v1/orders/${orderId}/statuses/dispatched`, { method: 'POST' }).catch((cwError) => {
            $fetch(`/api/cw/api/partner/v1/orders/${orderId}/statuses/released`, { method: 'POST' }).catch(() => {})
          })
        }

        // 3. Atualização Otimista: Muda localmente para 'released' para a cor virar laranja instantaneamente
        const orderIndex = cwOrders.value.findIndex(o => String(o.id) === String(orderId))
        if (orderIndex !== -1) {
          cwOrders.value[orderIndex].status = 'released'
        }

        // Repinta os pinos instantaneamente sem buscar no Cardápio Web
        updateAdminPins()
      } catch (error) {
        console.error('Erro ao atribuir pedido.', error)
        alert('Erro ao atribuir pedido.')
      }
    }

    window.unassignOrder = async (orderId) => {
      try {
        await $fetch(`/api/assign/${orderId}`, { method: 'DELETE' })
        // Repinta os pinos instantaneamente
        updateAdminPins()
      } catch (error) {
        console.error('Erro ao remover atribuição.', error)
        alert('Erro ao remover atribuição.')
      }
    }
  }
})

onUnmounted(() => {
  if (trackingInterval) clearInterval(trackingInterval)
  if (map) map.remove()
})

// --- MÉTODOS DE RASTREAMENTO E ROTA ---

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const calculateBestRoute = () => {
  if (!navigator.geolocation) return alert('GPS indisponível')
  
  navigator.geolocation.getCurrentPosition((position) => {
    let currLat = position.coords.latitude
    let currLng = position.coords.longitude
    
    const unvisited = []
    Object.keys(orderMarkers).forEach(id => {
       const m = orderMarkers[id]
       const orderData = cwOrders.value.find(o => String(o.id) === String(id)) || {}
       unvisited.push({
         id,
         lat: m.getLatLng().lat,
         lng: m.getLatLng().lng,
         created_at: orderData.created_at,
         marker: m
       })
    })

    if (unvisited.length === 0) return alert('Nenhum pedido alocado!')

    const ordered = []
    let currentPos = { lat: currLat, lng: currLng }

    while (unvisited.length > 0) {
      let bestIndex = -1
      let bestScore = Infinity
      
      for (let i = 0; i < unvisited.length; i++) {
        const node = unvisited[i]
        const distKm = getDistance(currentPos.lat, currentPos.lng, node.lat, node.lng)
        
        let minsLate = 0
        if (node.created_at) {
          minsLate = Math.floor((new Date() - new Date(node.created_at)) / 60000)
          if (minsLate < 0) minsLate = 0
        }
        
        // Nossa heurística de ouro: Distância em km - (0.2km por minuto de atraso)
        // Isso deduz 200 metros da distância para cada minuto que a pizza tá atrasada!
        const score = distKm - (minsLate * 0.2)
        
        if (score < bestScore) {
          bestScore = score
          bestIndex = i
        }
      }
      
      const chosen = unvisited.splice(bestIndex, 1)[0]
      ordered.push(chosen)
      currentPos = { lat: chosen.lat, lng: chosen.lng }
    }
    
    // Atualiza visualmente a prioridade dos pinos para o Motoboy saber a ordem
    ordered.forEach((node, idx) => {
       const orderNum = idx + 1
       const labelHtml = node.id === 'DEMO_TUTORIAL' ? `<div style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#f59e0b; padding:2px 8px; border-radius:10px; font-size:11px; white-space:nowrap; font-weight:bold;">Demonstrativo</div>` : ''
       const numIcon = L.divIcon({
          html: `<div style="position:relative;">${labelHtml}<div class="order-pin-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">#${orderNum}</div></div>`,
          className: 'custom-moto-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
       })
       node.marker.setIcon(numIcon)
    })
    
    // Monta a super string para a API de Rotas OSRM
    const osrmCoords = [`${currLng},${currLat}`]
    ordered.forEach(node => osrmCoords.push(`${node.lng},${node.lat}`))
    
    const coordsStr = osrmCoords.join(';')
    
    // Traçando a rota multi-stop
    drawRoute(coordsStr, ordered[ordered.length - 1])
  })
}

const processMotoLocation = async (lat, lng, heading) => {
  currentMotoboyPos = { lat, lng }
  
  let angle = heading || 0
  if (heading === null && lastMotoboyPos) {
    const dy = lat - lastMotoboyPos.lat
    const dx = Math.cos(Math.PI / 180 * lastMotoboyPos.lat) * (lng - lastMotoboyPos.lng)
    angle = Math.atan2(dx, dy) * 180 / Math.PI
  }
  lastMotoboyPos = { lat, lng }

  if (!myMotoboyMarker) {
    const motoIcon = L.divIcon({
      html: `<div id="my-moto-icon" style="font-size: 32px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.4)); transform: rotate(${angle}deg); transition: transform 0.5s;">🏍️</div>`,
      className: 'custom-moto-icon', iconSize: [40, 40], iconAnchor: [20, 20]
    })
    myMotoboyMarker = L.marker([lat, lng], { icon: motoIcon }).addTo(map)
  } else {
    myMotoboyMarker.setLatLng([lat, lng])
    const iconEl = document.getElementById('my-moto-icon')
    if (iconEl) iconEl.style.transform = `rotate(${angle}deg)`
  }
  
  // A câmera agora é livre. Não forçamos map.setView para não atrapalhar o motoboy.

  try {
    await $fetch('/api/location', {
      method: 'POST',
      body: { userId: userId.value, name: userName.value, lat, lng }
    })
  } catch (e) {}
}

const drawRoute = async (coordsStr, finalNode, isDemo = false) => {
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`)
    const data = await response.json()
    
    if (data.routes && data.routes[0]) {
      const coordinates = data.routes[0].geometry.coordinates
      const latLngs = coordinates.map(coord => [coord[1], coord[0]]) // OSRM: [lng, lat] -> Leaflet: [lat, lng]
      
      if (routePolyline) {
        map.removeLayer(routePolyline)
      }
      
      routePolyline = L.polyline(latLngs, { color: '#10b981', weight: 6, opacity: 0.8 }).addTo(map)

      // Ativa o modo de navegação GPS em direção ao ponto final da rota toda
      isRouting.value = true
      const ordId = finalNode.orderId || finalNode.id
      activeRouteDest = { lat: finalNode.lat, lng: finalNode.lng, orderId: ordId }

      if (isDemo) {
        demoRouteCoords = latLngs
        demoIndex = 0
        if (demoInterval) clearInterval(demoInterval)
        demoInterval = setInterval(() => {
          if (demoIndex >= demoRouteCoords.length) {
            clearInterval(demoInterval)
            return
          }
          const [dLat, dLng] = demoRouteCoords[demoIndex]
          processMotoLocation(dLat, dLng, null)
          demoIndex += 2 // pula pontos para simular velocidade
        }, 1000)
      }
    }
  } catch (error) {
    console.error('Erro ao traçar rota', error)
  }
}

if (import.meta.client) {
  window.startRoute = (lat, lng, orderId) => {
    if (orderId === 'DEMO_TUTORIAL') {
      isDemoMode = true
      // Começa da loja
      const startLat = -22.549
      const startLng = -41.975
      drawRoute(`${startLng},${startLat};${lng},${lat}`, { lat, lng, orderId }, true)
      return
    }

    isDemoMode = false
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada.')
      return
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const startLat = position.coords.latitude
      const startLng = position.coords.longitude
      drawRoute(`${startLng},${startLat};${lng},${lat}`, { lat, lng, orderId }, false)
    })
  }

  window.stopRoute = () => {
    activeRouteDest = null
    isRouting.value = false
    isDemoMode = false
    if (demoInterval) clearInterval(demoInterval)
    if (routePolyline) {
      map.removeLayer(routePolyline)
      routePolyline = null
    }
  }

  window.confirmDelivery = async (orderId) => {
    
    try {
      // 1. Otimista UI (Remove instantaneamente do mapa para não travar o motoboy)
      if (orderMarkers[orderId]) {
        map.removeLayer(orderMarkers[orderId])
        delete orderMarkers[orderId]
      }
      cwOrders.value = cwOrders.value.filter(o => String(o.id) !== String(orderId))

      // 2. Avisa o Cardápio Web que foi concluído
      if (orderId !== 'DEMO_TUTORIAL') {
        await $fetch(`/api/cw/api/partner/v1/orders/${orderId}/statuses/concluded`, { method: 'POST' })
      }
      
      // 3. Remove a atribuição do Supabase para limpar o banco
      await $fetch(`/api/assign/${orderId}`, { method: 'DELETE' })
      
      if (orderId === 'DEMO_TUTORIAL') {
        window.stopRoute()
      }
    } catch (error) {
      console.error('Erro ao confirmar entrega', error)
      alert('Aviso: O pedido sumiu da sua tela, mas pode haver lentidão na sincronização com a loja.')
    }
  }
}

const startDeliveryTracking = () => {
  // Motoboy envia localização a cada 5 segundos
  const sendLocation = () => {
    if (isDemoMode) return // O demoInterval está rodando rápido (1s), não atrapalhe com GPS lento

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          processMotoLocation(position.coords.latitude, position.coords.longitude, position.coords.heading)
        },
        (error) => {
          console.error('GPS negado ou indisponível', error)
        }
      )
    }
  }

  const fetchMotoboyOrders = async () => {
    try {
      // Pega quais pedidos são meus
      const myAssignments = await $fetch(`/api/assign?motoboyId=${userId.value}`)
      const myOrderIds = new Set(myAssignments.map((a) => String(a.orderId)))
      
      if (myOrderIds.size === 0) {
        // Se não tem atribuição, limpa pinos
        Object.keys(orderMarkers).forEach(id => {
          map.removeLayer(orderMarkers[id])
          delete orderMarkers[id]
        })
        return
      }

      // Busca dados dos pedidos (poderiamos buscar do proxy, mas vamos pegar todos e filtrar)
      const summaryResponse = await $fetch('/api/cw/api/partner/v1/orders')
      const allOrdersSummary = summaryResponse.data || summaryResponse || []
      
      
      // Filtra os que são MEUS e estão ativos
      const activeOrderStatuses = new Set(['waiting_confirmation', 'pending_payment', 'pending_online_payment', 'scheduled_confirmed', 'confirmed', 'ready', 'released', 'canceling'])
      const myOrdersSummary = allOrdersSummary.filter(s => activeOrderStatuses.has(s.status) && myOrderIds.has(String(s.id)))

      const fullOrders = await Promise.all(myOrdersSummary.map(async (summary) => {
        try {
          const detail = await $fetch(`/api/cw/api/partner/v1/orders/${summary.id}`)
          return { ...summary, ...detail }
        } catch (e) { return summary }
      }))

      // INJEÇÃO DO PEDIDO TUTORIAL (DEMO)
      if (myOrderIds.has('DEMO_TUTORIAL')) {
        fullOrders.push({
          id: 'DEMO_TUTORIAL',
          status: 'ready',
          created_at: new Date().toISOString(),
          customer: { name: 'Joãozinho (Modo Tutorial)' },
          lat: -22.540,
          lng: -41.970
        })
      }

      cwOrders.value = fullOrders

      const currentOrderIds = new Set(fullOrders.map(o => String(o.id)))
      
      // Remove apenas os que sumiram da lista
      Object.keys(orderMarkers).forEach(id => {
        if (!currentOrderIds.has(String(id))) {
          map.removeLayer(orderMarkers[id])
          delete orderMarkers[id]
        }
      })

      const orderIcon = L.divIcon({
        html: `<div class="order-pin-icon" style="background: #3b82f6;">📦</div>`, // Azul pro motoboy ver a caixa dele
        className: 'custom-moto-icon', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20]
      })

      fullOrders.forEach((order) => {
        const lat = order.lat || Number(order.delivery_address?.latitude)
        const lng = order.lng || Number(order.delivery_address?.longitude)

        if (lat && lng && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
          const isThisRouteActive = activeRouteDest && String(activeRouteDest.orderId) === String(order.id)
          
          let distKm = 999;
          if (currentMotoboyPos) {
            distKm = getDistance(currentMotoboyPos.lat, currentMotoboyPos.lng, lat, lng)
          }
          const isNear = distKm < 0.2 // menos de 200 metros

          let popupHtml = `<b>Sua Entrega #${order.id}</b><br>${order.customer?.name || order.cliente || 'Cliente'}<br>Status: ${order.status}`
          
          if (!isThisRouteActive) {
            popupHtml += `<br><button onclick="window.startRoute(${lat}, ${lng}, '${order.id}')" style="margin-top:10px; width:100%; background:#10b981; color:white; border:none; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;">📍 Iniciar GPS (Traçar Rota)</button>`
          } else {
            popupHtml += `<br><button onclick="window.stopRoute()" style="margin-top:10px; width:100%; background:rgba(239, 68, 68, 0.2); color:#f87171; border:none; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;">❌ Parar Rota</button>`
          }
          
          if (isNear) {
            popupHtml += `<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 10px 0;"><button onclick="window.confirmDelivery('${order.id}')" style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:4px; font-weight:bold; cursor:pointer; font-size: 14px;">✅ Confirmar Entrega</button>`
          }
          
          if (!orderMarkers[order.id]) {
            const marker = L.marker([lat, lng], { icon: orderIcon }).addTo(map)
             .bindPopup(popupHtml)
            orderMarkers[order.id] = marker
          } else {
            orderMarkers[order.id].setPopupContent(popupHtml)
            orderMarkers[order.id].setLatLng([lat, lng])
          }
        }
      })
    } catch (e) {
      console.error('Erro ao buscar meus pedidos', e)
    }
  }

  // Chama 1 vez imediatamente e depois a cada 5s
  sendLocation()
  fetchMotoboyOrders()
  trackingInterval = setInterval(() => {
    sendLocation()
    fetchMotoboyOrders()
  }, 5000)
}

const startAdminTracking = () => {
  // Admin busca localizações a cada 5 segundos
  const fetchLocations = async () => {
    try {
      const activeLocations = await $fetch('/api/location')
      
      const activeUserIds = new Set(activeLocations.map(loc => loc.userId))

      // Remove marcadores antigos (motoboys que ficaram offline)
      Object.keys(deliveryMarkers).forEach(idStr => {
        const id = parseInt(idStr)
        if (!activeUserIds.has(id)) {
          map.removeLayer(deliveryMarkers[id])
          delete deliveryMarkers[id]
        }
      })

      // Define o ícone de moto
      const motoIcon = L.divIcon({
        html: '<div style="font-size: 28px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.4));">🏍️</div>',
        className: 'custom-moto-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      })

      // Adiciona ou atualiza marcadores novos
      activeLocations.forEach(loc => {
        if (deliveryMarkers[loc.userId]) {
          // Atualiza posição
          deliveryMarkers[loc.userId].setLatLng([loc.lat, loc.lng])
        } else {
          // Cria novo pino com ícone de moto
          const marker = L.marker([loc.lat, loc.lng], { icon: motoIcon }).addTo(map)
          marker.bindPopup(`<b>🏍️ ${loc.name}</b><br>Online agora`)
          deliveryMarkers[loc.userId] = marker
        }
      })

    } catch (error) {
      console.error('Erro ao buscar localizações', error)
    }
  }

  // Chama 1 vez imediatamente e depois a cada 5s
  fetchLocations()
  trackingInterval = setInterval(fetchLocations, 5000)

  // Inicia também a busca automática dos pedidos (Cardápio Web) a cada 15 segundos
  fetchCwOrders()
  setInterval(fetchCwOrders, 15000)
}


// --- MÉTODOS DO PAINEL ADMIN ---
const toggleDemoPanel = () => {
  isDemoPanelOpen.value = !isDemoPanelOpen.value
  if (isDemoPanelOpen.value) {
    isPanelOpen.value = false
    if (motoboys.value.length === 0) fetchMotoboys()
  }
}

const togglePanel = () => {
  isPanelOpen.value = !isPanelOpen.value
  if (isPanelOpen.value) {
    isDemoPanelOpen.value = false
    if (motoboys.value.length === 0) fetchMotoboys()
  }
}

const assignDemo = async () => {
  if (!selectedDemoMotoboy.value) {
    alert('Selecione um motoboy primeiro!')
    return
  }
  const boyId = Number(selectedDemoMotoboy.value)
  const boy = motoboys.value.find(m => m.id === boyId)
  if (!boy) return
  
  try {
    await $fetch('/api/assign', {
      method: 'POST',
      body: { orderId: 'DEMO_TUTORIAL', motoboyId: boy.id, motoboyName: boy.name }
    })
    alert(`Modo Tutorial ativado para o motoboy ${boy.name}!`)
    toggleDemoPanel()
  } catch(e) {
    alert('Erro ao iniciar simulação.')
  }
}

const unassignDemo = async () => {
  try {
    await $fetch(`/api/assign/DEMO_TUTORIAL`, { method: 'DELETE' })
    alert('Modo Tutorial encerrado!')
    toggleDemoPanel()
  } catch(e) {
    alert('Erro ao encerrar simulação.')
  }
}

const updateAdminPins = async () => {
  try {
    const assignData = await $fetch('/api/assign')
    const assignedMap = {}
    assignData.forEach((a) => {
      assignedMap[String(a.orderId)] = a.motoboyName
    })

    const currentOrderIds = new Set(cwOrders.value.map(o => String(o.id)))

    // Remove os pinos antigos que não estão mais na API
    Object.keys(orderMarkers).forEach(id => {
      if (!currentOrderIds.has(String(id))) {
        map.removeLayer(orderMarkers[id])
        delete orderMarkers[id]
      }
    })

    // Lógica para colocar pinos no mapa
    cwOrders.value.forEach((order, index) => {
      const lat = order.lat || Number(order.delivery_address?.latitude)
      const lng = order.lng || Number(order.delivery_address?.longitude)
      const orderNum = index + 1
      const orderIdStr = String(order.id)

      if (lat && lng && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
        
        // Verifica se já foi atribuído no banco local
        const motoboyName = assignedMap[orderIdStr]
        const isAssigned = !!motoboyName
        
        let pinGradient = 'linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)' // Padrão Cinza
        let canAssign = false
        
        if (order.status === 'confirmed') {
          pinGradient = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' // Azul
          canAssign = true
        } else if (order.status === 'ready') {
          pinGradient = 'linear-gradient(135deg, #10b981 0%, #059669 100%)' // Verde
          canAssign = true
        } else if (order.status === 'released' || order.status === 'dispatched') {
          pinGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' // Laranja
          canAssign = false
        }
        
        const pinStyle = `background: ${pinGradient};`
        
        // Ícone Numérico Dinâmico
        const labelHtml = order.id === 'DEMO_TUTORIAL' ? `<div style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#f59e0b; padding:2px 8px; border-radius:10px; font-size:11px; white-space:nowrap; font-weight:bold;">Demonstrativo</div>` : ''
        const numberIcon = L.divIcon({
          html: `<div style="position:relative;">${labelHtml}<div class="order-pin-icon" style="${pinStyle}">#${orderNum}</div></div>`,
          className: 'custom-moto-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -20]
        })

        // Calcula tempo decorrido
        let timeInfo = ''
        if (order.created_at) {
          const diffMins = Math.floor((new Date() - new Date(order.created_at)) / 60000)
          if (diffMins > 45) {
            timeInfo = `<br><span style="color: #ef4444; font-weight: bold;">⏱️ Atrasado: ${diffMins} min</span>`
          } else {
            timeInfo = `<br><span style="color: #6b7280;">⏱️ Feito há ${diffMins} min</span>`
          }
        }

        // Constrói o HTML do Popup
        let popupHtml = `<b>${order.customer?.name || order.cliente || 'Cliente'} #${orderNum}</b><br>Status: <strong>${order.status}</strong>${timeInfo}`
        
        if (isAssigned) {
          popupHtml += `<br><span style="color: #3b82f6; font-weight: bold;">🏍️ Entregador: ${motoboyName}</span>`
          popupHtml += `<br><button onclick="window.unassignOrder('${orderIdStr}')" style="margin-top:10px; width:100%; background:rgba(239, 68, 68, 0.2); color:#f87171; border:none; padding:4px; border-radius:4px; cursor:pointer;">Desalocar Motoboy</button>`
        } 
        
        if (canAssign && !isAssigned) {
          // Select Box para o Admin escolher
          let optionsHtml = '<option value="">-- Escolha um Motoboy --</option>'
          motoboys.value.forEach(m => {
            optionsHtml += `<option value="${m.id}">${m.name}</option>`
          })
          
          popupHtml += `
            <div style="margin-top: 10px;">
              <select id="select-motoboy-${orderIdStr}" style="width:100%; padding: 4px; border-radius:4px;">
                ${optionsHtml}
              </select>
              <button onclick="window.assignOrder('${orderIdStr}')" style="margin-top:5px; width:100%; background:#10b981; color:white; border:none; padding:4px; border-radius:4px; cursor:pointer;">
                Atribuir ao Motoboy
              </button>
            </div>
          `
        }

        if (!orderMarkers[orderIdStr]) {
          const marker = L.marker([lat, lng], { icon: numberIcon }).addTo(map).bindPopup(popupHtml)
          orderMarkers[orderIdStr] = marker
        } else {
          orderMarkers[orderIdStr].setIcon(numberIcon)
          orderMarkers[orderIdStr].setPopupContent(popupHtml)
          orderMarkers[orderIdStr].setLatLng([lat, lng])
        }
      }
    })
  } catch (error) {
    console.error('Erro ao atualizar pinos', error)
  }
}

const fetchCwOrders = async () => {
  try {
    const summaryResponse = await $fetch('/api/cw/api/partner/v1/orders')
    const allOrdersSummary = summaryResponse.data || summaryResponse || []

    const activeOrderStatuses = new Set([
      'waiting_confirmation',
      'pending_payment',
      'pending_online_payment',
      'scheduled_confirmed',
      'confirmed',
      'ready',
      'released',
      'canceling'
    ])

    const activeOrdersSummary = allOrdersSummary.filter(summary => activeOrderStatuses.has(summary.status))

    const fullOrders = await Promise.all(activeOrdersSummary.map(async (summary) => {
      try {
        const detail = await $fetch(`/api/cw/api/partner/v1/orders/${summary.id}`)
        return { ...summary, ...detail }
      } catch (e) {
        return summary
      }
    }))
    
    cwOrders.value = fullOrders

    // Aciona a repintura dos pinos
    updateAdminPins()
  } catch (error) {
    console.error('Erro ao buscar pedidos do Cardápio Web', error)
  }
}

const toggleAddForm = () => {
  showAddForm.value = !showAddForm.value
  addError.value = ''
  newDelivery.value = { name: '', login: '', password: '' }
}

const fetchMotoboys = async () => {
  isLoading.value = true
  try {
    const data = await $fetch('/api/delivery')
    motoboys.value = data
  } catch (error) {
    console.error('Erro ao buscar motoboys', error)
  } finally {
    isLoading.value = false
  }
}

const addDelivery = async () => {
  if (!newDelivery.value.name || !newDelivery.value.login || !newDelivery.value.password) {
    addError.value = 'Preencha todos os campos.'
    return
  }
  
  isSaving.value = true
  addError.value = ''
  try {
    await $fetch('/api/delivery', {
      method: 'POST',
      body: newDelivery.value
    })
    toggleAddForm()
    await fetchMotoboys() // Recarrega a lista
  } catch (error) {
    addError.value = error.data?.statusMessage || 'Erro ao cadastrar.'
  } finally {
    isSaving.value = false
  }
}

const deleteDelivery = async (id) => {
  if (!confirm('Tem certeza que deseja remover este motoboy?')) return
  
  try {
    await $fetch(`/api/delivery/${id}`, { method: 'DELETE' })
    await fetchMotoboys() // Recarrega a lista
  } catch (error) {
    alert('Erro ao remover motoboy.')
  }
}

const triggerStopRoute = () => {
  if (window.stopRoute) window.stopRoute()
}
</script>

<style scoped>
.map-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background-color: var(--color-bg);
}
.map-wrapper { width: 100%; height: 100%; z-index: 1; }
.map-loading { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
.loader { width: 40px; height: 40px; border: 3px solid rgba(255, 255, 255, 0.1); border-radius: 50%; border-top-color: var(--color-primary); animation: spin 1s ease-in-out infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.map-overlay-top { position: absolute; top: 20px; left: 0; width: 100%; display: flex; justify-content: center; z-index: 1000; pointer-events: none; }
.profile-badge { padding: 10px 20px; border-radius: 20px; font-weight: 600; color: #10b981; pointer-events: auto; }

/* Fab Botões */
.fab-motoboy {
  position: absolute;
  bottom: 30px;
  right: 30px;
  z-index: 1000;
  border-radius: 30px;
  padding: 12px 24px;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
}

.fab-demo {
  position: absolute;
  bottom: 90px; /* Above motoboy button */
  right: 30px;
  z-index: 1000;
  border-radius: 30px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white; border: none; font-weight: 600; cursor: pointer;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
}
.fab-demo:hover {
  transform: translateY(-2px);
}

.fab-motoboy-parar {
  position: absolute;
  bottom: 30px;
  right: 30px;
  z-index: 1000;
  border-radius: 30px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: white; border: none; font-weight: 600; cursor: pointer; transition: var(--transition);
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
  animation: slideUpFade 0.3s ease-out;
}
.fab-motoboy-parar:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -10px rgba(239, 68, 68, 0.6);
}

/* Painel / Modal Flutuante */
.panel-overlay {
  position: absolute;
  bottom: 80px;
  right: 30px;
  z-index: 1001;
}

.delivery-panel {
  width: 320px;
  max-height: 450px;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  animation: slideUpFade 0.2s ease-out;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
}

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h2 { font-size: 16px; margin: 0; }

.btn-icon {
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 50%;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: var(--transition);
}
.btn-icon:hover { background: rgba(255,255,255,0.2); transform: scale(1.05); }

/* Lista de entregadores */
.delivery-list { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.delivery-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0,0,0,0.2);
  border-radius: 12px;
}
.delivery-info { display: flex; flex-direction: column; }
.delivery-name { font-weight: 600; font-size: 15px; }
.delivery-login { font-size: 13px; color: var(--color-text-secondary); }
.btn-delete { background: rgba(239, 68, 68, 0.15); }
.btn-delete:hover { background: rgba(239, 68, 68, 0.3); }

/* Formulario */
.add-form {
  background: rgba(0,0,0,0.2);
  padding: 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}
.form-input {
  background: rgba(15, 17, 21, 0.6);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: 10px;
  border-radius: 8px;
  outline: none;
}
.form-input:focus { border-color: var(--color-primary); }
.btn-small { padding: 10px; font-size: 14px; }
.error-text { color: var(--color-error); font-size: 13px; margin: 0; text-align: center; }

/* Globais e Botoes compartilhados */
.btn-primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
  color: white; border: none; font-weight: 600; cursor: pointer; transition: var(--transition);
}
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px -10px rgba(99, 102, 241, 0.6); }
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

/* Customização de Ícones no Mapa */
:deep(.custom-moto-icon) {
  background: transparent;
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
}

:deep(.order-pin-icon) {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-weight: 800;
  font-size: 14px;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

:deep(.leaflet-popup-content-wrapper) { background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: 8px; }
:deep(.leaflet-popup-tip) { background: var(--color-surface); }
:deep(.leaflet-container a.leaflet-popup-close-button) { color: var(--color-text-secondary); }
</style>
