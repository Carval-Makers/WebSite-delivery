<template>
  <div class="login-container">
    <div class="login-card glass-panel">
      <div class="login-header">
        <div class="login-icon-badge">
          <i class="ph ph-moped" style="font-size: 2rem; color: var(--color-primary);"></i>
        </div>
        <h1>WebSite Delivery</h1>
        <p>Acesse com suas credenciais para continuar</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="login">Login</label>
          <div class="input-with-icon">
            <i class="ph ph-user input-icon"></i>
            <input 
              type="text" 
              id="login" 
              v-model="login" 
              placeholder="Digite seu login" 
              required
              class="form-input"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="password">Senha</label>
          <div class="input-with-icon">
            <i class="ph ph-lock-key input-icon"></i>
            <input 
              type="password" 
              id="password" 
              v-model="password" 
              placeholder="••••••••" 
              required
              class="form-input"
            />
          </div>
        </div>

        <div v-if="errorMessage" class="error-message">
          <i class="ph ph-warning-circle" style="font-size: 1.1em;"></i>
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading" style="width: 100%; margin-top: 8px;">
          <span v-if="isLoading" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="ph ph-spinner ph-spin"></i> Entrando...
          </span>
          <span v-else style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="ph ph-sign-in" style="font-size: 1.2em;"></i> Entrar no Sistema
          </span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const login = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await $fetch('/api/login', {
      method: 'POST',
      body: {
        login: login.value,
        password: password.value
      }
    })

    console.log('Usuário logado:', response.user)
    localStorage.setItem('user', JSON.stringify(response.user))
    router.push('/mapa')
  } catch (error) {
    if (error.data && error.data.statusMessage) {
      errorMessage.value = error.data.statusMessage
    } else {
      errorMessage.value = 'Ocorreu um erro ao tentar fazer login.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: radial-gradient(circle at 50% 10%, #18182e 0%, var(--color-bg) 70%);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 36px 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  animation: slideUp 0.4s ease-out;
}

.login-icon-badge {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 16px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
  background: linear-gradient(135deg, #ffffff 0%, #a1a1aa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.login-header p {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: var(--color-text-muted);
  font-size: 1.15em;
  pointer-events: none;
}

.input-with-icon .form-input {
  padding-left: 42px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  padding: 10px 14px;
  border-radius: var(--border-radius-sm);
  font-size: 13px;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
