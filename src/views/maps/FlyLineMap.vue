<template>
  <div ref="container" class="demo-stage flyline-stage">
    <canvas ref="mapCanvas"></canvas>

    <!-- 下钻导航：层级路径本身即返回入口，任意一级都可回跳 -->
    <nav class="drill-nav">
      <ol class="drill-path">
        <li v-for="(node, index) in breadcrumb" :key="node.adcode" class="drill-path__item">
          <button
            type="button"
            class="drill-crumb"
            :class="{ 'is-current': index === breadcrumb.length - 1 }"
            :disabled="index === breadcrumb.length - 1"
            @click="goToDepth(index)"
          >
            {{ node.name }}
          </button>
          <span v-if="index < breadcrumb.length - 1" class="drill-slash">/</span>
        </li>
      </ol>
      <button type="button" class="drill-back" :disabled="breadcrumb.length < 2" @click="goUp">
        返回上级
      </button>
    </nav>

    <p class="drill-status">{{ statusText }}</p>

    <div class="drill-tooltip" :class="{ 'is-visible': hovered }" :style="tooltipStyle">
      <span class="drill-tooltip__name">{{ hovered?.name }}</span>
      <span class="drill-tooltip__hint">
        {{ hovered?.hint }}
      </span>
    </div>
  </div>
</template>

<script setup>
import * as THREE from 'three'
import gsap from 'gsap'
import { onMounted, onUnmounted, ref } from 'vue'
import { useThree } from '@/hooks/useThree'
import { loadGeoJson } from '@/utils/geoLoader'
import { forEachRing, createShape } from '@/threejs/utils/geoShape'
import { fitCameraToBox } from '@/threejs/utils/cameraFit'
import { FlyLineFlow } from '@/threejs/components/FlyLineFlow'

/**
 * 飞线下钻地图
 *
 * 三个层级的实现要点：
 * 1. 层级来源是真实数据，不是视觉模拟：
 *    广东省（guangdong.json，21 个地级市）
 *      └ 地级市（guangdong-districts.json 中 parent.adcode === 市 adcode 的区县）
 *          └ 区县（childrenNum = 0，最末级）
 * 2. 投影固定按省域经纬度边界计算一次，所有层级共用同一套归一化，
 *    子级几何体因此落在父级原本的位置上，下钻只需要推相机，不会跳坐标系。
 * 3. 几何体按「每个 feature 一个 mesh」构建（而不是整层合并成一个大 mesh），
 *    因为拾取要能区分到具体区划，高亮也只能按 mesh 做。
 */

const ROOT = { adcode: 440000, name: '广东省' }

// 地图铺满 30 × 20 的世界单位；厚度上限 0.5 用于挤出立体的板块感
const MAP_WIDTH = 30
const MAP_HEIGHT = 20
const EXTRUDE_DEPTH = 0.5

// 深色基底配色（板块 / 边线 / 飞线）
const REGION_COLORS = [0x0f3f52, 0x11495e, 0x0c3648, 0x124f66]
const EDGE_COLOR = 0x2fd4ff
const EDGE_OPACITY = 0.4

const container = ref(null)
const mapCanvas = ref(null)

// 面包屑与状态提示（只有这些需要进 Vue 响应式系统）
const breadcrumb = ref([])
const statusText = ref('')
const hovered = ref(null)
const tooltipStyle = ref({ transform: 'translate3d(-100px, -100px, 0)' })

// 场景基座：renderer 用透明背景，深色渐变交给 CSS，省一层全屏绘制
const three = useThree(mapCanvas, {
  cameraOpts: {
    fov: 52,
    near: 0.1,
    far: 400,
    position: new THREE.Vector3(0, 26, 34),
  },
  rendererOpts: {
    alpha: true,
    antialias: true,
  },
  controlsOpts: {
    dampingFactor: 0.06,
    minDistance: 2,
    maxDistance: 120,
  },
})

/* ------------------------------ 内部状态 ------------------------------ */

let bounds = null // 省域经纬度边界，固定投影范围
let levelGroup = null // 当前层级的板块组
let levelMeshes = [] // 当前层级的可拾取网格
let stack = [] // 层级栈：省 → 市 → 区
let cameraTween = null
let isTransitioning = false
let hintTimer = 0

let flyLines = null

let hoveredMesh = null
// 当前层级的板块顶面高度：随机层级跨度变化（省域 0.5，市域更薄）
let currentSurfaceY = EXTRUDE_DEPTH
const pointer = new THREE.Vector2(-10, -10)
const pointerClient = { x: 0, y: 0 }
const raycaster = new THREE.Raycaster()
let hoverFrame = 0
let pendingPointerEvent = null

/* ------------------------------ 投影 ------------------------------ */

/**
 * 计算并固定投影范围。所有层级（省/市/区县）共用这一次算出的边界，
 * 这样下钻时子级几何体的世界坐标与父级完全一致，只是相机靠近了。
 * @param {Object[]} features GeoJSON features
 */
function computeBounds(features) {
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  for (const feature of features) {
    forEachRing(feature, (ring) => {
      for (const [lon, lat] of ring) {
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    })
  }

  return { minLon, maxLon, minLat, maxLat }
}

/**
 * 经纬度 → Shape 平面坐标（x 向东，y 向北）。
 * @param {number[]} coord [lon, lat]
 * @returns {number[]} [x, z]
 */
function project(coord) {
  if (!bounds || !coord) return null
  const lon = coord[0]
  const lat = coord[1]
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null

  const lonRange = bounds.maxLon - bounds.minLon || 1
  const latRange = bounds.maxLat - bounds.minLat || 1
  const x = ((lon - bounds.minLon) / lonRange) * MAP_WIDTH - MAP_WIDTH / 2
  const z = ((lat - bounds.minLat) / latRange) * MAP_HEIGHT - MAP_HEIGHT / 2
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  return [x, z]
}

/**
 * 经纬度 → 世界坐标。
 * 板块绕 X 轴旋转 -90° 放平后，几何体的 local +y 会映射到世界 -z，
 * 所以这里统一取 -z，保证「纬度越高越靠画面里侧（北）」，
 * 也让飞线端点与板块重心严格重合（旧实现两套坐标差一个负号，飞线整体南北镜像）。
 * @param {number} lon 经度
 * @param {number} lat 纬度
 * @param {number} [y] 高度
 * @returns {THREE.Vector3}
 */
function toWorld(lon, lat, y = currentSurfaceY) {
  const point = project([lon, lat])
  return new THREE.Vector3(point ? point[0] : 0, y, point ? -point[1] : 0)
}

/* ------------------------------ 层级数据 ------------------------------ */

/**
 * 解析某个节点下辖的区域。
 * 省域直接取 guangdong.json（21 个地级市，parent 均为 440000）；
 * 市域从 guangdong-districts.json 里按 parent.adcode 过滤区县。
 *
 * @param {{ adcode: number, depth: number }} node 层级节点
 * @returns {Promise<Object[]>} GeoJSON features
 */
async function resolveRegions(node) {
  if (node.depth === 0) {
    const geoJson = await loadGeoJson('guangdong')
    return geoJson.features
  }

  const geoJson = await loadGeoJson('guangdong-districts')
  return geoJson.features.filter((feature) => feature.properties?.parent?.adcode === node.adcode)
}

/**
 * 该区域是否可以继续下钻。
 * 东莞市、中山市是「直筒子市」，childrenNum = 0，没有区县数据；
 * 区县本身也已是末级，因此只在省域层（stack.length === 1）允许下钻。
 * @param {Object} feature GeoJSON feature
 */
function canDrill(feature) {
  if (stack.length !== 1) return false
  return (feature.properties?.childrenNum ?? 0) > 0
}

/**
 * 不可下钻时的说明文案。
 * 东莞市、中山市这类「直筒子市」本身没有区县，和已经到区县层不是一回事。
 * @param {Object} feature GeoJSON feature
 */
function drillBlockedHint(feature) {
  return feature.properties?.level === 'city' ? '暂无下级区划数据' : '已是最末级区划'
}

/* ------------------------------ 几何体 ------------------------------ */

/**
 * 一个 feature → 一个挤出几何体。
 * Polygon / MultiPolygon 的每个环分别建 Shape，除首环外都作为孔洞，
 * 避免旧实现把孔洞当成实心面（如被市辖区包围的飞地）。
 * @param {Object} feature GeoJSON feature
 * @param {number} levelDepth 本层级允许的最大挤出高度
 * @returns {THREE.ExtrudeGeometry|null}
 */
function createFeatureGeometry(feature, levelDepth = EXTRUDE_DEPTH) {
  const geometry = feature.geometry
  if (!geometry?.coordinates) return null

  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : (geometry.coordinates ?? [])
  const shapes = []

  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) continue

    const [outerRing, ...holeRings] = polygon
    // 个别越界/缺失坐标会返回 null，直接丢弃，避免整块面被拉出尖角
    const outerPoints = outerRing.map(project).filter(Boolean)
    const outerShape = createShape(outerPoints)
    if (!outerShape) continue

    for (const holeRing of holeRings) {
      const points = holeRing
        .map(project)
        .filter(Boolean)
        .map(([x, z]) => new THREE.Vector2(x, z))
      if (points.length < 3) continue
      outerShape.holes.push(new THREE.Path(points))
    }

    shapes.push(outerShape)
  }

  if (!shapes.length) return null

  // 挤出高度按「本区划自身尺寸」封顶：省域层级 0.5 的厚度对一座小岛来说高达数倍自身宽度，
  // 放大到市级视图时会变成一根根柱子。小面片自动压薄，视觉上才是一块连续的地板。
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const shape of shapes) {
    for (const point of shape.getPoints(12)) {
      if (point.x < minX) minX = point.x
      if (point.x > maxX) maxX = point.x
      if (point.y < minZ) minZ = point.y
      if (point.y > maxZ) maxZ = point.y
    }
  }
  const featureExtent = Math.max(maxX - minX, maxZ - minZ)
  const depth = Math.max(0.006, Math.min(levelDepth, featureExtent * 0.35))

  const merged = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: false,
  })
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  return merged
}

/**
 * 构建一个层级的板块组：每个区划一个 mesh + 一层描边。
 * 拆开而不是合并，是为了射线拾取能区分到具体区划、高亮能按区划做。
 * @param {Object[]} regions GeoJSON features
 */
function buildLevel(regions) {
  const group = new THREE.Group()
  const meshes = []

  // 先量本层级的实际跨度：挤出高度、飞线粗细、光点尺寸都随它缩放
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const feature of regions) {
    forEachRing(feature, (ring) => {
      for (const coord of ring) {
        const point = project(coord)
        if (!point) continue
        if (point[0] < minX) minX = point[0]
        if (point[0] > maxX) maxX = point[0]
        if (point[1] < minZ) minZ = point[1]
        if (point[1] > maxZ) maxZ = point[1]
      }
    })
  }
  const extent = Math.max(maxX - minX, maxZ - minZ, 1)
  const levelDepth = Math.min(EXTRUDE_DEPTH, extent * 0.02)
  // 飞线与节点贴在顶面上，需要知道这一层板有多高
  currentSurfaceY = levelDepth

  regions.forEach((feature, index) => {
    const geometry = createFeatureGeometry(feature, levelDepth)
    if (!geometry) return

    const baseColor = REGION_COLORS[index % REGION_COLORS.length]
    const material = new THREE.MeshPhongMaterial({
      color: baseColor,
      emissive: 0x061a24,
      specular: 0x1a5b73,
      shininess: 45,
      flatShading: true,
      transparent: true,
      opacity: 1,
    })

    const mesh = new THREE.Mesh(geometry, material)
    // 放平：挤出方向 local +z 变成世界 +y，板块顶面落在 currentSurfaceY
    mesh.rotation.x = -Math.PI / 2

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: EDGE_COLOR,
      transparent: true,
      opacity: EDGE_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), edgeMaterial)

    mesh.add(edge)
    mesh.userData = { feature, baseColor, edge }
    group.add(mesh)
    meshes.push(mesh)
  })

  return { group, meshes }
}

/* ------------------------------ 飞线 ------------------------------ */

/**
 * 按层级重建飞线：取各区划重心的世界坐标，绘制交给 FlyLineFlow。
 * @param {Object[]} regions GeoJSON features
 * @param {number} extent 当前层级跨度（决定线宽与光点尺寸）
 * @param {boolean} fadeIn 是否淡入
 */
function rebuildFlyLines(regions, extent, fadeIn) {
  const nodes = []
  for (const feature of regions) {
    const properties = feature.properties ?? {}
    const coordinate = properties.centroid || properties.center
    if (!coordinate) continue
    nodes.push({ position: toWorld(coordinate[0], coordinate[1], currentSurfaceY + 0.02) })
  }
  flyLines?.setNodes(nodes, { extent, fadeIn })
}

/* ------------------------------ 层级切换 ------------------------------ */

/** 按 alpha 设置一组材质的透明度（记录过 baseOpacity 的按比例缩放）。 */
function applyGroupOpacity(group, alpha) {
  group.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!material || !material.transparent) return
      if (material.userData.baseOpacity == null) {
        material.userData.baseOpacity = material.opacity
      }
      material.opacity = material.userData.baseOpacity * alpha
    })
  })
}

/** 整组淡入/淡出。逐材质补间，交给 gsap 统一调度。 */
function fadeGroup(group, alpha, duration) {
  group.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!material || !material.transparent) return
      if (material.userData.baseOpacity == null) {
        material.userData.baseOpacity = material.opacity
      }
      gsap.to(material, {
        opacity: material.userData.baseOpacity * alpha,
        duration,
        ease: 'sine.out',
        overwrite: true,
      })
    })
  })
}

function disposeLevelGroup(group) {
  if (!group) return
  group.traverse((object) => {
    object.geometry?.dispose?.()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => material?.dispose?.())
  })
  three.value?.scene?.remove(group)
}

/** 停掉一组对象上的全部补间（材质 opacity 与着色器 uniform），避免 gsap 继续驱动已销毁对象。 */
function killGroupTweens(group) {
  if (!group) return
  group.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if (!material) return
      gsap.killTweensOf(material)
      if (material.uniforms) {
        Object.values(material.uniforms).forEach((uniform) => gsap.killTweensOf(uniform))
      }
    })
  })
}

/**
 * 当前层级的机位：交给公共的拟合函数，视图只负责把相机参数传进去。
 * @param {import('three').Box3} box 层级包围盒
 */
function cameraPoseFor(box) {
  const camera = three.value?.camera
  if (!camera) return null

  return fitCameraToBox(box, {
    fov: camera.fov,
    aspect: camera.aspect,
    near: camera.near,
    far: camera.far,
  })
}

/** 相机过渡。过渡期间关掉控制器阻尼，否则会与补间互相拉扯。 */
function moveCamera(pose, duration = 0.95) {
  const camera = three.value?.camera
  const controls = three.value?.controls
  if (!pose || !camera || !controls) return

  cameraTween?.kill()

  if (!duration) {
    // 可能是打断了一个正在进行的补间，这里必须把控制器状态恢复，
    // 否则 controls.enabled 会一直停在 false（补间的 onComplete 不会再触发）
    controls.enabled = true
    camera.position.copy(pose.position)
    controls.target.copy(pose.target)
    camera.lookAt(pose.target)
    controls.update()
    return
  }

  const fromPosition = camera.position.clone()
  const fromTarget = controls.target.clone()
  const state = { t: 0 }
  const { enableDamping } = controls

  controls.enableDamping = false
  controls.enabled = false

  cameraTween = gsap.to(state, {
    t: 1,
    duration,
    ease: 'power3.inOut',
    onUpdate: () => {
      camera.position.lerpVectors(fromPosition, pose.position, state.t)
      controls.target.lerpVectors(fromTarget, pose.target, state.t)
      camera.lookAt(controls.target)
    },
    onComplete: () => {
      controls.enabled = true
      controls.enableDamping = enableDamping
      controls.update()
    },
  })
}

/**
 * 显示某个层级。
 * @param {{ regions: Object[], name: string, depth: number }} node 层级节点
 * @param {{ animate?: boolean }} [options]
 */
function showLevel(node, { animate = true } = {}) {
  const scene = three.value?.scene
  if (!scene) return

  const { group, meshes } = buildLevel(node.regions)
  scene.add(group)

  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const extent = Math.max(size.x, size.z)
  const previous = levelGroup

  levelGroup = group
  levelMeshes = meshes
  hoveredMesh = null
  hovered.value = null

  if (previous) {
    if (animate) {
      fadeGroup(previous, 0, 0.3)
      gsap.delayedCall(0.34, () => disposeLevelGroup(previous))
    } else {
      disposeLevelGroup(previous)
    }
  }

  if (animate) {
    applyGroupOpacity(group, 0)
    fadeGroup(group, 1, 0.45)
  } else {
    applyGroupOpacity(group, 1)
  }

  rebuildFlyLines(node.regions, extent, animate)
  moveCamera(cameraPoseFor(box), animate ? 0.95 : 0)
  updateStatus(node)
}

function updateStatus(node) {
  const count = node.regions.length
  const unit = node.depth === 0 ? '个地级市' : '个区县'
  const tip = node.depth === 0 ? '单击区域下钻' : 'Esc 或面包屑返回上级'
  statusText.value = `${node.name} · ${count} ${unit} · ${tip}`
}

/** 临时提示（压过状态行 1.8s 后恢复）。 */
function flashHint(message) {
  statusText.value = message
  window.clearTimeout(hintTimer)
  hintTimer = window.setTimeout(() => {
    // 注意在回调里取当前层级：下钻/返回会在提示期间改变栈顶，
    // 若在函数入口捕获 node，恢复时会把旧层级的状态写回去
    const node = stack[stack.length - 1]
    if (node) updateStatus(node)
  }, 1800)
}

function syncBreadcrumb() {
  breadcrumb.value = stack.map((node) => ({ adcode: node.adcode, name: node.name }))
}

/** 下钻：解析子级 → 入栈 → 切换层级。 */
async function drillInto(feature) {
  if (isTransitioning) return

  const properties = feature.properties ?? {}
  const node = { adcode: properties.adcode, name: properties.name, depth: stack.length }

  isTransitioning = true
  flashHint(`正在加载 ${node.name} 的下级区划…`)

  try {
    const regions = await resolveRegions(node)
    if (!regions.length) {
      flashHint(`${node.name} 暂无下级区划数据`)
      return
    }

    node.regions = regions
    stack.push(node)
    syncBreadcrumb()
    showLevel(node, { animate: true })
  } catch (error) {
    console.error('下钻失败：', error)
    flashHint('数据加载失败，请重试')
  } finally {
    isTransitioning = false
  }
}

/** 回到指定层级（面包屑点击）。数据在节点上已缓存，不需要重新请求。 */
async function goToDepth(index) {
  if (isTransitioning) return
  if (index < 0 || index >= stack.length - 1) return

  isTransitioning = true
  try {
    stack = stack.slice(0, index + 1)
    syncBreadcrumb()
    showLevel(stack[index], { animate: true })
  } finally {
    isTransitioning = false
  }
}

function goUp() {
  if (stack.length < 2) return
  goToDepth(stack.length - 2)
}

/* ------------------------------ 交互 ------------------------------ */

function updatePointer(event) {
  const element = container.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  pointerClient.x = event.clientX
  pointerClient.y = event.clientY
}

/**
 * 事件是否落在画布本身上。
 *
 * 面包屑、返回按钮、状态行都是画布之上的浮层，但和 canvas 同属 stage 容器，
 * 监听器挂在容器上，浮层上的点击会一路冒泡过来。若不拦截，点「返回上级」会同时
 * 以按钮坐标为原点做一次地图拾取：此时相机还在过渡途中，射线往往命中某个地级市，
 * 于是刚退出的层级又被下钻回去 —— 表现为「返回上级却跳到了别的市」。
 * @param {Event} event
 */
function isMapPointer(event) {
  return event.target === mapCanvas.value
}

function pickRegion() {
  const camera = three.value?.camera
  if (!camera || !levelMeshes.length) return null
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(levelMeshes, false)
  return hits.length ? hits[0].object : null
}

function setRegionHighlight(mesh, active) {
  const { baseColor, edge } = mesh.userData
  mesh.material.color.setHex(active ? 0x2c8aa4 : baseColor)
  mesh.material.emissive.setHex(active ? 0x1d6a83 : 0x061a24)
  if (edge) edge.material.opacity = active ? 0.95 : EDGE_OPACITY
}

function moveTooltip() {
  const x = Math.min(pointerClient.x + 16, window.innerWidth - 180)
  const y = Math.min(pointerClient.y + 18, window.innerHeight - 80)
  tooltipStyle.value = { transform: `translate3d(${x}px, ${y}px, 0)` }
}

function updateHover() {
  const mesh = pickRegion()

  if (mesh === hoveredMesh) {
    if (mesh) moveTooltip()
    return
  }

  if (hoveredMesh) setRegionHighlight(hoveredMesh, false)
  hoveredMesh = mesh

  if (!mesh) {
    hovered.value = null
    if (container.value) container.value.style.cursor = 'default'
    return
  }

  const feature = mesh.userData.feature
  const drillable = canDrill(feature)

  setRegionHighlight(mesh, true)
  hovered.value = {
    name: feature.properties?.name ?? '未知区域',
    hint: drillable ? '单击下钻' : drillBlockedHint(feature),
  }
  if (container.value) container.value.style.cursor = drillable ? 'pointer' : 'default'
  moveTooltip()
}

/** 清掉当前悬停态（指针离开画布、或移到浮层上时调用）。 */
function clearHover() {
  if (hoveredMesh) setRegionHighlight(hoveredMesh, false)
  hoveredMesh = null
  hovered.value = null
  if (container.value) container.value.style.cursor = 'default'
}

function onPointerMove(event) {
  pendingPointerEvent = event
  if (hoverFrame) return
  // 每帧最多拾取一次：pointermove 的触发频率远高于渲染帧率
  hoverFrame = window.requestAnimationFrame(() => {
    hoverFrame = 0
    if (!pendingPointerEvent) return
    // 指针移到面包屑/按钮上时，不能让射线穿透浮层去高亮下面的板块
    if (!isMapPointer(pendingPointerEvent)) {
      clearHover()
      return
    }
    updatePointer(pendingPointerEvent)
    updateHover()
  })
}

function onPointerLeave() {
  clearHover()
}

async function onClick(event) {
  if (isTransitioning) return
  // 浮层（面包屑 / 返回上级 / 状态行）的点击会冒泡到这里，必须丢弃，
  // 否则「返回上级」会在同一帧里再触发一次地图拾取，把层级又钻回去
  if (!isMapPointer(event)) return

  updatePointer(event)

  const mesh = pickRegion()
  if (!mesh) return

  const feature = mesh.userData.feature
  if (!canDrill(feature)) {
    const name = feature.properties?.name ?? '该区域'
    flashHint(`${name} ${drillBlockedHint(feature)}`)
    return
  }

  await drillInto(feature)
}

function onKeyDown(event) {
  if (event.key === 'Escape') goUp()
}

/* ------------------------------ 生命周期 ------------------------------ */

onMounted(async () => {
  const map = three.value
  if (!map) return

  flyLines = new FlyLineFlow({ scene: map.scene })

  map.scene.add(new THREE.AmbientLight(0xffffff, 0.75))

  const keyLight = new THREE.DirectionalLight(0xd7f4ff, 1.1)
  keyLight.position.set(12, 26, 18)
  map.scene.add(keyLight)

  // 冷色补光，压住背光面的死黑
  const rimLight = new THREE.DirectionalLight(0x2f6ea8, 0.6)
  rimLight.position.set(-18, 12, -22)
  map.scene.add(rimLight)

  const grid = new THREE.GridHelper(60, 60, 0x12303f, 0x0b202b)
  grid.position.y = -0.02
  grid.material.transparent = true
  grid.material.opacity = 0.5
  map.scene.add(grid)

  map.tickClock.onTick((delta, elapsed) => {
    flyLines?.update(delta, elapsed)
  })

  try {
    const rootRegions = await loadGeoJson('guangdong')
    // 投影范围只在这里算一次，后续所有层级复用
    bounds = computeBounds(rootRegions.features)

    const root = { ...ROOT, depth: 0, regions: rootRegions.features }
    stack = [root]
    syncBreadcrumb()
    showLevel(root, { animate: false })

    // 窗宽变化会改变画幅比例，重新按包围盒取景，避免边缘被裁
    map.sizes.onResize(() => {
      if (!levelGroup) return
      moveCamera(cameraPoseFor(new THREE.Box3().setFromObject(levelGroup)), 0)
    })
  } catch (error) {
    console.error('地图数据加载失败：', error)
    statusText.value = '地图数据加载失败，请刷新重试'
    return
  }

  container.value?.addEventListener('pointermove', onPointerMove)
  container.value?.addEventListener('pointerleave', onPointerLeave)
  container.value?.addEventListener('click', onClick)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  container.value?.removeEventListener('pointermove', onPointerMove)
  container.value?.removeEventListener('pointerleave', onPointerLeave)
  container.value?.removeEventListener('click', onClick)
  window.removeEventListener('keydown', onKeyDown)

  window.clearTimeout(hintTimer)
  if (hoverFrame) window.cancelAnimationFrame(hoverFrame)
  hoverFrame = 0

  cameraTween?.kill()
  cameraTween = null

  killGroupTweens(levelGroup)
  flyLines?.dispose()
  flyLines = null
  disposeLevelGroup(levelGroup)
  levelGroup = null
  levelMeshes = []
})
</script>

<style scoped>
.flyline-stage {
  /* 深色径向渐变：比纯色背景更能把视线收到地图中心 */
  background: radial-gradient(ellipse at 50% 42%, #0d2c3f 0%, #071827 46%, #020a12 100%);
}

.drill-nav {
  position: absolute;
  top: 18px;
  left: 22px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
}

.drill-path {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 6px 12px;
  border: 1px solid rgba(63, 168, 208, 0.35);
  border-radius: 999px;
  background: rgba(5, 22, 34, 0.72);
  backdrop-filter: blur(6px);
  list-style: none;
}

.drill-path__item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.drill-crumb {
  padding: 2px 4px;
  border: none;
  background: none;
  color: #7fd7f2;
  font: inherit;
  cursor: pointer;
  transition: color 0.2s;
}

.drill-crumb:hover:not(:disabled) {
  color: #ffffff;
}

.drill-crumb.is-current {
  color: #ffffff;
  font-weight: 600;
  cursor: default;
}

.drill-slash {
  color: rgba(127, 215, 242, 0.45);
}

.drill-back {
  padding: 6px 14px;
  border: 1px solid rgba(63, 168, 208, 0.35);
  border-radius: 999px;
  background: rgba(5, 22, 34, 0.72);
  color: #a9e6f8;
  font: inherit;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.drill-back:hover:not(:disabled) {
  background: rgba(24, 74, 98, 0.85);
  color: #ffffff;
}

.drill-back:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.drill-status {
  position: absolute;
  bottom: 20px;
  left: 22px;
  z-index: 5;
  margin: 0;
  color: rgba(169, 230, 248, 0.78);
  font-size: 12px;
  letter-spacing: 0.04em;
  user-select: none;
}

.drill-tooltip {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 12px;
  border: 1px solid rgba(63, 168, 208, 0.35);
  border-radius: 6px;
  background: rgba(4, 18, 28, 0.9);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

.drill-tooltip.is-visible {
  opacity: 1;
}

.drill-tooltip__name {
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.drill-tooltip__hint {
  color: rgba(127, 215, 242, 0.75);
  font-size: 11px;
  white-space: nowrap;
}
</style>
