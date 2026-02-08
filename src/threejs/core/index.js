import { Scene, Mesh } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { InteractionManager } from 'three.interactive'
import merge from 'lodash-es/merge'
import { Camera } from './Camera'
import { Renderer } from './Renderer'
import { TickClock, Size } from '../utils/index'

const BASIC_DEFAULT_OPTS = {
  cameraOpts: {}, // 相机选项
  useInteraction: true, // 是否使用交互管理器
}

export class BasicThreejs {
  constructor(canvas, opts = {}) {
    const options = merge({}, BASIC_DEFAULT_OPTS, opts)
    this.canvas = canvas
    this.scene = new Scene()
    this.sizes = new Size(this)
    this.camera = new Camera(this, options.cameraOpts)
    this.renderer = new Renderer(this)
    this.tickClock = new TickClock()

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.update()

    this.interactionManager = null
    if (options.useInteraction) {
      this.interactionManager = new InteractionManager(this.renderer, this.camera, canvas)
    }

    this.tickClock.onTick((...args) => {
      this.controls?.update?.(...args)
      this.renderer.render(this.scene, this.camera)
      this.interactionManager?.update?.(...args)
    })
  }
  destroy() {
    this.sizes.destroy()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.tickClock.destroy()
    this.interactionManager?.dispose()
    this.controls.dispose()
    this.scene.traverse((child) => {
      if (child instanceof Mesh) {
        this.interactionManager?.remove(child)
        child.userData.cleanup?.()
        child.userData.cleanup = null
        child?.geometry?.dispose?.()
        for (const key in child.material) {
          const value = child.material[key]
          if (value && typeof value.dispose === 'function') {
            value.dispose()
          }
        }
        child?.material?.dispose?.()
      } else if (child.isHelper) {
        // 销毁所有辅助对象，包括 CameraHelper
        child?.dispose?.()
      }
    })
    this.canvas.parentNode.removeChild(this.canvas)

    this.scene = null
    this.renderer = null
    this.camera = null
    this.controls = null
    this.tickClock = null
    this.sizes = null
    this.canvas = null
    this.interactionManager = null
  }
}
