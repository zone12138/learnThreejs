<template>
  <div class="demo-stage demo-stage--viewport">
    <canvas ref="mapCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'
import { useThree } from '@/hooks/useThree'
import { loadGeoJson } from '@/utils/geoLoader'
import { PROJECTION } from '@/threejs/config/geo'
import { forEachRing, createRingGeometry } from '@/threejs/utils/geoShape'

// 地面板块颜色（米白）：不受光照影响，只作为暗色场景里的底衬
const GROUND_COLOR = 0xf5f5dc

const mapCanvas = ref(null)

// 场景/相机/渲染器/控制器/渲染循环/清理统一由 BasicThreejs 承担
const three = useThree(mapCanvas, {
  cameraOpts: {
    fov: 75,
    near: 0.1,
    far: 1000,
    position: new THREE.Vector3(0, 0, 5),
  },
  rendererOpts: {
    alpha: true,
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
  map.scene.background = new THREE.Color(0x000000)
  map.camera.lookAt(0, 0, 0)

  const groundMapData = await loadGeoJson('guangdong-districts')
  setupGround(groundMapData)
})

// 初始化地面
const setupGround = (groundMapData) => {
  const scene = three.value.scene
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

  createGroundMap(groundMapData)
}

// 创建地面地图：每个环挤出为薄片，并用轮廓线强化边界
const createGroundMap = (mapShapeData) => {
  const scene = three.value.scene
  const mapGroup = new THREE.Object3D()
  scene.add(mapGroup)

  const projection = geoMercator()
    .center(PROJECTION.guangzhou.center)
    .scale(PROJECTION.guangzhou.scale)
    .translate(PROJECTION.guangzhou.translate)

  mapShapeData.features.forEach((feature) => {
    const cityName = feature.properties?.name

    forEachRing(feature, (ring) => {
      const geometry = createRingGeometry(ring, projection, { depth: 0, bevelEnabled: false })
      if (!geometry) return

      // 三份同色材质：ExtrudeGeometry 的正面/侧面/顶底面各取一份，避免光照造成的鳞片状反光
      const materials = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: GROUND_COLOR }))
      const mesh = new THREE.Mesh(geometry, materials)
      mesh.userData = { originalColor: GROUND_COLOR, cityName }

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8 }),
      )
      mesh.add(outline)

      mapGroup.add(mesh)
    })
  })

  return mapGroup
}
</script>
