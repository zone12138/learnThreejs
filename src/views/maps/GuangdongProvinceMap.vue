<template>
  <div ref="containerRef" class="demo-stage demo-stage--viewport">
    <canvas ref="mapCanvas"></canvas>
    <div ref="infoRef" class="demo-tooltip"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'
import { useThree } from '@/hooks/useThree'
import { loadGeoJson } from '@/utils/geoLoader'
import { PROJECTION } from '@/threejs/config/geo'
import { forEachRing, createRingGeometry } from '@/threejs/utils/geoShape'

const containerRef = ref(null)
const mapCanvas = ref(null)
const infoRef = ref(null)

let raycaster = null
let mouse = new THREE.Vector2()
let activeDistrict = null
let labels = []
let flyLines = []
let flyLineGroup = null
let mapGroup = null
let chinaMapGroup = null

// 飞线配置 - 简化设计
const FLY_LINE_CONFIG = {
  startPoint: { x: 0, y: 0, z: 8 }, // 天河区中心点，将在加载地图后更新
  line: {
    color: 0x87ceeb, // 浅蓝色，更浅的颜色
    opacity: 0.6, // 降低不透明度，让飞线更柔和
    width: 1,
  },
  animation: {
    duration: 2000, // 飞线动画持续时间，缩短以加快流动
    delay: 0, // 移除延迟，所有飞线同时开始
    flowSpeed: 4.0, // 增加基础流动速度，让动画更快
    curvature: 0.8, // 弧度系数，增大以增加弧度
  },
  flow: {
    color: 0x00ffff, // 流动效果颜色
    opacity: 1.0, // 流动效果透明度，增大以更明显
    width: 2, // 流动效果宽度
    dashSize: 0.1, // 缩短流动线段长度
    gapSize: 0.9, // 调整间隔，确保每条飞线只有一个流动线段
  },
}

// 中国底图填充色（米白）
const CHINA_BASE_COLOR = 0xf5f5dc

// 地图配置
const MAP_CONFIG = {
  projection: PROJECTION.guangdongWide,
  colors: {
    district: ['#0465BD', '#357bcb', '#3a7abd'],
    highlight: '#4fa5ff',
    background: 0x000000,
  },
  extrusion: {
    depth: 6,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelThickness: 0.3,
  },
}

// 场景/相机/渲染器/控制器/渲染循环/清理统一由 BasicThreejs 承担
const three = useThree(mapCanvas, {
  cameraOpts: {
    fov: 45,
    near: 0.1,
    far: 5000,
    position: new THREE.Vector3(0, -80, 150),
  },
  rendererOpts: {
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.25,
    shadow: true,
    clearColor: 0x000000,
  },
  controlsOpts: {
    minDistance: 50,
    maxDistance: 200,
    dampingFactor: 0.05,
  },
  useInteraction: false,
})

onMounted(async () => {
  const map = three.value
  if (!map) return
  map.camera.lookAt(0, 0, 0)
  map.scene.background = new THREE.Color(MAP_CONFIG.colors.background)

  // 初始化射线检测
  raycaster = new THREE.Raycaster()

  // 设置光照
  setupLights()

  // 设置地面和中国地图底图
  setupGround()

  // 创建飞线组
  flyLineGroup = new THREE.Object3D()
  map.scene.add(flyLineGroup)

  // 加载地图数据（按需 fetch，不进 bundle）
  const [guangdongData, chinaData] = await Promise.all([
    loadGeoJson('guangdong-districts'),
    loadGeoJson('china-districts'),
  ])
  loadMapData(guangdongData)
  createChinaMapBase(chinaData)

  // 添加事件监听
  addEventListeners()

  // 每帧更新飞线动画（渲染与控制器更新由基座负责）
  map.tickClock.onTick(() => {
    updateFlyLines()
  })
})

onUnmounted(() => {
  removeEventListeners()
  // 标签纹理不在 material.dispose 的回收范围内，需手动释放
  labels.forEach((label) => label.texture.dispose())
  labels = []
  flyLines = []
})

// 设置光照系统
const setupLights = () => {
  const scene = three.value.scene
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
  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x0c0c0c, 0.4)
  hemisphereLight.position.set(0, -50, 0)
  scene.add(hemisphereLight)
}

// 设置地面
const setupGround = () => {
  const scene = three.value.scene
  // 创建基础地面
  const groundGeometry = new THREE.PlaneGeometry(200, 200)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x031837,
    metalness: 0,
    roughness: 1,
    opacity: 0.3,
    transparent: true,
    colorSpace: THREE.SRGBColorSpace,
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.z = -1
  ground.receiveShadow = true
  scene.add(ground)
}

// 创建中国地图2D底图
const createChinaMapBase = (chinaData) => {
  const scene = three.value.scene
  chinaMapGroup = new THREE.Object3D()
  scene.add(chinaMapGroup)

  // 与主地图共用同一套墨卡托投影，保证省界与底图对齐
  const projection = geoMercator()
    .center(MAP_CONFIG.projection.center)
    .scale(MAP_CONFIG.projection.scale)
    .translate(MAP_CONFIG.projection.translate)

  chinaData.features.forEach((feature) => {
    const cityName = feature.properties?.name || '未知区域'

    forEachRing(feature, (ring) => {
      const geometry = createRingGeometry(ring, projection, { depth: 0, bevelEnabled: false })
      if (!geometry) return

      // 三份同色材质：ExtrudeGeometry 的正面/侧面/顶底面各取一份
      const materials = [0, 1, 2].map(
        () => new THREE.MeshBasicMaterial({ color: CHINA_BASE_COLOR }),
      )
      const mesh = new THREE.Mesh(geometry, materials)
      mesh.userData = { originalColor: CHINA_BASE_COLOR, cityName }

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: 0x000000,
          linewidth: 1,
          transparent: true,
          opacity: 0.8,
        }),
      )
      mesh.add(outline)

      chinaMapGroup.add(mesh)
    })
  })
}

// 加载地图数据
const loadMapData = (guangdongData) => {
  const scene = three.value.scene
  // 创建地图组
  mapGroup = new THREE.Object3D()
  scene.add(mapGroup)

  // 创建墨卡托投影
  const projection = geoMercator()
    .center(MAP_CONFIG.projection.center)
    .scale(MAP_CONFIG.projection.scale)
    .translate(MAP_CONFIG.projection.translate)

  // 遍历广东省各地区
  let tianheDistrict = null
  const districts = []

  guangdongData.features.forEach((feature, index) => {
    const district = createDistrict(feature, projection, index)
    districts.push(district)

    // 找到天河区
    if (feature.properties.name === '天河区') {
      tianheDistrict = district
    }
  })

  // 如果找到了天河区，创建飞线
  if (tianheDistrict && tianheDistrict.userData._centroid) {
    // 更新飞线起点
    FLY_LINE_CONFIG.startPoint.x = tianheDistrict.userData._centroid[0]
    FLY_LINE_CONFIG.startPoint.y = tianheDistrict.userData._centroid[1]

    // 创建飞线
    createFlyLines(districts)
  }
}

// 创建单个地区：每个环挤出为独立 mesh，统一挂到该地区的 group 上便于整体高亮
const createDistrict = (feature, projection, index) => {
  const districtGroup = new THREE.Object3D()
  districtGroup.userData = {
    name: feature.properties?.name,
    adcode: feature.properties?.adcode,
  }

  const color = MAP_CONFIG.colors.district[index % MAP_CONFIG.colors.district.length]

  forEachRing(feature, (ring) => {
    let geometry = null
    try {
      geometry = createRingGeometry(ring, projection, MAP_CONFIG.extrusion)
    } catch (error) {
      console.warn('Failed to create geometry for district:', error)
      return
    }
    if (!geometry) return

    const materials = [
      // 正面材质
      new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.3 }),
      // 侧面材质
      new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.5 }),
    ]
    const mesh = new THREE.Mesh(geometry, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData = { originalColor: color, district: districtGroup }

    districtGroup.add(mesh)
  })

  // 保存中心点坐标（飞线起点与标签都依赖它）
  const centroid = feature.properties?.centroid
  if (centroid) {
    try {
      const [x, y] = projection(centroid)
      if (Number.isFinite(x) && Number.isFinite(y)) {
        districtGroup.userData._centroid = [x, -y]
        createDistrictLabel(feature.properties.name, x, -y)
      }
    } catch {
      console.warn('Invalid centroid for district:', feature.properties?.name)
    }
  }

  mapGroup.add(districtGroup)
  return districtGroup
}

// 创建地区标签
const createDistrictLabel = (name, x, y) => {
  const scene = three.value.scene
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
    opacity: 0.9,
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
}

// 移除事件监听
const removeEventListeners = () => {
  const container = containerRef.value
  if (container) {
    container.removeEventListener('mousemove', handleMouseMove)
  }
}

// 处理鼠标移动
const handleMouseMove = (event) => {
  const map = three.value
  const container = containerRef.value
  if (!container || !raycaster || !mapGroup || !map) return

  // 计算鼠标位置
  const rect = container.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
  const y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1
  mouse.set(x, y)

  // 更新射线
  raycaster.setFromCamera(mouse, map.camera)
  const intersects = raycaster.intersectObjects(mapGroup.children, true)

  // 恢复之前选中的地区颜色
  if (activeDistrict) {
    activeDistrict.material.forEach((mat) => {
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
    updateDistrictInfo(hitDistrict.userData.district.userData, event)
  } else {
    // 隐藏信息面板
    updateDistrictInfo(null)
  }
}

// 更新地区信息
const updateDistrictInfo = (districtData, event) => {
  const info = infoRef.value
  if (!info) return

  if (districtData && event) {
    info.textContent = districtData.name
    info.style.visibility = 'visible'
    info.style.left = `${event.clientX - info.offsetWidth / 2}px`
    info.style.top = `${event.clientY - 30}px`
  } else {
    info.style.visibility = 'hidden'
  }
}

// 创建飞线
const createFlyLines = (districts) => {
  // 清空现有的飞线
  clearFlyLines()

  // 天河区中心点
  const startPoint = FLY_LINE_CONFIG.startPoint

  // 遍历所有地区，创建飞线
  districts.forEach((district) => {
    // 跳过天河区本身
    if (district.userData.name === '天河区') return

    // 获取目标地区的中心点
    if (!district.userData._centroid) return

    const endPoint = {
      x: district.userData._centroid[0],
      y: district.userData._centroid[1],
      z: 8,
    }

    // 创建带弧度的飞线路径（贝塞尔曲线）
    const controlPoint = calculateControlPoint(startPoint, endPoint)
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z),
      controlPoint,
      new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z),
    )

    // 生成曲线上的点
    const points = curve.getPoints(50)

    // 创建飞线主体（浅色线段）
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: FLY_LINE_CONFIG.line.color,
      opacity: FLY_LINE_CONFIG.line.opacity,
      transparent: true,
      linewidth: FLY_LINE_CONFIG.line.width,
    })
    const line = new THREE.Line(lineGeometry, lineMaterial)

    // 创建流动效果飞线（ShaderMaterial 实现虚线流动）
    const flowGeometry = new THREE.BufferGeometry().setFromPoints(points)

    // 计算曲线长度，用于流动效果
    let lineLength = 0
    for (let i = 1; i < points.length; i++) {
      lineLength += points[i].distanceTo(points[i - 1])
    }

    const vertexShader = `
      attribute float lineDistance;
      varying float vLineDistance;

      void main() {
        vLineDistance = lineDistance;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      uniform vec3 color;
      uniform float opacity;
      uniform float time;
      uniform float flowSpeed;
      uniform float dashSize;
      uniform float gapSize;
      uniform float totalLength;

      varying float vLineDistance;

      void main() {
        // 计算流动的虚线效果
        float offset = mod(time * flowSpeed, dashSize + gapSize);
        float modDistance = mod(vLineDistance - offset, dashSize + gapSize);

        // 判断是否在虚线段内
        if (modDistance > dashSize) {
          discard; // 间隙部分不渲染
        }

        gl_FragColor = vec4(color, opacity);
      }
    `

    // 生成随机流动速度，范围：基础速度的0.5到1.5倍
    const randomFlowSpeed = FLY_LINE_CONFIG.animation.flowSpeed * (0.5 + Math.random())

    // 创建流动材质
    const flowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(FLY_LINE_CONFIG.flow.color) },
        opacity: { value: FLY_LINE_CONFIG.flow.opacity },
        time: { value: 0.0 }, // 时间参数，用于流动效果
        flowSpeed: { value: randomFlowSpeed }, // 使用随机流动速度
        dashSize: { value: lineLength * FLY_LINE_CONFIG.flow.dashSize },
        gapSize: { value: lineLength * FLY_LINE_CONFIG.flow.gapSize },
        totalLength: { value: lineLength },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
    })

    const flowLine = new THREE.Line(flowGeometry, flowMaterial)

    // 为BufferGeometry手动添加lineDistance属性
    const positions = flowGeometry.attributes.position.array
    const lineDistances = new Float32Array(positions.length / 3)

    lineDistances[0] = 0
    for (let i = 1; i < positions.length / 3; i++) {
      const prevPoint = new THREE.Vector3(
        positions[(i - 1) * 3],
        positions[(i - 1) * 3 + 1],
        positions[(i - 1) * 3 + 2],
      )
      const currPoint = new THREE.Vector3(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2],
      )
      lineDistances[i] = lineDistances[i - 1] + prevPoint.distanceTo(currPoint)
    }

    // 添加lineDistance属性到几何体
    flowGeometry.setAttribute('lineDistance', new THREE.BufferAttribute(lineDistances, 1))

    // 创建飞线动画数据 - 所有飞线同时开始
    const flyLineData = {
      line: line,
      flowLine: flowLine,
      curve: curve,
      lineGeometry: lineGeometry,
      flowGeometry: flowGeometry,
      lineMaterial: lineMaterial,
      flowMaterial: flowMaterial,
      startTime: Date.now(), // 所有飞线使用相同的开始时间
      duration: FLY_LINE_CONFIG.animation.duration,
      progress: 0,
      active: true, // 直接设置为active，立即开始动画
      flowOffset: 0, // 流动偏移量
      lineLength: lineLength, // 保存曲线长度
    }

    // 添加到飞线组
    flyLineGroup.add(line)
    flyLineGroup.add(flowLine)
    flyLines.push(flyLineData)
  })
}

// 计算贝塞尔曲线控制点
const calculateControlPoint = (start, end) => {
  // 计算中点
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const midZ = (start.z + end.z) / 2

  // 使用固定高度，确保所有飞线高度一致
  const fixedHeight = 30 // 增加飞线高度，使弧度更大

  // 返回控制点，Z轴升高固定高度
  return new THREE.Vector3(midX, midY, midZ + fixedHeight)
}

// 更新飞线动画
const updateFlyLines = () => {
  const now = Date.now()

  flyLines.forEach((flyLineData) => {
    const { flowMaterial, startTime } = flyLineData

    // 使用时间差更新ShaderMaterial的time参数（秒为单位）
    const elapsed = now - startTime
    flowMaterial.uniforms.time.value = elapsed / 1000
  })
}

// 清空飞线
const clearFlyLines = () => {
  flyLines.forEach((flyLineData) => {
    // 移除并清理飞线主体
    flyLineGroup.remove(flyLineData.line)
    flyLineData.lineGeometry.dispose()
    flyLineData.lineMaterial.dispose()

    // 移除并清理流动飞线
    flyLineGroup.remove(flyLineData.flowLine)
    flyLineData.flowGeometry.dispose()
    flyLineData.flowMaterial.dispose()
  })
  flyLines = []
}
</script>
