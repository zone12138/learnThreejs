import { ref, onMounted, toValue } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as d3 from 'd3'

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
  groundMap: {
    extrudeOpts: {
      depth: 0.1,
      bevelEnabled: false,
    },
    colorList: ['#f5f5dc'],
    drawOutline: true,
    lineOpts: {
      color: 0x000000,
      linewidth: 1,
      transparent: true,
      opacity: 0.8,
    },
  },
  map: {
    extrudeOpts: {
      depth: 6,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelThickness: 0.3,
    },
    colorList: ['#0465BD', '#357bcb', '#3a7abd'],
    lineOpts: {
      color: 0x000000,
      linewidth: 1,
      transparent: false,
      opacity: 1,
    },
  },
}

export function use3DMap({
  container = document.body,
  groundMapData,
  mapData,
  mapConfig = {},
} = {}) {
  Object.assign(MAP_CONFIG, mapConfig)

  let scene, camera, renderer, controls, animationId
  let groundMapGroup, mapGroup, containerRef
  // 初始化投影
  const projection = d3
    .geoMercator()
    .center(MAP_CONFIG.projection.center)
    .scale(MAP_CONFIG.projection.scale)
    .translate(MAP_CONFIG.projection.translate)

  const isNonEmptyArray = (arr) => Array.isArray(arr) && arr.length > 0

  // 初始化场景
  const initScene = () => {
    const container = containerRef
    if (!container) return

    // 初始化场景
    scene = new THREE.Scene()
    scene.background = new THREE.Color(MAP_CONFIG.scene.background)

    const width = container.clientWidth,
      height = container.clientHeight
    // 初始化相机
    camera = new THREE.PerspectiveCamera(
      MAP_CONFIG.camera.fov,
      width / height,
      MAP_CONFIG.camera.near,
      MAP_CONFIG.camera.far,
    )
    // 相机位置设置
    camera.position.set(
      MAP_CONFIG.camera.position.x,
      MAP_CONFIG.camera.position.y,
      MAP_CONFIG.camera.position.z,
    )
    camera.lookAt(0, 0, 0) // 相机指向场景中心

    // 初始化渲染器
    renderer = new THREE.WebGLRenderer(MAP_CONFIG.renderer)
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

    setupLights()

    setupGround()

    setup3DMap()

    // 启动动画循环
    animate()
  }

  // 初始化地面
  const setupGround = () => {
    // 检查是否有有效数据
    if (!groundMapData || !isNonEmptyArray(groundMapData.features)) {
      console.error('地面地图数据为空或无效')
      return
    }
    console.log('地面地图数据', groundMapData)
    groundMapGroup = createGroundMap(groundMapData, MAP_CONFIG.groundMap)
  }

  const setup3DMap = () => {
    if (!mapData || !isNonEmptyArray(mapData.features)) {
      console.error('3D地图数据为空或无效')
      return
    }

    mapGroup = createGroundMap(mapData, MAP_CONFIG.map)
  }

  /**
   * 创建地图
   * @param {Object} mapShapeData 地图数据，包含features属性
   * @param {Object} mapOpts 地图选项，包含extrudeOpts, color, lineOpts
   * @returns 地图组
   */
  const createGroundMap = (mapShapeData, mapOpts) => {
    // 初始化地图组
    const mapGroup = new THREE.Object3D()
    scene.add(mapGroup) // 将地图组添加到场景中
    const invalidCoordsCount = []
    const { extrudeOpts, colorList, drawOutline, lineOpts } = mapOpts

    // 遍历地图数据
    mapShapeData.features.forEach((feature, featureIndex) => {
      const geometryType = feature.geometry.type
      const coordinates = feature.geometry.coordinates
      const cityName = feature.properties.name

      const color = colorList[featureIndex % colorList.length]

      coordinates.forEach((polygon) => {
        // 处理多边形和多多边形的坐标格式，MultiPolygon比Polygon多一层数组
        if (geometryType === 'Polygon') {
          polygon = [polygon]
        }
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
              // 收集无效坐标
              invalidCoordsCount.push({ geometryType, coord, cityName })
            }
          })

          // 创建地图形状网格
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

              // 创建拉伸几何体
              const geometry = new THREE.ExtrudeGeometry(shape, extrudeOpts)

              // 计算几何体的边界框和球体，用于渲染优化
              geometry.computeBoundingBox()
              // 计算几何体的边界球体，用于渲染优化
              geometry.computeBoundingSphere()

              // 使用MeshBasicMaterial数组，完全不受光照影响，避免鳞片状反光
              const materials = [
                // new THREE.MeshBasicMaterial({ color }), // 正面
                // new THREE.MeshBasicMaterial({ color }), // 侧面
                // new THREE.MeshBasicMaterial({ color }), // 顶面/底面

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
              // 设置网格用户数据，用于后续交互
              mesh.userData = {
                originalColor: color,
                cityName,
              }

              // 仅在 drawOutline 为 true 时创建轮廓线
              if (drawOutline) {
                // 创建区域轮廓线，增强边界清晰度
                const edges = new THREE.EdgesGeometry(geometry)
                // 为轮廓线设置颜色，与主网格颜色不同
                const lineMaterial = new THREE.LineBasicMaterial(lineOpts)
                // 轮廓线
                const outline = new THREE.LineSegments(edges, lineMaterial)
                mesh.add(outline)
              }

              // 将网格添加到地图组
              mapGroup.add(mesh)
            } catch (error) {
              console.warn('Failed to create shape for ', cityName, ' map feature:', error)
            }
          }
        })
      })
    })

    // 打印无效坐标信息
    if (invalidCoordsCount.length > 0)
      console.warn('Invalid coordinates for city:', invalidCoordsCount)

    return mapGroup
  }

  // 动画循环
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    controls && controls.update() // 更新控制器
    renderer && scene && camera && renderer.render(scene, camera) // 渲染场景
  }

  // 设置光照系统
  const setupLights = () => {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    // 主方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(50, -100, 50) // 主方向光位置
    directionalLight.castShadow = true // 开启阴影投射
    directionalLight.shadow.mapSize.width = 2048 // 阴影贴图宽度
    directionalLight.shadow.mapSize.height = 2048 // 阴影贴图高度
    directionalLight.shadow.camera.left = -100 // 阴影相机左边界
    directionalLight.shadow.camera.right = 100 // 阴影相机右边界
    directionalLight.shadow.camera.top = 100 // 阴影相机上边界
    directionalLight.shadow.camera.bottom = -100 // 阴影相机下边界
    scene.add(directionalLight) // 添加主方向光到场景

    // 辅助方向光
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    directionalLight2.position.set(-50, -50, 30) // 辅助方向光位置
    scene.add(directionalLight2) // 添加辅助方向光到场景

    // 半球光
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x0c0c0c, 0.4)
    hemisphereLight.position.set(0, -50, 0) // 半球光位置
    scene.add(hemisphereLight)
  }

  onMounted(() => {
    containerRef = toValue(container)
    initScene()
  })

  return {
    scene,
    camera,
    renderer,
    controls,
    animationId,
    groundMapGroup,
  }
}
