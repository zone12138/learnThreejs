<template>
  <div ref="containerRef" class="guangzhou-map-container">
    <div ref="districtInfoRef" class="district-info"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as d3 from 'd3'

import gzMapData from '../geoJson/广州市.js'
import groundMapData from '../geoJson/广东省.js'

const containerRef = ref(null) // 地图容器
const districtInfoRef = ref(null) // 区域信息容器

let scene, camera, renderer, controls, animationId
let groundMapGroup

const MAP_CONFIG = {
  scene: {
    background: 0x000000,
  },
  camera: {
    fov: 75,
    near: 0.1,
    far: 1000,
    position: {
      x: 0,
      y: 0,
      z: 5,
    },
  },
  renderer: {
    antialias: true,
    alpha: true,
  },
  projection: {
    center: [113.324521, 23.139056],
    scale: 1000,
    translate: [0, 0],
  },
}

const initScene = () => {
  const container = containerRef.value
  if (!container) return

  // 初始化场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(MAP_CONFIG?.scene?.background ?? 0x000000)

  const width = container.clientWidth,
    height = container.clientHeight
  // 初始化相机
  camera = new THREE.PerspectiveCamera(
    MAP_CONFIG?.camera?.fov ?? 75,
    width / height,
    MAP_CONFIG?.camera?.near ?? 0.1,
    MAP_CONFIG?.camera?.far ?? 1000,
  )
  // 相机位置设置
  camera.position.set(
    MAP_CONFIG?.camera?.position?.x ?? 0,
    MAP_CONFIG?.camera?.position?.y ?? 0,
    MAP_CONFIG?.camera?.position?.z ?? 5,
  )
  camera.lookAt(0, 0, 0) // 相机指向场景中心

  // 初始化渲染器
  renderer = new THREE.WebGLRenderer(MAP_CONFIG?.renderer ?? {})
  renderer.setSize(width, height) // 设置渲染器大小
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // 防止高分辨率设备渲染模糊
  renderer.shadowMap.enabled = true // 开启阴影渲染
  renderer.shadowMap.type = THREE.PCFSoftShadowMap // 软阴影渲染
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 色调映射
  renderer.toneMappingExposure = 1.25 // 曝光调整
  renderer.outputColorSpace = THREE.SRGBColorSpace // 输出颜色空间
  renderer.setClearColor(0x000000) // 设置渲染器清除颜色为黑色
  container.appendChild(renderer.domElement) // 将渲染器的DOM元素添加到地图容器中

  // 初始化轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true // 启用阻尼效果
  controls.dampingFactor = 0.05 // 阻尼系数
  controls.minDistance = 50 // 最小距离
  controls.maxDistance = 200 // 最大距离
  controls.update() // 更新控制器

  // TODO: 暂时先不管光照

  setupGround()

  // 启动动画循环
  animate()
}

// 初始化地面
const setupGround = () => {
  // 初始化地面几何体
  const groundGeometry = new THREE.PlaneGeometry(200, 200)
  // 初始化地面材质
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x031837, // 地面颜色
    metalness: 0, // 金属度
    roughness: 1, // 粗糙度
    opacity: 0.3, // 透明度
    transparent: true, // 透明
    colorSpace: THREE.SRGBColorSpace, // 颜色空间
  })
  // 初始化地面
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2 // 地面旋转90度，使其水平
  ground.position.z = -1 // 地面位置Y轴偏移，防止遮挡
  scene.add(ground) // 将地面添加到场景中

  groundMapGroup = createGroundMap(groundMapData)
}

// 创建地面地图
const createGroundMap = (mapShapeData) => {
  // 初始化地面地图组
  const mapGroup = new THREE.Object3D()
  scene.add(mapGroup) // 将地面地图组添加到场景中

  // 初始化投影
  const projection = d3
    .geoMercator()
    .center(MAP_CONFIG.projection.center)
    .scale(MAP_CONFIG.projection.scale)
    .translate(MAP_CONFIG.projection.translate)

  // 遍历地面地图数据
  mapShapeData.features.forEach((feature) => {
    const geometryType = feature.geometry.type
    const coordinates = feature.geometry.coordinates
    const cityName = feature.properties.name

    if (geometryType === 'Polygon') {
      coordinates.forEach((ring) => {
        // 收集有效坐标
        const validCoords = []
        ring.forEach((coord) => {
          try {
            const [x, y] = projection(coord)
            if (!isNaN(x) && !isNaN(y)) {
              validCoords.push([x, -y])
            }
          } catch (error) {
            // 忽略无效坐标
          }
        })

        // 创建地图形状
        const mapShapeMesh = createMapShapeMesh(validCoords)
        if (mapShapeMesh) {
          mapShapeMesh.userData.cityName = cityName
          mapGroup.add(mapShapeMesh)
        }
      })
    } else if (geometryType === 'MultiPolygon') {
      coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          // 收集有效坐标
          const validCoords = []
          ring.forEach((coord) => {
            try {
              const [x, y] = projection(coord)
              if (!isNaN(x) && !isNaN(y)) {
                validCoords.push([x, -y])
              }
            } catch (error) {
              // 忽略无效坐标
            }
          })

          // 创建地图形状
          const mapShapeMesh = createMapShapeMesh(validCoords)
          if (mapShapeMesh) {
            mapShapeMesh.userData.cityName = cityName
            mapGroup.add(mapShapeMesh)
          }
        })
      })
    }
  })

  return mapGroup
}

// 创建地图形状
const createMapShapeMesh = (validCoords, color = 0xf5f5dc) => {
  // 收集有效坐标
  if (validCoords.length > 2) {
    try {
      // 创建形状
      const shape = new THREE.Shape()
      validCoords.forEach((coord, i) => {
        if (i === 0) {
          shape.moveTo(coord[0], coord[1])
        } else {
          shape.lineTo(coord[0], coord[1])
        }
      })

      // 确保形状闭合
      shape.closePath()

      // 创建薄薄的拉伸几何体，设置很小的深度
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0, // 薄薄的一层，只有0.1深度
        bevelEnabled: false,
      })

      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()

      // 使用MeshBasicMaterial数组，完全不受光照影响，避免鳞片状反光
      // ExtrudeGeometry需要为不同面提供材质
      const materials = [
        new THREE.MeshBasicMaterial({ color }), // 正面
        new THREE.MeshBasicMaterial({ color }), // 侧面
        new THREE.MeshBasicMaterial({ color }), // 顶面/底面
      ]

      // 创建网格
      const mesh = new THREE.Mesh(geometry, materials)
      mesh.userData = {
        originalColor: color,
      }

      // 创建区域轮廓线，增强边界清晰度
      const edges = new THREE.EdgesGeometry(geometry)
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 1,
        transparent: true,
        opacity: 0.8,
      })
      const outline = new THREE.LineSegments(edges, lineMaterial)
      mesh.add(outline)

      return mesh
    } catch (error) {
      console.warn('Failed to create shape for China map feature:', error)
    }
  }
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls && controls.update() // 更新控制器
  renderer && scene && camera && renderer.render(scene, camera) // 渲染场景
}

onMounted(() => {
  initScene()
})
</script>

<style scoped>
.guangzhou-map-container {
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
