<template>
  <div ref="containerRef" class="guangdong-map-container">
    <div ref="infoRef" class="district-info"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import * as d3 from 'd3'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import guangdongData from '../geoJson/广东省.js'

// 组件状态
const containerRef = ref(null)
const infoRef = ref(null)
let scene, camera, renderer, controls, animationId
let mapGroup = null
let raycaster = null
let mouse = new THREE.Vector2()
let activeDistrict = null
let labels = []

// 地图配置
const MAP_CONFIG = {
  projection: {
    center: [113.2, 23.3],
    scale: 1200,
    translate: [0, 0]
  },
  colors: {
    district: ['#0465BD', '#357bcb', '#3a7abd'],
    highlight: '#4fa5ff',
    background: 'transparent'
  },
  extrusion: {
    depth: 6,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelThickness: 0.3
  },
  camera: {
    fov: 45,
    near: 0.1,
    far: 5000,
    position: { x: 0, y: -80, z: 150 }
  }
}

// 初始化Three.js场景
const initScene = () => {
  const container = containerRef.value
  if (!container) return

  // 创建场景
  scene = new THREE.Scene()
  scene.background = MAP_CONFIG.colors.background

  // 创建相机
  const width = container.clientWidth
  const height = container.clientHeight
  camera = new THREE.PerspectiveCamera(
    MAP_CONFIG.camera.fov,
    width / height,
    MAP_CONFIG.camera.near,
    MAP_CONFIG.camera.far
  )
  camera.position.set(
    MAP_CONFIG.camera.position.x,
    MAP_CONFIG.camera.position.y,
    MAP_CONFIG.camera.position.z
  )
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  // 创建轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 50
  controls.maxDistance = 200
  controls.update()

  // 初始化射线检测
  raycaster = new THREE.Raycaster()

  // 设置光照
  setupLights()

  // 设置地面
  setupGround()

  // 加载地图数据
  loadMapData()

  // 添加事件监听
  addEventListeners()

  // 开始动画循环
  animate()
}

// 设置光照系统
const setupLights = () => {
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  // 主方向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(50, -100, 50)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.left = -100
  directionalLight.shadow.camera.right = 100
  directionalLight.shadow.camera.top = 100
  directionalLight.shadow.camera.bottom = -100
  scene.add(directionalLight)

  // 辅助方向光
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
  directionalLight2.position.set(-50, -50, 30)
  scene.add(directionalLight2)

  // 半球光
  const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x0c0c0c, 0.4)
  hemisphereLight.position.set(0, -50, 0)
  scene.add(hemisphereLight)
}

// 设置地面
const setupGround = () => {
  const groundGeometry = new THREE.PlaneGeometry(200, 200)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x031837,
    metalness: 0,
    roughness: 1,
    opacity: 0.3,
    transparent: true,
    colorSpace: THREE.SRGBColorSpace
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.z = -1
  ground.receiveShadow = true
  scene.add(ground)
}

// 加载地图数据
const loadMapData = () => {
  // 创建地图组
  mapGroup = new THREE.Object3D()
  scene.add(mapGroup)

  // 创建墨卡托投影
  const projection = d3.geoMercator()
    .center(MAP_CONFIG.projection.center)
    .scale(MAP_CONFIG.projection.scale)
    .translate(MAP_CONFIG.projection.translate)

  // 遍历广东省各地区
  guangdongData.features.forEach((feature, index) => {
    createDistrict(feature, projection, index)
  })
}

// 创建单个地区
const createDistrict = (feature, projection, index) => {
  const districtGroup = new THREE.Object3D()
  districtGroup.userData = {
    name: feature.properties.name,
    adcode: feature.properties.adcode
  }

  // 获取颜色
  const color = MAP_CONFIG.colors.district[index % MAP_CONFIG.colors.district.length]

  // 处理坐标
  const coordinates = feature.geometry.coordinates
  coordinates.forEach((multiPolygon) => {
    multiPolygon.forEach((polygon) => {
      // 创建形状
      const shape = new THREE.Shape()
      polygon.forEach((coord, i) => {
        const [x, y] = projection(coord)
        if (i === 0) {
          shape.moveTo(x, -y)
        } else {
          shape.lineTo(x, -y)
        }
      })

      // 创建几何体
      const geometry = new THREE.ExtrudeGeometry(shape, MAP_CONFIG.extrusion)

      // 创建材质
      const materials = [
        // 正面材质
        new THREE.MeshStandardMaterial({
          color: color,
          clearcoat: 1.0,
          metalness: 0.7,
          roughness: 0.3,
          colorSpace: THREE.SRGBColorSpace
        }),
        // 侧面材质
        new THREE.MeshStandardMaterial({
          color: color,
          clearcoat: 1.0,
          metalness: 0.7,
          roughness: 0.5,
          colorSpace: THREE.SRGBColorSpace
        })
      ]

      // 创建网格
      const mesh = new THREE.Mesh(geometry, materials)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = {
        originalColor: color,
        district: districtGroup
      }

      // 添加到地区组
      districtGroup.add(mesh)
    })
  })

  // 添加地区名称标签
  if (feature.properties.centroid) {
    const [x, y] = projection(feature.properties.centroid)
    createDistrictLabel(feature.properties.name, x, -y)
  }

  // 添加到地图组
  mapGroup.add(districtGroup)
}

// 创建地区标签
const createDistrictLabel = (name, x, y) => {
  // 创建画布
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const fontSize = 10
  ctx.font = `${fontSize}px Arial`
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 测量文本宽度
  const textWidth = ctx.measureText(name).width
  canvas.width = textWidth + 8
  canvas.height = fontSize + 6

  // 重新设置上下文
  ctx.font = `${fontSize}px Arial`
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 绘制文本
  ctx.fillText(name, canvas.width / 2, canvas.height / 2)

  // 创建纹理
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  // 创建精灵材质
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9
  })

  // 创建精灵
  const sprite = new THREE.Sprite(material)
  sprite.position.set(x, y, 8)
  sprite.scale.set(canvas.width / 8, canvas.height / 8, 1)
  scene.add(sprite)

  // 保存标签引用
  labels.push({ sprite, material, texture })
}

// 添加事件监听
const addEventListeners = () => {
  const container = containerRef.value
  if (!container) return

  // 鼠标移动事件
  container.addEventListener('mousemove', handleMouseMove)
  
  // 窗口大小变化事件
  window.addEventListener('resize', handleResize)
}

// 移除事件监听
const removeEventListeners = () => {
  const container = containerRef.value
  if (container) {
    container.removeEventListener('mousemove', handleMouseMove)
  }
  window.removeEventListener('resize', handleResize)
}

// 处理鼠标移动
const handleMouseMove = (event) => {
  const container = containerRef.value
  if (!container || !raycaster || !mapGroup) return

  // 计算鼠标位置
  const rect = container.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
  const y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1
  mouse.set(x, y)

  // 更新射线
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(mapGroup.children, true)

  // 恢复之前选中的地区颜色
  if (activeDistrict) {
    activeDistrict.material.forEach((mat, index) => {
      mat.color.set(activeDistrict.userData.originalColor)
    })
    activeDistrict = null
  }

  // 查找相交的地区
  let hitDistrict = null
  for (const intersect of intersects) {
    if (intersect.object.userData.district) {
      hitDistrict = intersect.object
      break
    }
  }

  // 高亮显示相交的地区
  if (hitDistrict) {
    activeDistrict = hitDistrict
    hitDistrict.material.forEach((mat) => {
      mat.color.set(MAP_CONFIG.colors.highlight)
    })
    
    // 更新信息面板
    updateDistrictInfo(hitDistrict.userData.district.userData)
  } else {
    // 隐藏信息面板
    updateDistrictInfo(null)
  }
}

// 更新地区信息
const updateDistrictInfo = (districtData) => {
  const info = infoRef.value
  if (!info) return

  if (districtData) {
    info.textContent = districtData.name
    info.style.visibility = 'visible'
    info.style.left = `${event.clientX - info.offsetWidth / 2}px`
    info.style.top = `${event.clientY - 30}px`
  } else {
    info.style.visibility = 'hidden'
  }
}

// 处理窗口大小变化
const handleResize = () => {
  const container = containerRef.value
  if (!container || !camera || !renderer) return

  const width = container.clientWidth
  const height = container.clientHeight
  
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  if (controls) {
    controls.update()
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// 清理资源
const cleanup = () => {
  // 停止动画
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  // 移除事件监听
  removeEventListeners()

  // 清理标签
  labels.forEach(label => {
    scene.remove(label.sprite)
    label.material.dispose()
    label.texture.dispose()
  })
  labels = []

  // 清理地图组
  if (mapGroup) {
    scene.remove(mapGroup)
    mapGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    mapGroup = null
  }

  // 清理渲染器
  if (renderer) {
    renderer.dispose()
    const container = containerRef.value
    if (container && renderer.domElement) {
      container.removeChild(renderer.domElement)
    }
  }

  // 重置所有引用
  scene = null
  camera = null
  renderer = null
  controls = null
  raycaster = null
  activeDistrict = null
}

// 生命周期钩子
onMounted(() => {
  initScene()
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.guangdong-map-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #000000;
}

.district-info {
  position: fixed;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.7);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  user-select: none;
  pointer-events: none;
  z-index: 100;
  visibility: hidden;
  transform: translate(-50%, -100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>