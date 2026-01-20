import { EventEmitter } from '@/utils/EventEmitter'
import { Scene, Mesh } from 'three'
import { Size } from '../utils/Size'
import { Camera } from './Camera'
import { Renderer } from './Renderer'
import { TickClock } from '../utils/TickClock'

export class BasicThreejs extends EventEmitter {
  constructor(canvas, opts = {}) {
    super()
    this.canvas = canvas
    this.scene = new Scene()
    this.sizes = new Size(this)
    this.camera = new Camera(this, opts.cameraOpts || {})
    this.renderer = new Renderer(this)
    this.tickClock = new TickClock()

    this.sizes.onResize(() => {
      this.camera.resize()
      this.renderer.resize()
    })

    this.tickClock.onTick((...args) => {
      this.camera.update(...args)
      this.renderer.update(...args)
    })
  }
  destroy() {
    this.sizes.destroy()
    this.camera.destroy()
    this.renderer.destroy()
    this.tickClock.destroy()
    this.scene.traverse((child) => {
      if (child instanceof Mesh) {
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
  }
}
