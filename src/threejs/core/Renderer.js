import { WebGLRenderer } from 'three'

export class Renderer {
  constructor({ canvas, sizes, scene, camera }) {
    this.canvas = canvas
    this.sizes = sizes
    this.scene = scene
    this.camera = camera
    this.init()
  }
  init() {
    this.instance = new WebGLRenderer({ alpha: false, antialias: true, canvas: this.canvas })
    this.resize()
  }
  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(this.sizes.pixelRatio)
  }
  update() {
    this.instance.render(this.scene, this.camera.instance)
  }
  destroy() {
    this.instance.dispose()
    this.instance.forceContextLoss()
  }
}
