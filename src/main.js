import './styles/index.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  console.error('Vue 错误:', err, instance, info)
}

app.use(router)

app.mount('#app')
