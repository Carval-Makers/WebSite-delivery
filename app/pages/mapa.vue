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
        <span v-if="userRole === 'admin'" :style="{ fontWeight: 'bold', color: storeStatus === 'Loja Aberta' ? '#10b981' : (storeStatus === 'Loja Fechada' ? '#ef4444' : 'inherit') }">
          {{ storeStatus }}
        </span>
        <span v-else>Motoboy Online: {{ userName }} - Taxa: R$ {{ dailyTaxas.toFixed(2) }} ({{ dailyDeliveries }})</span>
      </div>
    </div>

    <!-- Fab Admin "Motoboy" -->
    <button 
      v-if="userRole === 'admin'" 
      class="fab-motoboy btn-primary"
      @click="togglePanel"
    >
      <i class="ph ph-motorcycle" style="font-size: 1.4em; margin-right: 8px;"></i> Motoboy
    </button>

    <!-- Fab Admin "Demonstrativo" -->
    <button 
      v-if="userRole === 'admin'" 
      class="fab-demo btn-primary"
      @click="toggleDemoPanel"
    >
      <i class="ph ph-game-controller" style="font-size: 1.4em; margin-right: 8px;"></i> Demonstrativo
    </button>

    <!-- Fab Admin "Devolvidos" -->
    <button 
      v-if="userRole === 'admin'" 
      class="fab-devolvidos btn-secondary"
      style="background-color: #f59e0b; border-color: #f59e0b; color: white;"
      @click="toggleReturnedPanel"
      title="Pedidos Devolvidos"
    >
      <i class="ph ph-arrow-u-up-left" style="font-size: 1.2em; margin-right: 8px;"></i> Devolvidos
      <span v-if="returnedOrders.length > 0" class="badge-count" style="background: red; color: white; padding: 2px 6px; border-radius: 12px; font-size: 12px; position: absolute; top: -5px; right: -5px;">{{ returnedOrders.length }}</span>
    </button>

    <!-- Fab Admin "Taxas" -->
    <button 
      v-if="userRole === 'admin'" 
      class="fab-taxas btn-secondary"
      @click="toggleEditZones"
    >
      <i class="ph ph-map-trifold" style="font-size: 1.4em; margin-right: 8px;"></i> Taxas
    </button>

    <!-- Fab Motoboy "Parar Rota" -->
    <button 
      v-if="userRole === 'delivery' && isRouting" 
      class="fab-motoboy-parar btn-danger"
      @click="triggerStopRoute"
    >
      <i class="ph ph-stop-circle" style="font-size: 1.2em; margin-right: 6px;"></i> Parar Rota
    </button>

    <!-- Indicador de Tela Sempre Ativa para o Motoboy -->
    <button 
      v-if="userRole === 'delivery' && isRouting" 
      class="badge-wakelock"
      :class="{ 'badge-wakelock-active': isWakeLockActive, 'badge-wakelock-inactive': !isWakeLockActive }"
      @click="ensureWakeLock"
      title="Status da tela: clique para garantir que a tela fique ligada"
    >
      <span class="wakelock-dot"></span>
      <span v-if="isWakeLockActive"><i class="ph ph-device-mobile" style="font-size: 1.2em; margin-right: 6px;"></i> Tela Sempre Ativa</span>
      <span v-else><i class="ph ph-warning-circle" style="font-size: 1.2em;"></i> Toque p/ Manter Ligada</span>
    </button>

    <!-- Fab Motoboy "Melhor Rota" -->
    <button 
      v-if="userRole === 'delivery' && !isRouting && cwOrders.length > 1" 
      class="fab-motoboy-parar btn-primary"
      style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);"
      @click="calculateBestRoute"
    >
      <i class="ph ph-path" style="font-size: 1.2em; margin-right: 6px;"></i> Melhor Rota
    </button>


    <!-- Painel Lateral / Modal Demonstrativo -->
    <div v-if="isDemoPanelOpen && userRole === 'admin'" class="panel-overlay">
      <div class="glass-panel delivery-panel" style="max-height: 400px;">
        <div class="panel-header">
          <h2>Simulador</h2>
          <button class="btn-icon" @click="toggleDemoPanel"><i class="ph ph-x" style="font-size: 1.2em;"></i></button>
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
            <i class="ph ph-play" style="font-size: 1.2em; margin-right: 6px;"></i> Iniciar Simulação
          </button>
          <button class="btn-danger" style="width: 100%; padding: 12px;" @click="unassignDemo">
            <i class="ph ph-x-circle" style="font-size: 1.2em; margin-right: 6px;"></i> Cancelar Simulação
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
            <span v-if="!showAddForm"><i class="ph ph-plus" style="font-size: 1.2em;"></i></span>
            <span v-else><i class="ph ph-x" style="font-size: 1.2em;"></i></span>
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
            <button class="btn-icon btn-delete" @click="deleteDelivery(boy.id)" title="Deletar"><i class="ph ph-trash" style="font-size: 1.1em; color: #ef4444;"></i></button>
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

    <!-- Painel de Devolvidos -->
    <div v-if="isReturnedPanelOpen" class="panel-overlay">
      <div class="glass-panel delivery-panel" style="max-height: 520px; width: 340px;">
        <div class="panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="ph ph-arrow-u-up-left" style="color: var(--color-secondary); font-size: 1.3em;"></i>
            <h2>Pedidos Devolvidos</h2>
          </div>
          <button class="btn-icon" @click="toggleReturnedPanel" title="Fechar"><i class="ph ph-x" style="font-size: 1.2em;"></i></button>
        </div>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
          Pedidos devolvidos à base. Selecione um entregador para sair para entrega novamente.
        </p>
        <div class="motoboy-list" style="overflow-y: auto; max-height: 380px;">
          <div v-if="returnedOrders.length === 0" class="empty-state">
            Nenhum pedido devolvido no momento.
          </div>
          <div 
            v-for="ro in returnedOrders" 
            :key="ro.order_id" 
            class="list-item-card" 
            style="flex-direction: column; align-items: stretch; border-left: 3px solid var(--color-secondary); margin-bottom: 10px; gap: 8px;"
          >
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 14px;">Pedido #{{ ro.order_id }}</span>
              <span style="font-size: 11px; color: var(--color-secondary); background: rgba(245, 158, 11, 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 600;">Devolvido</span>
            </div>
            <div style="font-size: 12px; color: var(--color-text-secondary);">
              Devolvido por: <strong style="color: var(--color-text-primary);">{{ ro.motoboy_name }}</strong>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
              <select v-model="selectedReassign[ro.order_id]" class="form-input" style="padding: 6px 10px; font-size: 13px;">
                <option value="">-- Reatribuir Entregador --</option>
                <option v-for="boy in motoboys" :key="boy.id" :value="boy.id">
                  {{ boy.name }}
                </option>
              </select>
              <button 
                class="btn-primary" 
                style="padding: 8px 12px; font-size: 13px; width: 100%; border-radius: var(--border-radius-sm);" 
                :disabled="!selectedReassign[ro.order_id] || isReassigning"
                @click="reassignReturnedOrder(ro.order_id, selectedReassign[ro.order_id])"
              >
                <i class="ph ph-motorcycle"></i> Enviar p/ Nova Entrega
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para Salvar Zona de Taxa -->
    <div v-if="showZoneModal" class="confirm-modal-overlay" @click.self="cancelZone">
      <div class="glass-panel confirm-modal-card">
        <h3 style="margin-bottom: 8px;">Nova Zona de Entrega</h3>
        <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 20px;">Defina o nome da região e o valor da taxa.</p>
        
        <div class="input-group">
          <label>Nome da Região</label>
          <input type="text" v-model="newZone.name" placeholder="Ex: Centro" class="form-input" style="width: 100%; margin-top: 4px;" />
        </div>
        
        <div class="input-group" style="margin-top: 15px;">
          <label>Taxa de Entrega (R$)</label>
          <input type="number" v-model="newZone.price" placeholder="Ex: 5.00" step="0.5" class="form-input" style="width: 100%; margin-top: 4px;" />
        </div>

        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button class="btn-secondary" style="flex:1;" @click="cancelZone">Cancelar</button>
          <button class="btn-primary" style="flex:1;" @click="saveZone">Salvar Zona</button>
        </div>
      </div>
    </div>

    <!-- Modal de Confirmação de Entrega Inteligente por Canal (iFood / 99Food / Direto) -->
    <div v-if="showConfirmModal" class="confirm-modal-overlay" @click.self="closeConfirmModal">
      <div class="glass-panel confirm-modal-card">
        <div class="confirm-modal-header">
          <div class="confirm-modal-title">
            <span class="confirm-modal-icon">
              <template v-if="detectedChannel === 'ifood'"><i class="ph ph-moped" style="font-size: 1.3em; color: #ea1d2c;"></i></template>
              <template v-else-if="detectedChannel === '99food'"><i class="ph ph-storefront" style="font-size: 1.2em;"></i></template>
              <template v-else><i class="ph ph-package" style="font-size: 1.3em; color: #10b981;"></i></template>
            </span>
            <div>
              <div class="confirm-title-row">
                <h3>Confirmar Entrega</h3>
                <span :class="['channel-badge', `badge-${detectedChannel}`]">
                  {{ channelLabel }}
                </span>
              </div>
              <p class="confirm-modal-subtitle">{{ pendingOrderInfo }}</p>
            </div>
          </div>
          <button class="btn-icon" @click="closeConfirmModal" title="Fechar"><i class="ph ph-x" style="font-size: 1.2em;"></i></button>
        </div>

        <p class="confirm-modal-desc">
          <template v-if="detectedChannel === 'ifood' && !showOtherChannels">
            Pedido identificado como <strong>iFood</strong>. Ao confirmar, abriremos a tela oficial de validação do código do cliente.
          </template>
          <template v-else-if="detectedChannel === '99food' && !showOtherChannels">
            Pedido identificado como <strong>99Food</strong>. Ao confirmar, abriremos a tela oficial de validação do código do cliente.
          </template>
          <template v-else-if="detectedChannel === 'direct' && !showOtherChannels">
            Pedido próprio <strong>Cardápio Web</strong>. Clique abaixo para confirmar e finalizar a entrega no aplicativo.
          </template>
          <template v-else>
            Selecione a plataforma para validar o código de entrega com o cliente:
          </template>
        </p>

        <div class="confirm-actions">
          <!-- Opção iFood: aparece se for canal ifood, ou modo demo, ou se o motoboy clicou em alterar canal -->
          <button 
            v-if="detectedChannel === 'ifood' || detectedChannel === 'all' || showOtherChannels"
            class="platform-btn ifood-btn"
            @click="handleConfirmPlatform('ifood')"
          >
            <div class="platform-btn-left">
              <span class="platform-logo"><i class="ph ph-moped"></i></span>
              <div class="platform-text">
                <strong>Confirmar no iFood</strong>
                <small>Abrir link de confirmação do iFood</small>
              </div>
            </div>
            <span class="platform-arrow"><i class="ph ph-arrow-up-right"></i></span>
          </button>

          <!-- Opção 99Food: aparece se for canal 99food, ou modo demo, ou se o motoboy clicou em alterar canal -->
          <button 
            v-if="detectedChannel === '99food' || detectedChannel === 'all' || showOtherChannels"
            class="platform-btn ninenine-btn"
            @click="handleConfirmPlatform('99food')"
          >
            <div class="platform-btn-left">
              <span class="platform-logo"><i class="ph ph-storefront" style="font-size: 1.2em;"></i></span>
              <div class="platform-text">
                <strong>Confirmar no 99Food</strong>
                <small>Abrir link de confirmação do 99Food</small>
              </div>
            </div>
            <span class="platform-arrow"><i class="ph ph-arrow-up-right"></i></span>
          </button>

          <!-- Opção Direto / Cardápio Web: aparece se for direto, ou modo demo, ou se o motoboy clicou em alterar canal -->
          <button 
            v-if="detectedChannel === 'direct' || detectedChannel === 'all' || showOtherChannels"
            class="platform-btn direct-btn"
            :class="{ 'direct-highlight': detectedChannel === 'direct' && !showOtherChannels }"
            @click="handleConfirmPlatform('direct')"
          >
            <div class="platform-btn-left">
              <span class="platform-logo"><i class="ph ph-check-circle" style="font-size: 1.2em;"></i></span>
              <div class="platform-text">
                <strong>Concluir Entrega Direta</strong>
                <small>Finalizar no app sem link externo</small>
              </div>
            </div>
            <span class="platform-arrow"><i class="ph ph-check"></i></span>
          </button>
          
          <button 
            v-if="detectedChannel === 'direct' || detectedChannel === 'all' || showOtherChannels"
            class="platform-btn direct-btn"
            style="background-color: #f59e0b; color: white;"
            @click="executeReturnDelivery(pendingOrder.id)"
          >
            <div class="platform-btn-left">
              <span class="platform-logo"><i class="ph ph-warning-circle" style="font-size: 1.2em;"></i></span>
              <div class="platform-text">
                <strong>Cliente Não Atendeu</strong>
                <small>Devolver para a Loja</small>
              </div>
            </div>
            <span class="platform-arrow"><i class="ph ph-arrow-u-up-left"></i></span>
          </button>
        </div>

        <!-- Opção de alternar canal caso a identificação automática precise de ajuste -->
        <button 
          v-if="detectedChannel !== 'all' && !showOtherChannels"
          class="btn-toggle-channel"
          @click="showOtherChannels = true"
        >
          <i class="ph ph-arrows-clockwise" style="margin-right: 4px;"></i> Não é {{ channelLabel }}? Ver outras opções
        </button>

        <button class="btn-cancel-modal" @click="closeConfirmModal">
          Cancelar
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// --- ESTADO GERAL ---
const userRole = ref('')
const userId = ref(null)
const userName = ref('')
const isRouting = ref(false) // Estado para mostrar/esconder o botão de parar rota
let map = null
let L = null

// --- ESTADO DO MODAL DE CONFIRMAÇÃO ---
const showConfirmModal = ref(false)
const pendingOrder = ref(null)

// --- ESTADO DAS ZONAS DE ENTREGA ---
const showZoneModal = ref(false)
const newZone = ref({ name: '', price: null })
const deliveryZones = ref([])
const isEditZonesMode = ref(false)
let currentDrawingLayer = null
let zonePolygons = {}
const showOtherChannels = ref(false)

// Ray-casting helper para verificar se coordenada está dentro do polígono
const isPointInPolygon = (point, vs) => {
  const x = point[0], y = point[1]
  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1]
    const xj = vs[j][0], yj = vs[j][1]
    const intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// --- ESTADO DIÁRIO DO MOTOBOY ---
const dailyTaxas = ref(0)
const dailyDeliveries = ref(0)

const loadDailyStats = async () => {
  if (userRole.value !== 'delivery') return
  try {
    const data = await $fetch(`/api/earnings?motoboyId=${userId.value}`)
    dailyTaxas.value = data.taxas || 0
    dailyDeliveries.value = data.deliveries || 0
  } catch (e) {}
}

const updateDailyStats = async (fee, orderId) => {
  if (userRole.value !== 'delivery') return
  try {
    // Atualiza otimista na tela
    dailyTaxas.value += fee
    dailyDeliveries.value += 1
    
    // Salva no banco de dados
    await $fetch('/api/earnings', {
      method: 'POST',
      body: { motoboyId: userId.value, orderId, fee }
    })
  } catch (e) {}
}

const getOrderChannel = (order) => {
  if (!order) return 'direct'
  if (order.id === 'DEMO_TUTORIAL') {
    return order.channel || 'all'
  }

  const salesChannel = String(order.sales_channel || '').toLowerCase()
  const deliveredBy = String(order.delivered_by || '').toLowerCase()
  const channel = String(order.channel || '').toLowerCase()
  const origin = String(order.origin || order.source || order.customer_origin || '').toLowerCase()
  const extName = String(order.external_merchant_name || '').toLowerCase()
  const obs = String(order.observation || '').toLowerCase()

  // Checagem iFood
  if (
    salesChannel === 'ifood' ||
    channel === 'ifood' ||
    deliveredBy.includes('ifood') ||
    origin.includes('ifood') ||
    extName.includes('ifood') ||
    obs.includes('ifood')
  ) {
    return 'ifood'
  }

  // Checagem 99Food
  if (
    salesChannel.includes('99') ||
    salesChannel.includes('food99') ||
    channel.includes('99') ||
    channel.includes('food99') ||
    deliveredBy.includes('99') ||
    deliveredBy.includes('food99') ||
    origin.includes('99') ||
    extName.includes('99') ||
    obs.includes('99food') ||
    obs.includes('99 food')
  ) {
    return '99food'
  }

  return 'direct'
}

const detectedChannel = computed(() => {
  if (!pendingOrder.value) return 'direct'
  return getOrderChannel(pendingOrder.value)
})

const channelLabel = computed(() => {
  if (detectedChannel.value === 'ifood') return 'iFood'
  if (detectedChannel.value === '99food') return '99Food'
  if (detectedChannel.value === 'all') return 'Demonstrativo'
  return 'Cardápio Web'
})

const pendingOrderInfo = computed(() => {
  if (!pendingOrder.value) return ''
  const num = getOrderNumber(pendingOrder.value)
  const client = pendingOrder.value.customer?.name || pendingOrder.value.cliente || 'Cliente'
  return `Pedido #${num} • ${client}`
})

const closeConfirmModal = () => {
  showConfirmModal.value = false
  pendingOrder.value = null
  showOtherChannels.value = false
}

const handleConfirmPlatform = async (platform) => {
  const order = pendingOrder.value
  const orderId = order?.id
  if (!orderId) {
    showConfirmModal.value = false
    return
  }

  // 1. Abertura do link síncrona com o clique do usuário para o navegador mobile não bloquear o pop-up
  if (platform === 'ifood') {
    if (import.meta.client) {
      window.open('https://confirmacao-entrega-propria.ifood.com.br', '_blank')
    }
  } else if (platform === '99food') {
    if (import.meta.client) {
      window.open('https://food-b-h5.99app.com/pt-BR/v2/confirmation-entrega', '_blank')
    }
  }

  // 2. Fecha o modal
  showConfirmModal.value = false
  pendingOrder.value = null

  // 3. Executa a finalização da entrega
  await executeConfirmDelivery(orderId)
}

const executeConfirmDelivery = async (orderId) => {
  try {
    // 1. Otimista UI (Remove instantaneamente do mapa para não travar o motoboy)
    if (orderMarkers[orderId]) {
      map.removeLayer(orderMarkers[orderId])
      delete orderMarkers[orderId]
    }
    
    // --- Lógica da Taxa ---
    const order = cwOrders.value.find(o => String(o.id) === String(orderId))
    let fee = 0
    if (order) {
      const lat = order.lat || Number(order.delivery_address?.latitude)
      const lng = order.lng || Number(order.delivery_address?.longitude)
      if (lat && lng) {
        for (const zone of deliveryZones.value) {
          if (isPointInPolygon([lat, lng], zone.polygon_points)) {
            fee = Number(zone.price)
            break
          }
        }
      }
    }
    updateDailyStats(fee, orderId)
    // -----------------------

    cwOrders.value = cwOrders.value.filter(o => String(o.id) !== String(orderId))

    // Se estiver em rota para este pedido, encerra a rota
    if (activeRouteDest && String(activeRouteDest.orderId) === String(orderId)) {
      if (window.stopRoute) window.stopRoute()
    }

    // 2. Avisa o Cardápio Web que o pedido foi entregue
    if (orderId !== 'DEMO_TUTORIAL') {
      await $fetch(`/api/cw/api/partner/v1/orders/${orderId}/delivered`, { method: 'POST' })
        .catch(async () => {
          // Se falhar o /delivered (ex: já finalizado ou regras do plano), tenta /finalize
          return await $fetch(`/api/cw/api/partner/v1/orders/${orderId}/finalize`, { method: 'POST' }).catch(() => {})
        })
    }
    
    // 3. Remove a atribuição do Supabase para limpar o banco
    await $fetch(`/api/assign/${orderId}`, { method: 'DELETE' })
    
    if (orderId === 'DEMO_TUTORIAL') {
      if (window.stopRoute) window.stopRoute()
    }
  } catch (error) {
    console.error('Erro ao confirmar entrega', error)
    
  }
}

const executeReturnDelivery = async (orderId) => {
  if (!confirm('Deseja realmente devolver este pedido? Você ganhará a taxa da viagem.')) return
  try {
    if (orderMarkers[orderId]) {
      map.removeLayer(orderMarkers[orderId])
      delete orderMarkers[orderId]
    }
    
    // --- Lógica da Taxa (Ganha a taxa mesmo devolvendo) ---
    const order = cwOrders.value.find(o => String(o.id) === String(orderId))
    let fee = 0
    if (order) {
      const lat = order.lat || Number(order.delivery_address?.latitude)
      const lng = order.lng || Number(order.delivery_address?.longitude)
      if (lat && lng) {
        for (const zone of deliveryZones.value) {
          if (isPointInPolygon([lat, lng], zone.polygon_points)) {
            fee = Number(zone.price)
            break
          }
        }
      }
    }
    updateDailyStats(fee, orderId)
    // -----------------------

    cwOrders.value = cwOrders.value.filter(o => String(o.id) !== String(orderId))

    if (activeRouteDest && String(activeRouteDest.orderId) === String(orderId)) {
      if (window.stopRoute) window.stopRoute()
    }
    
    if (orderId !== 'DEMO_TUTORIAL') {
      // Registra como devolvido no backend
      await $fetch('/api/returned', { 
        method: 'POST', 
        body: { orderId, motoboyName: userName.value }
      })
    }

    // Remove a atribuição do motoboy atual
    await $fetch(`/api/assign/${orderId}`, { method: 'DELETE' })
    
    pendingOrder.value = null
  } catch (error) {
    console.error('Erro ao devolver entrega', error)
  }
}


// --- ESTADO DO ADMIN ---
const storeStatus = ref('Carregando Status...')
const isPanelOpen = ref(false)
const isReturnedPanelOpen = ref(false)
const isDemoPanelOpen = ref(false)
const selectedDemoMotoboy = ref('')
const showAddForm = ref(false)
const isSaving = ref(false)
const addError = ref('')
const newDelivery = ref({ name: '', login: '', password: '' })
const motoboys = ref([])
const returnedOrders = ref([])
const selectedReassign = ref({})
const isReassigning = ref(false)
const cwOrders = ref([])
const isLoading = ref(false)

// Rastreamento (Polling)
let trackingInterval = null
const deliveryMarkers = {} // Guarda os pinos dos motoboys (admin)
const orderMarkers = {} // Guarda pinos de pedidos

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

// --- FUNÇÕES DE ZONAS DE ENTREGA ---
const fetchZones = async () => {
  try {
    const { data } = await $fetch('/api/zones')
    deliveryZones.value = data || []
    
    // Limpa os antigos
    Object.values(zonePolygons).forEach(p => map.removeLayer(p))
    zonePolygons = {}

    // Desenha as zonas
    deliveryZones.value.forEach(zone => {
      const poly = L.polygon(zone.polygon_points, { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2 })
      poly.zoneId = zone.id
      
      const center = poly.getBounds().getCenter()
      let priceHtml = `<div style="font-weight: 900; color: #1d4ed8; font-size: 18px; white-space: nowrap; text-shadow: 2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff;">R$ ${Number(zone.price).toFixed(2)}</div>`
      
      const labelIcon = L.divIcon({ html: priceHtml, className: '', iconSize: null, iconAnchor: [40, 20] })
      const labelMarker = L.marker(center, { icon: labelIcon, interactive: false, pmIgnore: true })
      
      // Salva edições no polígono (arrasto de vértices)
      let editTimeout = null
      const saveZoneCoordinates = async () => {
        try {
          let rawLatLngs = poly.getLatLngs()
          if (Array.isArray(rawLatLngs[0])) {
            rawLatLngs = rawLatLngs[0]
          }
          if (!rawLatLngs || rawLatLngs.length < 3) return
          const polygon_points = rawLatLngs.map(ll => [ll.lat, ll.lng])

          // Reposiciona o marcador de preço para o novo centro
          labelMarker.setLatLng(poly.getBounds().getCenter())

          // Atualiza dados na memória para cálculos de taxa imediatos
          const targetZone = deliveryZones.value.find(z => z.id === zone.id)
          if (targetZone) targetZone.polygon_points = polygon_points

          await $fetch(`/api/zones/${zone.id}`, {
            method: 'PUT',
            body: { polygon_points }
          })
        } catch (error) {
          console.error('Erro ao salvar atualização da zona:', error)
        }
      }

      poly.on('pm:edit', () => {
        clearTimeout(editTimeout)
        editTimeout = setTimeout(saveZoneCoordinates, 300)
      })

      poly.on('pm:update', () => {
        clearTimeout(editTimeout)
        saveZoneCoordinates()
      })

      zonePolygons[zone.id] = L.layerGroup([poly, labelMarker]).addTo(map)
    })
  } catch (error) {
    console.error('Erro ao carregar zonas:', error)
  }
}

const toggleEditZones = () => {
  isEditZonesMode.value = !isEditZonesMode.value
  if (map && map.pm) {
    map.pm.toggleControls()
  }
}

const cancelZone = () => {
  if (currentDrawingLayer) {
    map.removeLayer(currentDrawingLayer)
    currentDrawingLayer = null
  }
  showZoneModal.value = false
  newZone.value = { name: '', price: null }
}

const saveZone = async () => {
  if (!newZone.value.name || newZone.value.price === null) {
    return
  }
  if (!currentDrawingLayer) return

  let rawLatLngs = currentDrawingLayer.getLatLngs()
  if (Array.isArray(rawLatLngs[0])) {
    rawLatLngs = rawLatLngs[0]
  }
  const polygon_points = rawLatLngs.map(ll => [ll.lat, ll.lng])

  try {
    await $fetch('/api/zones', {
      method: 'POST',
      body: {
        name: newZone.value.name,
        price: newZone.value.price,
        polygon_points
      }
    })
    cancelZone()
    fetchZones()
  } catch (error) {
    console.error(error)
  }
}

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
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')

  map = L.map('map', { zoomControl: false }).setView([-22.549, -41.975], 15)

  // Usando OpenStreetMap Padrão (Claro e gratuito)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)

  // Marcador fixo da Loja usando DivIcon para não quebrar a imagem em produção
  const storeIcon = L.divIcon({
    html: '<div style="font-size: 32px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.4));">🍕</div>',
    className: 'custom-moto-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  })
  
  const storeMarker = L.marker([-22.549, -41.975], { icon: storeIcon }).addTo(map)
  storeMarker.bindPopup("<b>Loja / Base</b><br>Alameda Campomar, 1435")

  L.control.zoom({ position: 'bottomleft' }).addTo(map)

  // Configuração Geoman (Zonas de Entrega)
  if (userRole.value === 'admin' && map.pm) {
    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      drawPolygon: true,
    })
    map.pm.toggleControls() // Hide by default

    map.on('pm:create', (e) => {
      currentDrawingLayer = e.layer
      showZoneModal.value = true
    })

    map.on('pm:remove', async (e) => {
      if (e.layer.zoneId) {
        if(confirm('Remover esta zona de entrega?')) {
          await $fetch(`/api/zones/${e.layer.zoneId}`, { method: 'DELETE' })
          fetchZones()
        } else {
          fetchZones()
        }
      }
    })
  }
  
  // Carrega as zonas
  setTimeout(() => fetchZones(), 500)

  // Inicia Lógica de Rastreamento dependendo da Role
  if (userRole.value === 'delivery') {
    loadDailyStats()
    startDeliveryTracking()
    checkMotoboyWakeLock() // Mantem a tela ligada para motoboys
    // Funções de rota agora estão definidas corretamente dentro do import.meta.client para evitar sobreposição
  } else if (userRole.value === 'admin') {
    startAdminTracking()
    fetchMotoboys() // Precisamos da lista de motoboys para o select de despacho
    fetchReturnedOrders()
    // Expõe a função globalmente para ser chamada pelo HTML injetado do Leaflet
    window.assignOrder = async (orderId) => {
      const select = document.getElementById(`select-motoboy-${orderId}`)
      if (!select || !select.value) {
        
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
        
        // 2. Avisa o Cardápio Web para mudar o status para "Saiu para entrega" (released)
        if (orderId !== 'DEMO_TUTORIAL') {
          $fetch(`/api/cw/api/partner/v1/orders/${orderId}/dispatch`, { method: 'POST' })
            .catch((cwError) => {
              // Se falhar (ex: se o pedido ainda estiver em 'confirmed' e precisar ir para 'ready' primeiro):
              return $fetch(`/api/cw/api/partner/v1/orders/${orderId}/prepared`, { method: 'POST' })
                .then(() => $fetch(`/api/cw/api/partner/v1/orders/${orderId}/dispatch`, { method: 'POST' }))
                .catch((err2) => console.error('Erro ao despachar pedido no Cardápio Web:', err2))
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
        
      }
    }

    window.unassignOrder = async (orderId) => {
      try {
        await $fetch(`/api/assign/${orderId}`, { method: 'DELETE' })
        // Repinta os pinos instantaneamente
        updateAdminPins()
      } catch (error) {
        console.error('Erro ao remover atribuição.', error)
        
      }
    }
  }

  // Monitora retorno para o navegador e toques do motoboy para manter a tela ligada
  if (import.meta.client) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pointerdown', onGlobalUserInteraction, { passive: true })
    window.addEventListener('touchstart', onGlobalUserInteraction, { passive: true })
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('pointerdown', onGlobalUserInteraction)
    window.removeEventListener('touchstart', onGlobalUserInteraction)
  }
  releaseWakeLock()
  if (trackingInterval) clearInterval(trackingInterval)
  if (map) map.remove()
})

// --- SCREEN WAKE LOCK & FALLBACK (Mantém a tela do celular sempre ligada durante o percurso) ---
let wakeLock = null
let fallbackVideo = null
const isWakeLockActive = ref(false)

const startVideoFallback = () => {
  try {
    if (!import.meta.client || fallbackVideo) return
    
    fallbackVideo = document.createElement('video')
    fallbackVideo.setAttribute('playsinline', '')
    fallbackVideo.setAttribute('webkit-playsinline', '')
    fallbackVideo.muted = true
    fallbackVideo.loop = true
    fallbackVideo.style.position = 'fixed'
    fallbackVideo.style.bottom = '0'
    fallbackVideo.style.right = '0'
    fallbackVideo.style.width = '1px'
    fallbackVideo.style.height = '1px'
    fallbackVideo.style.opacity = '0.01'
    fallbackVideo.style.pointerEvents = 'none'
    fallbackVideo.style.zIndex = '-1'

    // Micro vídeo MP4 mudo em loop para impedir que o celular apague a tela mesmo em Modo de Economia
    fallbackVideo.src = 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAW1wNDJpc29tYXZjMQAAABBmcmVlAAACw21kYXQAAAK0AAACvW1vb3YAAABsbXZoZAAAAAB32Pzvd9j87wAABdQAAAN+AAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0AdHJhazAAAAEcdGtkaAAAAAHfd9j8d9j8AAAAAAN+AAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICbWRpYQAAACBtZGhkAAAAAHfY/O932PzvAABV0AABGAAAAAAAAAAMaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAADGbWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADGR1cmwAAAABAAAAv3N0YmwAAABTc3RzZAAAAAAAAAABAAAATmF2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAQAQABgAAABIAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEB//AAAAGmF2Y0MBAMAP/wAZAQD/AAAAMmF1dGgAAAAAAAAAAQAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACXN0dHMAAAAAAAAAAQAAAAEAAFXQAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAAAAAAABAAAAFnN0Y28AAAAAAAAAAQAAADAA'
    
    document.body.appendChild(fallbackVideo)
    const playPromise = fallbackVideo.play()
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isWakeLockActive.value = true
        
      }).catch((e) => {
        console.warn('Fallback de mídia aguarda toque do usuário:', e)
      })
    }
  } catch (e) {
    console.warn('Erro no fallback de vídeo:', e)
  }
}

const stopVideoFallback = () => {
  if (fallbackVideo) {
    try {
      fallbackVideo.pause()
      fallbackVideo.remove()
    } catch(e) {}
    fallbackVideo = null
  }
}

const requestWakeLock = async () => {
  if (!import.meta.client) return

  // 1. Tenta API Nativa do Navegador (Prioritária)
  if ('wakeLock' in navigator) {
    try {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen')
        isWakeLockActive.value = true
        

        wakeLock.addEventListener('release', () => {
          wakeLock = null
          isWakeLockActive.value = false
          
          // Se ainda estiver em rota, tenta reativar imediatamente via fallback
          if (isRouting.value) {
            startVideoFallback()
          }
        })
        return
      } else {
        isWakeLockActive.value = true
        return
      }
    } catch (err) {
      console.warn('Wake Lock nativo bloqueado ou sem gesto recente, ativando fallback:', err)
    }
  }

  // 2. Fallback de Mídia em segundo plano caso a API nativa falhe (ex: Modo Economia de Bateria ou iOS)
  startVideoFallback()
}

const releaseWakeLock = async () => {
  stopVideoFallback()
  if (wakeLock) {
    try {
      await wakeLock.release()
    } catch (err) {
      console.warn('Erro ao liberar Wake Lock:', err)
    }
    wakeLock = null
  }
  isWakeLockActive.value = false
  
}

const ensureWakeLock = () => {
  requestWakeLock()
}

const onGlobalUserInteraction = () => {
  // Se a rota estiver em andamento e por algum motivo a tela tiver sido liberada, renova no toque do motoboy!
  if (isRouting.value && !isWakeLockActive.value) {
    requestWakeLock()
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && isRouting.value) {
    requestWakeLock()
  }
}

// Monitora rota para solicitar ou liberar
watch(isRouting, (newVal) => {
  if (newVal) {
    requestWakeLock()
  } else {
    releaseWakeLock()
  }
})

// --- MÉTODOS DE RASTREAMENTO E ROTA ---

const getOrderNumber = (order, fallbackIndex) => {
  if (!order) return fallbackIndex !== undefined ? fallbackIndex + 1 : ''
  if (order.id === 'DEMO_TUTORIAL') return 'Demo'

  // Prioriza o identificador amigável/oficial do Cardápio Web (display_id, order_number, etc.)
  const rawNum = order.display_id ?? order.order_number ?? order.number ?? order.short_id ?? order.code ?? order.id
  if (rawNum !== undefined && rawNum !== null && String(rawNum).trim() !== '') {
    const cleaned = String(rawNum).trim()
    return cleaned.startsWith('#') ? cleaned.slice(1) : cleaned
  }

  return fallbackIndex !== undefined ? fallbackIndex + 1 : ''
}

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
  // Ativa a proteção de tela ligada imediatamente no gesto do usuário
  requestWakeLock()
  isRouting.value = true

  if (!navigator.geolocation) return 
  
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

    if (unvisited.length === 0) return 

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
      html: `<div id="my-moto-icon" style="font-size: 32px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.4)); transform: rotate(${angle}deg); transition: transform 0.5s;"><i class="ph ph-motorcycle" style="font-size: 1.4em; margin-right: 8px;"></i></div>`,
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
    // Ativa a proteção de tela ligada imediatamente no gesto do usuário
    requestWakeLock()
    isRouting.value = true

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

  window.confirmDelivery = (orderId) => {
    const order = cwOrders.value.find(o => String(o.id) === String(orderId))
    pendingOrder.value = order || { id: orderId }
    showOtherChannels.value = false
    showConfirmModal.value = true
  }

  window.confirmPlatformDelivery = async (orderId, platform) => {
    const order = cwOrders.value.find(o => String(o.id) === String(orderId))
    pendingOrder.value = order || { id: orderId }
    await handleConfirmPlatform(platform)
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

      // Ordena de forma determinística por data de criação (mais antigos primeiro)
      fullOrders.sort((a, b) => {
        if (a.id === 'DEMO_TUTORIAL') return 1
        if (b.id === 'DEMO_TUTORIAL') return -1
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
        if (timeA !== timeB) return timeA - timeB
        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
      })

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
        html: `<div class="order-pin-icon" style="background: #3b82f6;"><i class="ph ph-package"></i></div>`, // Azul pro motoboy ver a caixa dele
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
          const isNear = distKm < 0.3 || order.id === 'DEMO_TUTORIAL' // até 300 metros ou modo demo

          const channel = getOrderChannel(order)
          let channelBadge = ''
          let confirmBtnText = '<i class="ph ph-check-circle" style="font-size: 1.2em;"></i> Confirmar Entrega'
          let confirmBtnBg = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'

          if (channel === 'ifood') {
            channelBadge = '<span style="background:#ea1d2c; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-left:6px;">iFood</span>'
            confirmBtnText = '<i class="ph ph-moped"></i> Confirmar iFood'
            confirmBtnBg = 'linear-gradient(135deg, #ea1d2c 0%, #b9101d 100%)'
          } else if (channel === '99food') {
            channelBadge = '<span style="background:#ff8c00; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold; margin-left:6px;">99Food</span>'
            confirmBtnText = '<i class="ph ph-storefront" style="font-size: 1.2em;"></i> Confirmar 99Food'
            confirmBtnBg = 'linear-gradient(135deg, #ff8c00 0%, #d97706 100%)'
          }

          const orderNum = getOrderNumber(order)
          let popupHtml = `<b>Sua Entrega #${orderNum}</b>${channelBadge}<br>${order.customer?.name || order.cliente || 'Cliente'}<br>Status: ${order.status}`
          
          if (!isThisRouteActive) {
            popupHtml += `<br><button onclick="window.startRoute(${lat}, ${lng}, '${order.id}')" style="margin-top:10px; width:100%; background:#10b981; color:white; border:none; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;"><i class="ph ph-navigation-arrow" style="font-size: 1.2em; margin-right: 8px;"></i> Iniciar GPS (Traçar Rota)</button>`
          } else {
            popupHtml += `<br><button onclick="window.stopRoute()" style="margin-top:10px; width:100%; background:rgba(239, 68, 68, 0.2); color:#f87171; border:none; padding:6px; border-radius:4px; font-weight:bold; cursor:pointer;"><i class="ph ph-x" style="font-size: 1.2em;"></i> Parar Rota</button>`
          }
          
          if (isNear) {
            popupHtml += `<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;"><button onclick="window.confirmDelivery('${order.id}')" style="width:100%; background:${confirmBtnBg}; color:white; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer; font-size: 14px; box-shadow:0 2px 8px rgba(0,0,0,0.3);">${confirmBtnText}</button>`
          } else {
            popupHtml += `<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;"><button onclick="window.confirmDelivery('${order.id}')" style="width:100%; background:rgba(255,255,255,0.08); color:white; border:1px solid rgba(255,255,255,0.2); padding:8px; border-radius:6px; font-weight:600; cursor:pointer; font-size: 13px;">${confirmBtnText}</button>`
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
        html: '<div style="font-size: 28px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.4));"><i class="ph ph-motorcycle" style="font-size: 1.4em; margin-right: 8px;"></i></div>',
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
          marker.bindPopup(`<b><i class="ph ph-motorcycle" style="font-size: 1.4em; margin-right: 8px;"></i> ${loc.name}</b><br>Online agora`)
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
const toggleReturnedPanel = () => {
  isReturnedPanelOpen.value = !isReturnedPanelOpen.value
  if (isReturnedPanelOpen.value) {
    isPanelOpen.value = false
    isDemoPanelOpen.value = false
    fetchReturnedOrders()
  }
}

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
    
    toggleDemoPanel()
  } catch(e) {
    
  }
}

const unassignDemo = async () => {
  try {
    await $fetch(`/api/assign/DEMO_TUTORIAL`, { method: 'DELETE' })
    
    toggleDemoPanel()
  } catch(e) {
    
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
      const orderNum = getOrderNumber(order, index)
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
            timeInfo = `<br><span style="color: #ef4444; font-weight: bold;"><i class="ph ph-clock"></i> Atrasado: ${diffMins} min</span>`
          } else {
            timeInfo = `<br><span style="color: #6b7280;"><i class="ph ph-clock"></i> Feito há ${diffMins} min</span>`
          }
        }

        const channel = getOrderChannel(order)
        let channelTag = ''
        if (channel === 'ifood') {
          channelTag = ' <span style="background:#ea1d2c; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">iFood</span>'
        } else if (channel === '99food') {
          channelTag = ' <span style="background:#ff8c00; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">99Food</span>'
        }

        // Constrói o HTML do Popup
        let popupHtml = `<b>${order.customer?.name || order.cliente || 'Cliente'} #${orderNum}</b>${channelTag}<br>Status: <strong>${order.status}</strong>${timeInfo}`
        
        if (isAssigned) {
          popupHtml += `<br><span style="color: #3b82f6; font-weight: bold;"><i class="ph ph-motorcycle" style="font-size: 1.4em; margin-right: 8px;"></i> Entregador: ${motoboyName}</span>`
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


const reassignReturnedOrder = async (orderId, motoboyId) => {
  if (!motoboyId) return
  isReassigning.value = true
  const boy = motoboys.value.find(b => String(b.id) === String(motoboyId))
  const motoboyName = boy ? boy.name : 'Motoboy'

  try {
    await $fetch('/api/assign', {
      method: 'POST',
      body: { orderId, motoboyId: Number(motoboyId), motoboyName }
    })

    if (orderId !== 'DEMO_TUTORIAL') {
      $fetch(`/api/cw/api/partner/v1/orders/${orderId}/dispatch`, { method: 'POST' })
        .catch(() => {
          return $fetch(`/api/cw/api/partner/v1/orders/${orderId}/prepared`, { method: 'POST' })
            .then(() => $fetch(`/api/cw/api/partner/v1/orders/${orderId}/dispatch`, { method: 'POST' }))
            .catch((err2) => console.error('Erro ao despachar no Cardápio Web:', err2))
        })
    }

    delete selectedReassign.value[orderId]
    await fetchReturnedOrders()
    await fetchCwOrders()
  } catch (error) {
    console.error('Erro ao reatribuir pedido devolvido:', error)
  } finally {
    isReassigning.value = false
  }
}

const fetchReturnedOrders = async () => {
  if (userRole.value !== 'admin') return
  try {
    const data = await $fetch('/api/returned')
    returnedOrders.value = data || []
  } catch (e) {
    console.error('Erro ao buscar devolvidos', e)
  }
}

let cachedMerchant = null
let lastMerchantFetchTime = 0

const fetchCwOrders = async () => {
  if (userRole.value !== 'admin') return
  try {
    const summaryResponse = await $fetch('/api/cw/api/partner/v1/orders')
    
    // Processamento do status da loja
    try {
      const nowTs = Date.now()
      // Respeita o rate limit da Cardápio Web (máx 5 req/min no /merchant)
      if (!cachedMerchant || nowTs - lastMerchantFetchTime > 60000) {
        cachedMerchant = await $fetch('/api/cw/api/partner/v1/merchant').catch(err => {
          console.warn('Erro ao consultar /merchant:', err)
          return cachedMerchant
        })
        if (cachedMerchant) lastMerchantFetchTime = nowTs
      }

      const merchantData = cachedMerchant?.data || cachedMerchant
      const openingHours = merchantData?.opening_hours

      if (merchantData?.status === 'INACTIVE') {
        storeStatus.value = 'Loja Desativada'
      } else if (openingHours) {
        const tempState = openingHours.temporary_state
        const tempEndAt = openingHours.temporary_state_end_at ? new Date(openingHours.temporary_state_end_at).getTime() : null
        const isTempExpired = tempEndAt ? tempEndAt <= nowTs : false

        // 1. Sobreposição forçada de estado (temporary_state: open / closed)
        const isOpenOverride = tempState === 'open' && !isTempExpired
        const isClosedOverride = tempState === 'closed' && !isTempExpired

        if (isOpenOverride) {
          storeStatus.value = 'Loja Aberta'
        } else if (isClosedOverride) {
          storeStatus.value = 'Loja Fechada'
        } else {
          // 2. Horário de funcionamento regular
          const tz = openingHours.timezone || 'America/Sao_Paulo'
          const now = new Date()

          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).formatToParts(now)

          const getP = (t) => parts.find(p => p.type === t)?.value || ''
          const year = getP('year')
          const month = getP('month')
          const day = getP('day')
          const weekday = getP('weekday').toLowerCase() // 'sunday', 'monday', etc.
          const hour = parseInt(getP('hour'), 10) || 0
          const minute = parseInt(getP('minute'), 10) || 0
          const currentMins = hour * 60 + minute
          const todayDateStr = `${year}-${month}-${day}` // YYYY-MM-DD

          // Prioridade para custom_dates (feriados, datas personalizadas)
          let periods = null
          if (openingHours.custom_dates && openingHours.custom_dates[todayDateStr]) {
            periods = openingHours.custom_dates[todayDateStr].intervals
          } else if (openingHours[weekday]) {
            periods = openingHours[weekday]
          }

          let isOpen = false
          if (periods && periods.length) {
            for (const [startStr, endStr] of periods) {
              const [h1, m1] = startStr.split(':').map(Number)
              const [h2, m2] = endStr.split(':').map(Number)
              const startMins = h1 * 60 + m1
              // Se fecha às 00:00, considera fim do dia (24h = 1440 mins)
              let endMins = (endStr === '00:00' || (h2 === 0 && m2 === 0)) ? 24 * 60 : h2 * 60 + m2

              if (endMins >= startMins) {
                if (currentMins >= startMins && currentMins <= endMins) {
                  isOpen = true
                  break
                }
              } else {
                // Vira a noite (ex: 18:00 às 02:00)
                if (currentMins >= startMins || currentMins <= endMins) {
                  isOpen = true
                  break
                }
              }
            }
          }

          // Se não estiver aberto no horário de hoje, checa se o turno de ontem virou a madrugada
          if (!isOpen) {
            const daysList = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const prevDayIndex = (daysList.indexOf(weekday) + 6) % 7
            const prevDayName = daysList[prevDayIndex]
            const prevPeriods = openingHours[prevDayName] || []
            for (const [startStr, endStr] of prevPeriods) {
              const [h1, m1] = startStr.split(':').map(Number)
              const [h2, m2] = endStr.split(':').map(Number)
              const startMins = h1 * 60 + m1
              const endMins = h2 * 60 + m2
              if (endMins < startMins && currentMins <= endMins) {
                isOpen = true
                break
              }
            }
          }

          storeStatus.value = isOpen ? 'Loja Aberta' : 'Loja Fechada'
        }
      }
    } catch(e) {
      console.warn('Erro ao checar status da loja', e)
    }

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
    
    // Ordena de forma determinística por data de criação (mais antigos primeiro)
    // para que a chegada de novos pedidos não altere a posição dos pedidos já existentes
    fullOrders.sort((a, b) => {
      if (a.id === 'DEMO_TUTORIAL') return 1
      if (b.id === 'DEMO_TUTORIAL') return -1
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      if (timeA !== timeB) return timeA - timeB
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    })

    cwOrders.value = fullOrders

    // Aciona a repintura dos pinos
    updateAdminPins()
  } catch (error) {
    console.error('Erro ao buscar pedidos do Cardápio Web', error)
  }
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

const toggleAddForm = () => {
  showAddForm.value = !showAddForm.value
  addError.value = ''
  newDelivery.value = { name: '', login: '', password: '' }
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

/* Fab Botoes Premium */
.fab-motoboy, .fab-demo, .fab-taxas, .fab-devolvidos {
  position: absolute;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255,255,255,0.1);
  z-index: 1000;
  transition: var(--transition);
}
.fab-motoboy { bottom: 30px; right: 30px; width: auto; padding: 0 24px; border-radius: 28px; }
.fab-demo { bottom: 90px; right: 30px; border-radius: 16px; width: auto; padding: 0 20px; font-weight: 600; height: 48px; }
.fab-taxas { bottom: 150px; right: 30px; border-radius: 16px; width: auto; padding: 0 20px; font-weight: 600; height: 48px; }
.fab-devolvidos { bottom: 210px; right: 30px; border-radius: 16px; width: auto; padding: 0 20px; font-weight: 600; height: 48px; }

.fab-motoboy:hover, .fab-demo:hover, .fab-taxas:hover, .fab-devolvidos:hover {
  transform: translateY(-3px);
  box-shadow: 0 15px 30px -5px rgba(0,0,0,0.4);
}

.fab-motoboy-parar {
  position: absolute;
  top: 24px;
  left: 24px;
  padding: 12px 24px;
  border-radius: 100px;
  font-weight: 600;
  z-index: 1000;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slideDownFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.fab-motoboy-parar:hover {
  box-shadow: 0 10px 20px -10px rgba(239, 68, 68, 0.6);
}

@keyframes slideDownFade {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .fab-motoboy-parar {
    top: 16px;
    left: 16px;
    padding: 10px 18px;
    font-size: 14px;
  }
  .map-overlay-top {
    top: 70px;
  }
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-radius: 50%;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: var(--transition);
}
.btn-icon:hover { background: var(--color-surface-hover); transform: scale(1.05); }

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
/* .form-input herdado do main.css */
.btn-small { padding: 10px; font-size: 14px; }
.error-text { color: var(--color-error); font-size: 13px; margin: 0; text-align: center; }

/* Botoes compartilhados herdados do main.css */

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
  border-radius: 18px;
  min-width: 36px;
  height: 36px;
  padding: 0 4px;
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

/* Modal de Confirmação de Entrega (iFood / 99Food / Direto) */
.confirm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 21, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: fadeInModal 0.2s ease-out;
}

@keyframes fadeInModal {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirm-modal-card {
  width: 100%;
  max-width: 420px;
  background: rgba(30, 33, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUpModal {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.confirm-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.confirm-modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.confirm-modal-icon {
  font-size: 28px;
  background: rgba(255, 255, 255, 0.08);
  padding: 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-modal-title h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.confirm-modal-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 2px 0 0 0;
}

.confirm-modal-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
}

.confirm-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.platform-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  color: white;
  width: 100%;
}

.platform-btn-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.platform-logo {
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.platform-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.platform-text strong {
  font-size: 15px;
  font-weight: 600;
}

.platform-text small {
  font-size: 12px;
  opacity: 0.85;
}

.platform-arrow {
  font-size: 18px;
  font-weight: bold;
  opacity: 0.8;
}

.ifood-btn {
  background: linear-gradient(135deg, #ea1d2c 0%, #b9101d 100%);
  box-shadow: 0 4px 15px rgba(234, 29, 44, 0.35);
}
.ifood-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(234, 29, 44, 0.5);
}

.ninenine-btn {
  background: linear-gradient(135deg, #ff8c00 0%, #d97706 100%);
  box-shadow: 0 4px 15px rgba(255, 140, 0, 0.35);
}
.ninenine-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 140, 0, 0.5);
}

.direct-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}
.direct-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  transform: translateY(-2px);
}

.btn-cancel-modal {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  padding: 10px;
  cursor: pointer;
  border-radius: 8px;
  transition: var(--transition);
}
.btn-cancel-modal:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
}

.confirm-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.channel-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-ifood {
  background: rgba(234, 29, 44, 0.2);
  color: #ff4d5a;
  border: 1px solid rgba(234, 29, 44, 0.4);
}

.badge-99food {
  background: rgba(255, 140, 0, 0.2);
  color: #ffa033;
  border: 1px solid rgba(255, 140, 0, 0.4);
}

.badge-direct {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.badge-all {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.4);
}

.direct-highlight {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  border: none !important;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);
}
.direct-highlight:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
}

.btn-toggle-channel {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: 12px;
  padding: 4px;
  cursor: pointer;
  text-decoration: underline;
  opacity: 0.8;
  transition: var(--transition);
  text-align: center;
}
.btn-toggle-channel:hover {
  opacity: 1;
  color: var(--color-primary);
}

/* Indicador de Tela Sempre Ativa */
.badge-wakelock {
  position: absolute;
  top: 75px;
  left: 20px;
  z-index: 1000;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  transition: var(--transition);
  animation: slideDownFade 0.3s ease-out;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.badge-wakelock-active {
  background: rgba(16, 185, 129, 0.18);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.5);
}

.badge-wakelock-active .wakelock-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: pulseDot 2s infinite;
}

@keyframes pulseDot {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.25); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.badge-wakelock-inactive {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.5);
  animation: pulseAlert 1.5s infinite;
}

@keyframes pulseAlert {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
}

@media (max-width: 600px) {
  .badge-wakelock {
    top: 65px;
    left: 16px;
    padding: 5px 12px;
    font-size: 12px;
  }
}
</style>
