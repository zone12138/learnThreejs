import { GUI } from 'lil-gui'
import { Color } from 'three'

export function useThreejsGUI(
  { camera, mesh, material, cameraHelper, renderer, scene },
  GUIOpts = {},
) {
  const { title = 'Three.js 调试面板', width = 400, closeFolders = false } = GUIOpts
  const gui = new GUI({
    title, // 面板标题
    width, // 面板宽度
    closeFolders, // 默认展开所有折叠面板
  })
  const position = ['x', 'y', 'z']
  const vision = [
    { name: '视野角度', prop: 'fov' },
    { name: '近裁剪面', prop: 'near' },
    { name: '远裁剪面', prop: 'far' },
  ]

  if (scene) {
    console.log(scene.background)
    const sceneFolder = gui.addFolder('scene-场景')
    sceneFolder
      .addColor({ color: scene.background?.getHexString() ?? '#000000' }, 'color')
      .name('场景背景')
      .onChange((value) => {
        scene.background = new Color(value)
      })
  }

  if (camera) {
    const cameraFolder = gui.addFolder('camera-相机')
    position.forEach((p) => {
      cameraFolder
        .add(camera.position, p, -100, 100, 1)
        .name(`${p}轴位置`)
        .onChange((value) => {
          console.log(`position.${p}`, value)
          camera.position[p] = value
        })
    })
    vision.forEach((v) => {
      cameraFolder
        .add(camera, v.prop, 0, 180, 1)
        .name(`${v.name}值 (${v.prop})`)
        .onChange(() => {
          camera.updateProjectionMatrix()
          cameraHelper?.update() // 同步更新相机助手
        })
    })
  }

  if (mesh) {
    const meshFolder = gui.addFolder('mesh-网格')
    position.forEach((p) => {
      meshFolder
        .add(mesh.position, p, -100, 100, 1)
        .name(`${p}轴位置`)
        .onChange((value) => {
          console.log(`position.${p}`, value)
          mesh.position[p] = value
        })
    })
    // 颜色：适配 Three.js 颜色格式（支持 16 进制/颜色名）
    console.log(mesh.material.color)
    meshFolder
      .addColor({ color: mesh?.material?.color?.getHexString() ?? '#000000' }, 'color')
      .name('立方体颜色')
      .onChange((value) => {
        mesh.material.color = new Color(value) // 更新材质颜色
      })
    // 布尔值：是否显示线框
    meshFolder.add(mesh.material, 'wireframe').name('显示线框')
    // 透明度：需开启 transparent = true
    meshFolder.add(mesh.material, 'opacity', 0, 1, 0.01).name('透明度')
  }

  if (cameraHelper) {
    const cameraHelperFolder = gui.addFolder('cameraHelper-相机辅助')
  }

  if (renderer) {
    const rendererFolder = gui.addFolder('renderer-渲染器')
  }
  console.log(gui)
  return gui
}
