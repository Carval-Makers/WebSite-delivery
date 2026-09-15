<template>
  <div class="login-container">
    <div class="login-card glass-panel">
      <div class="login-header">
        <h1>Bem-vindo</h1>
        <p>Faça login para continuar</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="login">Login</label>
          <input 
            type="text" 
            id="login" 
            v-model="login" 
            placeholder="Digite seu login" 
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="password">Senha</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            placeholder="••••••••" 
            required
            class="form-input"
          />
        </div>

        <div class="form-actions">
          <a href="#" class="forgot-password">Esqueceu a senha?</a>
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button type="submit" class="btn-primary" :disabled="isLoading">
          <span v-if="isLoading">Entrando...</span>
          <span v-else>Entrar</span>
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
  background: radial-gradient(circle at 50% -20%, #1e1b4b 0%, var(--color-bg) 60%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.5s ease-out;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(to right, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.login-header p {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.forgot-password {
  font-size: 13px;
  font-weight: 500;
}

.error-message {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
