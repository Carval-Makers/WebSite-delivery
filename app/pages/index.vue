<template>
  <div class="loading-container">
    <div class="loader"></div>
    <p class="loading-text">Redirecionando...</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.push('/login')
})
</script>

<style scoped>
.loading-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background-color: var(--color-bg);
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: 14px;
}
</style>
