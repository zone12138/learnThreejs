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
import chinaData from '../geoJson/中华人民共和国.js'

// 组件状态
const containerRef = ref(null)
const infoRef = ref(null)
let scene, camera, renderer, controls, animationId
let mapGroup = null
let chinaMapGroup = null
let raycaster = null
let mouse = new THREE.Vector2()
let activeDistrict = null
let labels = []
let flyLines = []
let flyLineGroup = null

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

// 地图配置
const MAP_CONFIG = {
  projection: {
    center: [113.2, 23.3],
    scale: 1000,
    translate: [0, 0],
  },
  colors: {
    district: ['#0465BD', '#357bcb', '#3a7abd'],
    highlight: '#4fa5ff',
    // background: 0x000000
    background: 'transparent',
  },
  extrusion: {
    depth: 6,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelThickness: 0.3,
  },
  camera: {
    fov: 45,
    near: 0.1,
    far: 5000,
    position: { x: 0, y: -80, z: 150 },
  },
}

// 初始化Three.js场景
const initScene = () => {
  const container = containerRef.value
  if (!container) return

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(MAP_CONFIG.colors.background) // 设置为黑色背景

  // 创建相机
  const width = container.clientWidth
  const height = container.clientHeight
  camera = new THREE.PerspectiveCamera(
    MAP_CONFIG.camera.fov,
    width / height,
    MAP_CONFIG.camera.near,
    MAP_CONFIG.camera.far,
  )
  camera.position.set(
    MAP_CONFIG.camera.position.x,
    MAP_CONFIG.camera.position.y,
    MAP_CONFIG.camera.position.z,
  )
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }) // alpha设为false，使用背景色
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000) // 设置渲染器清除颜色为黑色
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

  // 创建飞线组
  flyLineGroup = new THREE.Object3D()
  scene.add(flyLineGroup)

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
  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x0c0c0c, 0.4)
  hemisphereLight.position.set(0, -50, 0)
  scene.add(hemisphereLight)
}

// 设置地面和中国地图底图
const setupGround = () => {
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

  // 创建中国地图2D底图
  createChinaMapBase()
}

// 创建中国地图2D底图
const createChinaMapBase = () => {
  // 创建中国地图组
  chinaMapGroup = new THREE.Object3D()
  scene.add(chinaMapGroup)

  // 创建墨卡托投影（与主地图相同）
  const projection = d3
    .geoMercator()
    .center(MAP_CONFIG.projection.center)
    .scale(MAP_CONFIG.projection.scale) // 稍小的比例尺，确保中国地图完整显示
    .translate(MAP_CONFIG.projection.translate)

  let featureCount = 0
  let meshCount = 0

  // 遍历中国地图数据，创建2D平面图形
  chinaData.features.forEach((feature) => {
    featureCount++
    const geometryType = feature.geometry.type
    const coordinates = feature.geometry.coordinates
    const cityName = feature.properties.name || `Feature ${featureCount}`

    // 根据geometry.type进行分类讨论，处理不同的嵌套层级
    if (geometryType === 'Polygon') {
      // Polygon类型：坐标结构 [ [ [x1,y1], [x2,y2], ... ] ]（3层嵌套）
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
        const mesh = createMapShape(validCoords)
        if (mesh) {
          mesh.userData.cityName = cityName
          chinaMapGroup.add(mesh)
          meshCount++
        }
      })
    } else if (geometryType === 'MultiPolygon') {
      // MultiPolygon类型：坐标结构 [ [ [ [x1,y1], [x2,y2], ... ] ] ]（4层嵌套）
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
          const mesh = createMapShape(validCoords)
          if (mesh) {
            mesh.userData.cityName = cityName
            chinaMapGroup.add(mesh)
            meshCount++
          }
        })
      })
    }
  })
}

// 创建地图形状
const createMapShape = (validCoords, color = 0xf5f5dc) => {
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

      // 优化边界计算，避免NaN错误
      try {
        geometry.computeBoundingBox()
        geometry.computeBoundingSphere()
      } catch (error) {
        // 如果自动计算失败，使用简单的默认值
        geometry.boundingBox = new THREE.Box3(
          new THREE.Vector3(-50, -50, -5),
          new THREE.Vector3(50, 50, 10),
        )
        geometry.boundingSphere = {
          center: new THREE.Vector3(0, 0, 5),
          radius: 100,
        }
      }

      // 使用MeshBasicMaterial数组，完全不受光照影响，避免鳞片状反光
      // ExtrudeGeometry需要为不同面提供材质
      const materials = [
        new THREE.MeshBasicMaterial({ color: color }), // 正面
        new THREE.MeshBasicMaterial({ color: color }), // 侧面
        new THREE.MeshBasicMaterial({ color: color }), // 顶面/底面
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

// 加载地图数据
const loadMapData = () => {
  // 创建地图组
  mapGroup = new THREE.Object3D()
  scene.add(mapGroup)

  // 创建墨卡托投影
  const projection = d3
    .geoMercator()
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
    createFlyLines(districts, projection)
  }
}

// 创建单个地区
const createDistrict = (feature, projection, index) => {
  const districtGroup = new THREE.Object3D()
  districtGroup.userData = {
    name: feature.properties.name,
    adcode: feature.properties.adcode,
  }

  // 获取颜色
  const color = MAP_CONFIG.colors.district[index % MAP_CONFIG.colors.district.length]

  // 处理坐标
  const coordinates = feature.geometry.coordinates
  const type = feature.geometry.type
  coordinates.forEach((multiPolygon) => {
    multiPolygon.forEach((polygon) => {
      // 收集有效坐标
      const validCoords = []

      if (type === 'Polygon') {
        try {
          const [x, y] = projection(polygon)
          // 只检查NaN，放宽限制，允许有限大的数值
          if (!isNaN(x) && !isNaN(y)) {
            validCoords.push([x, -y])
          } else {
            console.log('Invalid coordinate:', polygon, feature.properties.name)
          }
        } catch (error) {
          // 忽略无效坐标
          console.error(
            'Error projecting coordinate(Polygon):',
            polygon,
            feature.properties.name,
            error,
          )
        }
      } else if (type === 'MultiPolygon') {
        polygon.forEach((coord) => {
          try {
            const [x, y] = projection(coord)
            // 只检查NaN，放宽限制，允许有限大的数值
            if (!isNaN(x) && !isNaN(y)) {
              validCoords.push([x, -y])
            }
          } catch (error) {
            // 忽略无效坐标
            console.error(
              'Error projecting coordinate(MultiPolygon):',
              coord,
              feature.properties.name,
              error,
            )
          }
        })
      }

      // 只有当有足够的有效坐标时才创建形状
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

          // 创建几何体
          const geometry = new THREE.ExtrudeGeometry(shape, MAP_CONFIG.extrusion)

          // 优化边界计算，避免NaN错误
          try {
            geometry.computeBoundingBox()
            geometry.computeBoundingSphere()
          } catch (error) {
            // 如果自动计算失败，使用简单的默认值
            geometry.boundingBox = new THREE.Box3(
              new THREE.Vector3(-50, -50, -5),
              new THREE.Vector3(50, 50, 10),
            )
            geometry.boundingSphere = {
              center: new THREE.Vector3(0, 0, 5),
              radius: 100,
            }
          }

          // 创建材质
          const materials = [
            // 正面材质
            new THREE.MeshStandardMaterial({
              color: color,
              metalness: 0,
              roughness: 0.3,
            }),
            // 侧面材质
            new THREE.MeshStandardMaterial({
              color: color,
              metalness: 0,
              roughness: 0.5,
            }),
          ]

          // 创建网格
          const mesh = new THREE.Mesh(geometry, materials)
          mesh.castShadow = true
          mesh.receiveShadow = true
          mesh.userData = {
            originalColor: color,
            district: districtGroup,
          }

          // 添加到地区组
          districtGroup.add(mesh)
        } catch (error) {
          console.warn('Failed to create geometry for district:', error)
        }
      }
    })
  })

  // 保存中心点坐标
  if (feature.properties.centroid) {
    try {
      const [x, y] = projection(feature.properties.centroid)

      // 检查中心点坐标是否有效
      if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
        districtGroup.userData._centroid = [x, -y]

        // 添加地区名称标签
        createDistrictLabel(feature.properties.name, x, -y)
      }
    } catch (error) {
      console.warn('Invalid centroid for district:', feature.properties.name)
    }
  }

  // 添加到地图组
  mapGroup.add(districtGroup)

  return districtGroup
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

  // 更新飞线动画
  updateFlyLines()

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// 创建飞线
const createFlyLines = (districts, projection) => {
  // 清空现有的飞线
  clearFlyLines()

  // 天河区中心点
  const startPoint = FLY_LINE_CONFIG.startPoint

  // 遍历所有地区，创建飞线
  districts.forEach((district, index) => {
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
    const points = curve.getPoints(50) // 50个点，使曲线更平滑

    // 创建飞线主体（浅色线段）
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: FLY_LINE_CONFIG.line.color,
      opacity: FLY_LINE_CONFIG.line.opacity,
      transparent: true,
      linewidth: FLY_LINE_CONFIG.line.width,
    })
    const line = new THREE.Line(lineGeometry, lineMaterial)

    // 创建流动效果飞线（使用ShaderMaterial实现更可靠的流动效果）
    const flowGeometry = new THREE.BufferGeometry().setFromPoints(points)

    // 计算曲线长度，用于流动效果
    let lineLength = 0
    for (let i = 1; i < points.length; i++) {
      lineLength += points[i].distanceTo(points[i - 1])
    }

    // 使用ShaderMaterial实现更可靠的流动效果
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

// 创建飞线点
const createFlyLinePoint = (position) => {
  const geometry = new THREE.SphereGeometry(0.3, 16, 16)
  const material = new THREE.MeshBasicMaterial({
    color: FLY_LINE_CONFIG.color,
    transparent: true,
    opacity: FLY_LINE_CONFIG.opacity,
  })
  const point = new THREE.Mesh(geometry, material)
  point.position.copy(position)
  return point
}

// 更新飞线动画
const updateFlyLines = () => {
  const now = Date.now()

  flyLines.forEach((flyLineData) => {
    const { flowMaterial, startTime } = flyLineData

    // 直接更新所有飞线的动画，不需要active状态检查
    // 使用时间差更新ShaderMaterial的time参数
    const elapsed = now - startTime

    // 更新time uniform，驱动流动效果
    // 使用秒为单位，让流动速度更可控
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

// 清理资源
const cleanup = () => {
  // 停止动画
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  // 移除事件监听
  removeEventListeners()

  // 清理飞线
  clearFlyLines()
  if (flyLineGroup) {
    scene.remove(flyLineGroup)
    flyLineGroup = null
  }

  // 清理标签
  labels.forEach((label) => {
    scene.remove(label.sprite)
    label.material.dispose()
    label.texture.dispose()
  })
  labels = []

  // 清理中国地图底图
  if (chinaMapGroup) {
    scene.remove(chinaMapGroup)
    chinaMapGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
    chinaMapGroup = null
  }

  // 清理地图组
  if (mapGroup) {
    scene.remove(mapGroup)
    mapGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose())
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
