import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

/**
 * 路由按用途分组：
 * - maps/：真实地理数据页面（省/市地图、飞线下钻）
 * - demos/：组件能力演示（网格、平面地图、基础场景、热力图）
 * meta.title 用于导航栏显示，避免把英文路由名直接暴露在界面上。
 */
const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'home',
    component: HomeView,
    meta: { title: '首页' },
  },

  // —— 真实地理数据 ——
  {
    path: '/guangdong',
    name: 'guangdong-province-map',
    component: () => import('../views/maps/GuangdongProvinceMap.vue'),
    meta: { title: '广东省地图' },
  },
  {
    path: '/guangzhou',
    name: 'guangzhou-city-map',
    component: () => import('../views/maps/GuangzhouCityMap.vue'),
    meta: { title: '广州市地图' },
  },
  {
    path: '/guangzhou-hook',
    name: 'guangzhou-city-map-by-hook',
    component: () => import('../views/maps/GuangzhouCityMapByHook.vue'),
    meta: { title: '广州市地图（Hook）' },
  },
  {
    path: '/flyline',
    name: 'flyline-map',
    component: () => import('../views/maps/FlyLineMap.vue'),
    meta: { title: '飞线与下钻' },
  },

  // —— 组件能力演示 ——
  {
    path: '/grid-map',
    name: 'grid-map-demo',
    component: () => import('../views/demos/GridMapDemo.vue'),
    meta: { title: '网格 3D 地图' },
  },
  {
    path: '/flat-map',
    name: 'flat-map-demo',
    component: () => import('../views/demos/FlatMapDemo.vue'),
    meta: { title: '平面地图组合' },
  },
  {
    path: '/basic-scene',
    name: 'basic-scene-demo',
    component: () => import('../views/demos/BasicSceneDemo.vue'),
    meta: { title: '基础场景' },
  },
  {
    path: '/camera-gui',
    name: 'camera-gui-demo',
    component: () => import('../views/demos/CameraGuiDemo.vue'),
    meta: { title: '相机与调试面板' },
  },
  {
    path: '/heatmap',
    name: 'heatmap-demo',
    component: () => import('../views/demos/HeatmapDemo.vue'),
    meta: { title: '2D 热力图' },
  },

  // —— 旧路径兼容：重命名后保留重定向，避免既有书签 404 ——
  { path: '/map1', redirect: '/grid-map' },
  { path: '/map2', redirect: '/flat-map' },
  { path: '/map3', redirect: '/basic-scene' },
  { path: '/demo4', redirect: '/camera-gui' },
  { path: '/demo4-heatmap', redirect: '/heatmap' },
  { path: '/guangdong-map', redirect: '/guangdong' },
  { path: '/guangzhou-map', redirect: '/guangzhou' },
  { path: '/guangzhou-map-by-hooks', redirect: '/guangzhou-hook' },

  {
    // 404 兜底：未匹配路径重定向回首页，避免空白页
    path: '/:pathMatch(.*)*',
    redirect: '/home',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 路由标题：浏览器 tab 与导航栏共用 meta.title
router.afterEach((to) => {
  const title = to.meta?.title
  document.title = title ? `${title} · Three.js 学习` : 'Three.js 学习'
})

export default router
