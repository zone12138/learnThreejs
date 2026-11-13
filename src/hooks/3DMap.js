import { computed, onUnmounted, shallowRef, toValue } from 'vue'
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'
import merge from 'lodash-es/merge'
import { BasicThreejs } from '@/threejs/core'
import { forEachRing, createRingGeometry } from '@/threejs/utils/geoShape'

const isNonEmptyArray = (arr) => Array.isArray(arr) && arr.length > 0

/**
 * 默认配置工厂：每次调用生成全新对象。
 * 旧实现把 MAP_CONFIG 放在模块级并被 Object.assign 原地改写，
 * 多个 use3DMap 实例会互相覆盖配置且无法恢复，故改为局部合并。
 */
const createDefaultMapConfig = () => ({
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
  controls: {
    minDistance: 50,
    maxDistance: 200,
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
})

/**
 * 3D 地图 Hook（构建于 BasicThreejs 之上）。
 * 场景/相机/渲染器/控制器/渲染循环/资源回收全部由 BasicThreejs 承担，
 * 本 hook 只负责：光照、投影、地面与 3D 挤出地图的构建。
 *
 * 数据（GeoJSON）通常经 loadGeoJson 异步加载，故初始化由调用方在数据就绪后
 * 调用 initMap() 触发；卸载时自动销毁。
 *
 * @param {Object} params
 * @param {import('vue').Ref<HTMLCanvasElement>} params.canvas canvas 引用
 * @param {Object} [params.mapConfig] 配置覆盖项
 */
export function use3DMap({ canvas, mapConfig = {} } = {}) {
  // 配置合并到函数局部对象，不污染模块级常量
  const config = merge({}, createDefaultMapConfig(), mapConfig)

  const basic = shallowRef(null)
  // 对外暴露的都是响应式引用：旧实现返回 onMounted 前求值的 null，永远不可用
  const groundMapGroup = shallowRef(null)
  const mapGroup = shallowRef(null)

  const scene = computed(() => basic.value?.scene ?? null)
  const camera = computed(() => basic.value?.camera ?? null)
  const renderer = computed(() => basic.value?.renderer ?? null)
  const controls = computed(() => basic.value?.controls ?? null)

  /**
   * 初始化（幂等）：创建 BasicThreejs 基座并构建地图。
   * @param {Object} data
   * @param {Object} [data.groundMapData] 地面地图 GeoJSON 数据
   * @param {Object} [data.mapData] 3D 地图 GeoJSON 数据
   */
  const initMap = ({ groundMapData, mapData } = {}) => {
    if (basic.value) return console.warn('use3DMap: 已初始化，如需重建请先 cleanup()')
    const canvasEl = toValue(canvas)
    if (!canvasEl) return console.error('use3DMap: canvas 不存在')

    basic.value = new BasicThreejs(canvasEl, {
      cameraOpts: {
        fov: config.camera.fov,
        near: config.camera.near,
        far: config.camera.far,
        position: new THREE.Vector3(
          config.camera.position.x,
          config.camera.position.y,
          config.camera.position.z,
        ),
      },
      rendererOpts: {
        antialias: config.renderer.antialias,
        alpha: config.renderer.alpha,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.25,
        shadow: true,
        clearColor: 0x000000,
      },
      controlsOpts: { ...config.controls },
    })

    basic.value.scene.background = new THREE.Color(config.scene.background)
    basic.value.camera.lookAt(0, 0, 0)

    setupLights()
    if (groundMapData) setupGround(groundMapData)
    if (mapData) setup3DMap(mapData)
  }

  // 初始化地面
  const setupGround = (groundMapData) => {
    // 检查是否有有效数据
    if (!isNonEmptyArray(groundMapData?.features)) return console.error('地面地图数据为空或无效')
    groundMapGroup.value = createGroundMap(groundMapData, config.groundMap)
  }

  // 初始化3D地图
  const setup3DMap = (mapData) => {
    if (!isNonEmptyArray(mapData?.features)) return console.error('3D地图数据为空或无效')
    mapGroup.value = createGroundMap(mapData, config.map)
  }

  /**
   * 创建地图
   * @param {Object} mapShapeData 地图数据，包含features属性
   * @param {Object} mapOpts 地图选项，包含extrudeOpts, colorList, lineOpts
   * @returns 地图组
   */
  const createGroundMap = (mapShapeData, mapOpts) => {
    const scene = basic.value.scene
    const group = new THREE.Object3D()
    scene.add(group)
    const { extrudeOpts, colorList, lineOpts } = mapOpts

    const projection = geoMercator()
      .center(config.projection.center)
      .scale(config.projection.scale)
      .translate(config.projection.translate)

    mapShapeData.features.forEach((feature, featureIndex) => {
      const cityName = feature.properties?.name
      const color = colorList[featureIndex % colorList.length]

      // 环的展平/投影/挤出交给公共构件，Polygon 与 MultiPolygon 不再各写一套
      forEachRing(feature, (ring) => {
        let geometry = null
        try {
          geometry = createRingGeometry(ring, projection, extrudeOpts)
        } catch (error) {
          console.warn('Failed to create shape for', cityName, error)
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
        mesh.userData = { originalColor: color, cityName }

        // 地图轮廓线
        if (mapOpts.drawOutline) {
          const edges = new THREE.EdgesGeometry(geometry)
          const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial(lineOpts))
          mesh.add(outline)
        }

        group.add(mesh)
      })
    })

    return group
  }

  // 设置光照系统
  const setupLights = () => {
    const scene = basic.value.scene
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
    scene.add(directionalLight2)

    // 半球光
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x0c0c0c, 0.4)
    hemisphereLight.position.set(0, -50, 0) // 半球光位置
    scene.add(hemisphereLight)
  }

  // 清理：几何体/材质由 BasicThreejs.destroy 统一遍历释放，这里只重置本地引用
  const cleanup = () => {
    basic.value?.destroy()
    basic.value = null
    groundMapGroup.value = null
    mapGroup.value = null
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    // 响应式引用：initMap 之后可用
    basic,
    scene,
    camera,
    renderer,
    controls,
    groundMapGroup,
    mapGroup,
    initMap,
    cleanup,
  }
}
