import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/map1',
    },
    // {
    //   path: '/flyline',
    //   name: 'flyline',
    //   component: () => import('../views/FlyLine.vue'),
    // },
    // {
    //   path: '/guangdong-map',
    //   name: 'guangdong-map',
    //   component: () => import('../views/GuangdongMap.vue'),
    // },
    // {
    //   path: '/guangzhou-map',
    //   name: 'guangzhou-map',
    //   component: () => import('../views/GuangzhouMap.vue'),
    // },
    // {
    //   path: '/guangzhou-map-by-hooks',
    //   name: 'guangzhou-map-by-hooks',
    //   component: () => import('../views/GuangzhouMapByHooks.vue'),
    // },
    {
      path: '/map1',
      name: 'map1',
      component: () => import('../views/Map1.vue'),
    },
  ],
})

export default router
