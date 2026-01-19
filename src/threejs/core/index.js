import { EventEmitter } from '@/utils/EventEmitter'
import { Scene } from 'three'
import { Size } from '../utils/Size'
import { Camera } from './Camera'
import { Renderer } from './Renderer'

export class Map3D extends EventEmitter {
  constructor(canvas, opts = {}) {
    super()
    this.canvas = canvas
    this.scene = new Scene()
    this.sizes = new Size(this)
    this.camera = new Camera(this)
    this.renderer = new Renderer(this)

    this.sizes.onResize(() => {
      this.camera.resize()
      this.renderer.resize()
    })

    this.animate()
  }
  animate() {
    requestAnimationFrame(() => {
      this.animate()
    })
    this.renderer.update()
  }
}
