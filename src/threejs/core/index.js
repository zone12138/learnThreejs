import { Scene, Mesh } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { InteractionManager } from 'three.interactive'
import merge from 'lodash-es/merge'
import { Camera } from './Camera'
import { Renderer } from './Renderer'
import { TickClock, Size } from '../utils/index'

const BASIC_DEFAULT_OPTS = {
  cameraOpts: {}, // 相机选项
  rendererOpts: {}, // 渲染器选项（antialias / alpha / toneMapping 等）
  controlsOpts: {}, // 轨道控制器选项（minDistance / maxDistance 等）
  useInteraction: true, // 是否使用交互管理器
}

/**
 * Three.js 场景管理基座：统一持有 scene / camera / renderer / controls /
 * tickClock / interactionManager，并负责渲染循环与整体资源回收。
 * 视图与组件只应依赖本实例，不再自行创建渲染器与动画循环。
 */
export class BasicThreejs {
  constructor(canvas, opts = {}) {
    this.opts = merge({}, BASIC_DEFAULT_OPTS, opts)
    this.canvas = canvas
    this.scene = new Scene()
    this.sizes = new Size(this)
    this.camera = new Camera(this, this.opts.cameraOpts)
    this.renderer = new Renderer(this)
    this.tickClock = new TickClock()

    this.controls = new OrbitControls(this.camera, this.canvas)
    const { minDistance, maxDistance, ...restControlsOpts } = this.opts.controlsOpts
    if (minDistance != null) this.controls.minDistance = minDistance
    if (maxDistance != null) this.controls.maxDistance = maxDistance
    Object.assign(this.controls, restControlsOpts)
    this.controls.enableDamping = true
    this.controls.update()

    this.interactionManager = null
    if (this.opts.useInteraction) {
      this.interactionManager = new InteractionManager(this.renderer, this.camera, canvas)
    }

    this.tickClock.onTick((...args) => {
      this.controls?.update?.(...args)
      this.renderer.render(this.scene, this.camera)
      this.interactionManager?.update?.(...args)
    })
  }

  /** 当前场景是否已被销毁（destroy 幂等，可安全重复调用） */
  get destroyed() {
    return this._destroyed === true
  }

  destroy() {
    // 幂等保护：视图的 cleanup 按钮与 onUnmounted 可能各调用一次
    if (this._destroyed) return
    this._destroyed = true

    this.sizes.destroy()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.tickClock.destroy()
    this.interactionManager?.dispose()
    this.controls.dispose()

    this.scene?.traverse((child) => {
      // 先触发组件注册的非常规清理（如解绑 DOM 事件）
      child.userData?.cleanup?.()
      child.userData.cleanup = null

      const isRenderable = child instanceof Mesh || child.isLine || child.isSprite || child.isPoints
      if (isRenderable) {
        if (child instanceof Mesh) this.interactionManager?.remove(child)
        child.geometry?.dispose?.()
        // material 可能是数组（ExtrudeGeometry 正/侧面双材质）
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.filter(Boolean).forEach((mat) => mat.dispose?.())
      } else if (child.isHelper) {
        // 销毁所有辅助对象，包括 CameraHelper
        child?.dispose?.()
      }
    })

    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }

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
