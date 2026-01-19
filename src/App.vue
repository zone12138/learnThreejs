<script setup>
import { shallowRef } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
const router = useRouter()
const routes = shallowRef(router?.options?.routes || [])
</script>

<template>
  <div class="app-container">
    <header>
      <nav>
        <RouterLink v-for="route in routes" :key="route.path" :to="route.path">
          {{ route.name }}
        </RouterLink>
      </nav>
    </header>
    <div class="app-content">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
/* 主容器 */
.app-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

/* 头部区域 */
header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

/* 导航菜单 */
nav {
  width: 100%;
  text-align: center;
}

nav a {
  display: inline-block;
  padding: 0.8rem 1.5rem;
  color: white;
  text-decoration: none;
  font-weight: 500;
  font-size: 1rem;
  border-radius: 25px;
  margin: 0 0.5rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* 导航链接悬停效果 */
nav a:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

/* 当前激活链接 */
nav a.router-link-exact-active {
  background: rgba(255, 255, 255, 0.3);
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

/* 移除边框样式 */
nav a:first-of-type {
  border: none;
}

/* 内容区域 */
.app-content {
  flex: 1;
  overflow: hidden;
  background-color: #f5f7fa;
}

/* 响应式设计 */
@media (max-width: 768px) {
  header {
    padding: 0.8rem 1rem;
  }

  nav a {
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    margin: 0 0.2rem;
  }
}

@media (max-width: 480px) {
  nav {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
  }

  nav a {
    margin: 0.2rem;
    padding: 0.5rem 0.8rem;
  }
}
</style>
