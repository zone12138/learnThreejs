<template>
  <div ref="container" style="width: 100vw; height: 100vh"></div>
</template>

<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useThreejsGUI } from '@/hooks/GUI'
import { ref, onMounted, onUnmounted } from 'vue'
import guangdongGeoJson from '@/geoJson/广东省.js'

console.log(guangdongGeoJson)

// 场景容器
const container = ref(null)

// Three.js核心对象
let scene, camera, renderer, controls

// 地图和飞线相关对象
let mapMesh,
  flyLines = []

// 动画相关
let animationId = null

// 下钻状态
let isDrilling = false
let drillTarget = null
let drillProgress = 0

// 初始化Three.js场景
function initScene() {
  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x001122)

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    60,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    1000,
  )
  // 调整相机位置以完整显示更大的地图
  camera.position.set(0, 25, 35)
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.value.appendChild(renderer.domElement)

  // 创建控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  scene.add(directionalLight)

  // 添加网格辅助线
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
  scene.add(gridHelper)
}

// 创建广东地图（使用真实GeoJSON数据）
function createGuangdongMap() {
  // 提取所有坐标点，计算边界范围
  let minLon = Infinity,
    maxLon = -Infinity
  let minLat = Infinity,
    maxLat = -Infinity

  // 收集所有坐标点
  const allPoints = []

  // 处理所有features
  guangdongGeoJson.features.forEach((feature) => {
    const geometry = feature.geometry
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          ring.forEach((point) => {
            const lon = point[0]
            const lat = point[1]
            minLon = Math.min(minLon, lon)
            maxLon = Math.max(maxLon, lon)
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
            allPoints.push({ lon, lat })
          })
        })
      })
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((multiPolygon) => {
        multiPolygon.forEach((polygon) => {
          polygon.forEach((ring) => {
            ring.forEach((point) => {
              const lon = point[0]
              const lat = point[1]
              minLon = Math.min(minLon, lon)
              maxLon = Math.max(maxLon, lon)
              minLat = Math.min(minLat, lat)
              maxLat = Math.max(maxLat, lat)
              allPoints.push({ lon, lat })
            })
          })
        })
      })
    }
  })

  // 定义全局mapBounds
  window.mapBounds = {
    minLon,
    maxLon,
    minLat,
    maxLat,
  }

  // 坐标归一化函数
  const normalizePoint = (lon, lat) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 30 - 15
    const z = ((lat - minLat) / (maxLat - minLat)) * 20 - 10
    return { x, z }
  }

  // 创建形状
  const shapes = []

  // 处理所有features创建形状
  guangdongGeoJson.features.forEach((feature) => {
    const geometry = feature.geometry
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          const shape = new THREE.Shape()
          ring.forEach((point, index) => {
            const { x, z } = normalizePoint(point[0], point[1])
            if (index === 0) {
              shape.moveTo(x, z)
            } else {
              shape.lineTo(x, z)
            }
          })
          shapes.push(shape)
        })
      })
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((multiPolygon) => {
        multiPolygon.forEach((polygon) => {
          polygon.forEach((ring) => {
            const shape = new THREE.Shape()
            ring.forEach((point, index) => {
              const { x, z } = normalizePoint(point[0], point[1])
              if (index === 0) {
                shape.moveTo(x, z)
              } else {
                shape.lineTo(x, z)
              }
            })
            shapes.push(shape)
          })
        })
      })
    }
  })

  // 创建拉伸几何体
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.5,
    bevelEnabled: false,
  })

  // 创建材质
  const material = new THREE.MeshPhongMaterial({
    color: 0x228b22,
    side: THREE.DoubleSide,
    flatShading: true,
  })

  // 创建地图网格
  mapMesh = new THREE.Mesh(geometry, material)
  mapMesh.rotation.x = -Math.PI / 2
  mapMesh.position.y = 0
  scene.add(mapMesh)

  // 添加边框
  const edges = new THREE.EdgesGeometry(geometry)
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 })
  const line = new THREE.LineSegments(edges, lineMaterial)
  mapMesh.add(line)

  return mapMesh
}

// 生成随机城市坐标（在真实地图边界内）
function generateCities(count) {
  const cities = []

  // 使用全局mapBounds变量
  const mapBounds = window.mapBounds || { 
    minLon: 110.0, 
    maxLon: 117.0, 
    minLat: 20.0, 
    maxLat: 25.0 
  }

  // 坐标归一化函数（与地图使用相同的转换）
  const normalizePoint = (lon, lat) => {
    // 确保分母不为零
    const lonRange = mapBounds.maxLon - mapBounds.minLon || 1
    const latRange = mapBounds.maxLat - mapBounds.minLat || 1
    
    const x = ((lon - mapBounds.minLon) / lonRange) * 30 - 15
    const z = ((lat - mapBounds.minLat) / latRange) * 20 - 10
    
    // 确保坐标不是NaN
    return {
      x: isNaN(x) ? 0 : x,
      z: isNaN(z) ? 0 : z
    }
  }

  for (let i = 0; i < count; i++) {
    // 在地图边界内随机生成经纬度
    const lon = mapBounds.minLon + Math.random() * (mapBounds.maxLon - mapBounds.minLon)
    const lat = mapBounds.minLat + Math.random() * (mapBounds.maxLat - mapBounds.minLat)

    const { x, z } = normalizePoint(lon, lat)

    cities.push({
      name: `City ${i + 1}`,
      position: new THREE.Vector3(x, 0.6, z), // y坐标高于地图表面
    })
  }
  return cities
}

// 创建飞线
function createFlyLines(cities, count) {
  flyLines = []

  for (let i = 0; i < count; i++) {
    // 随机选择起点和终点
    const startCity = cities[Math.floor(Math.random() * cities.length)]
    let endCity
    do {
      endCity = cities[Math.floor(Math.random() * cities.length)]
    } while (startCity === endCity)

    // 确保城市坐标有效
    const startPos = startCity.position.clone()
    const endPos = endCity.position.clone()
    
    // 检查坐标是否为NaN
    if (isNaN(startPos.x) || isNaN(startPos.y) || isNaN(startPos.z) ||
        isNaN(endPos.x) || isNaN(endPos.y) || isNaN(endPos.z)) {
      console.warn('Invalid city coordinates detected, skipping fly line')
      continue
    }

    // 创建飞线路径
    const midX = (startPos.x + endPos.x) / 2
    const midY = Math.random() * 5 + 2
    const midZ = (startPos.z + endPos.z) / 2
    
    // 确保中间点坐标有效
    const midPos = new THREE.Vector3(
      isNaN(midX) ? 0 : midX,
      isNaN(midY) ? 3 : midY,
      isNaN(midZ) ? 0 : midZ
    )
    
    const curve = new THREE.QuadraticBezierCurve3(
      startPos,
      midPos,
      endPos
    )

    // 创建飞线几何体
    const points = curve.getPoints(50)
    
    // 过滤掉可能的NaN点
    const validPoints = points.filter(point => 
      !isNaN(point.x) && !isNaN(point.y) && !isNaN(point.z)
    )
    
    if (validPoints.length < 2) {
      console.warn('Not enough valid points for fly line, skipping')
      continue
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(validPoints)
    
    try {
      geometry.computeBoundingSphere() // 预计算边界球
    } catch (e) {
      console.warn('Failed to compute bounding sphere, skipping fly line')
      continue
    }

    // 创建材质
    const material = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    })

    // 创建飞线
    const flyLine = new THREE.Line(geometry, material)
    scene.add(flyLine)

    // 存储飞线信息
    flyLines.push({
      line: flyLine,
      curve: curve,
      progress: Math.random(), // 随机初始进度
      speed: Math.random() * 0.005 + 0.001, // 随机速度
    })
  }
}

// 更新飞线动画
function updateFlyLines() {
  flyLines.forEach((flyLine) => {
    // 更新进度
    flyLine.progress += flyLine.speed
    if (flyLine.progress > 1) {
      flyLine.progress = 0
    }

    // 更新飞线位置
    const points = flyLine.curve.getPoints(50)
    flyLine.line.geometry.setFromPoints(points)
    
    // 正确更新BufferGeometry - BufferGeometry没有verticesNeedUpdate属性
    // 当使用setFromPoints时，Three.js会自动更新attribute
    if (flyLine.line.geometry.attributes.position) {
      flyLine.line.geometry.attributes.position.needsUpdate = true
    }
    
    flyLine.line.geometry.computeBoundingSphere() // 重新计算边界球

    // 更新飞线透明度
    flyLine.line.material.opacity = Math.sin(flyLine.progress * Math.PI) * 0.8 + 0.2
  })
}

// 实现下钻功能
function drillDown(targetPosition) {
  isDrilling = true
  drillTarget = targetPosition.clone()
  drillProgress = 0
}

// 更新下钻动画
function updateDrillDown() {
  if (isDrilling) {
    drillProgress += 0.02
    if (drillProgress >= 1) {
      drillProgress = 1
      isDrilling = false
    }

    // 平滑过渡相机位置
    const startPosition = new THREE.Vector3(0, 10, 20)
    const endPosition = drillTarget.clone().add(new THREE.Vector3(0, 5, 10))

    camera.position.lerpVectors(startPosition, endPosition, drillProgress)
    camera.lookAt(drillTarget)
  }
}

// 动画循环
function animate() {
  animationId = requestAnimationFrame(animate)

  controls.update()
  updateFlyLines()
  updateDrillDown()

  renderer.render(scene, camera)
}

// 窗口大小调整
function handleResize() {
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
}

// 点击事件处理
function handleClick(event) {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()

  mouse.x = (event.clientX / container.value.clientWidth) * 2 - 1
  mouse.y = -(event.clientY / container.value.clientHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObject(mapMesh)
  if (intersects.length > 0) {
    // 点击地图，执行下钻
    drillDown(intersects[0].point)
  }
}

// 初始化
onMounted(() => {
  initScene()
  createGuangdongMap() // 先创建地图，计算边界
  const cities = generateCities(10) // 再生成城市
  createFlyLines(cities, 20)
  animate()

  window.addEventListener('resize', handleResize)
  container.value.addEventListener('click', handleClick)

  // 添加GUI控制
  useThreejsGUI({ camera, mesh: mapMesh, scene }, { title: '3D地图控制' })
})

// 清理
onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', handleResize)
  container.value.removeEventListener('click', handleClick)

  if (renderer) {
    renderer.dispose()
    container.value.removeChild(renderer.domElement)
  }
})
</script>

<style scoped>
div {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
