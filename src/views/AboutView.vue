<template>
  <div class="about" ref="aboutRef"></div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import { useThreejsGUI } from '@/hooks/GUI'

const aboutRef = ref(null)

const scene = new THREE.Scene()
// scene.background = new THREE.Color(0xffffff)

const geometry = new THREE.BoxGeometry(2, 1, 1)
const material = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true })
const mesh = new THREE.Mesh(geometry, material)
// 将立方体位置设置在相机前方
// mesh.position.set(0, 0, 5)
// 将立方体添加到场景
scene.add(mesh)
// 透视摄像机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
// 设置相机位置
// camera.position.set(0, 0, 7)
camera.position.z = 5
// 让相机看向立方体
camera.lookAt(mesh.position)
const cameraHelper = new THREE.CameraHelper(camera)
scene.add(cameraHelper)

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)

let controls = null

onMounted(() => {
  const aboutElement = aboutRef.value
  aboutElement.appendChild(renderer.domElement)

  // 创建OrbitControls实例
  controls = new OrbitControls(camera, renderer.domElement)
  // 🌟 旋转相关核心配置（重点）
  // controls.enableRotate = true // 允许旋转（默认true，可设false禁用）
  // controls.rotateSpeed = 1.0 // 旋转速度（默认1，值越大转得越快）
  controls.enableDamping = true // 旋转阻尼（拖拽后有惯性，更丝滑）
  // controls.dampingFactor = 0.05 // 阻尼系数（越小惯性越久）
  // controls.target.set(0, 0, 0) // 围绕 (0,1,0) 旋转（立方体中心偏上）
  // controls.update() // 更新控制器，确保相机看向目标点

  // 添加窗口大小调整事件监听
  window.addEventListener('resize', onWindowResize)

  // 开始动画循环
  animate()

  useThreejsGUI({ camera, mesh, cameraHelper, renderer, scene })
})

// 窗口大小调整函数
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// 动画循环函数
function animate() {
  requestAnimationFrame(animate)

  // 让立方体旋转（弧度/帧）
  mesh.rotation.x += 0.01
  mesh.rotation.y += 0.01

  // 更新控制器
  controls.update()

  // 渲染场景
  renderer.render(scene, camera)
}
</script>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>
