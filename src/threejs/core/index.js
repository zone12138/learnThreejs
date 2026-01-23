import { Scene, Mesh } from 'three'
import { InteractionManager } from 'three.interactive'
import merge from 'lodash-es/merge'
import { Camera } from './Camera'
import { Renderer } from './Renderer'
import { TickClock, Size } from '../utils/index'
import { EventEmitter } from '../libs/index'

const BASIC_DEFAULT_OPTS = {
  cameraOpts: {},
  useInteraction: true,
}

export class BasicThreejs extends EventEmitter {
  constructor(canvas, opts = {}) {
    super()
    this.opts = merge({}, BASIC_DEFAULT_OPTS, opts)
    this.canvas = canvas
    this.scene = new Scene()
    this.sizes = new Size(this)
    this.camera = new Camera(this, this.opts.cameraOpts)
    this.renderer = new Renderer(this)
    this.tickClock = new TickClock()

    this.interactionManager = null
    if (this.opts.useInteraction) {
      this.interactionManager = new InteractionManager(
        this.renderer.instance,
        this.camera.instance,
        canvas,
      )
    }

    this.sizes.onResize(() => {
      this.camera.resize()
      this.renderer.resize()
    })

    this.tickClock.onTick((...args) => {
      this.camera.update(...args)
      this.renderer.update(...args)
      this.interactionManager?.update(...args)
    })
  }
  destroy() {
    this.sizes.destroy()
    this.camera.destroy()
    this.renderer.destroy()
    this.tickClock.destroy()
    this.interactionManager?.dispose()
    this.scene.traverse((child) => {
      if (child instanceof Mesh) {
        this.interactionManager?.remove(child)
        child.userData.cleanup?.()
        child.userData.cleanup = null
        child.geometry.dispose()
        for (const key in child.material) {
          const value = child.material[key]
          if (value && typeof value.dispose === 'function') {
            value.dispose()
          }
        }
      }
    })
    this.canvas.parentNode.removeChild(this.canvas)

    this.scene = null
    this.camera = null
    this.renderer = null
    this.tickClock = null
    this.sizes = null
    this.canvas = null
    this.interactionManager = null
  }
}
