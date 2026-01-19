import { PerspectiveCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export class Camera {
  constructor({ sizes, scene, canvas }) {
    this.sizes = sizes
    this.scene = scene
    this.canvas = canvas
    this.init()
  }
  init() {
    const aspectRatio = this.sizes.width / this.sizes.height
    this.instance = new PerspectiveCamera(45, aspectRatio, 1, 10000)
    this.instance.position.set(10, 10, 10)
    this.scene.add(this.instance)

    this.controls = new OrbitControls(this.instance, this.canvas)
    this.controls.enableDamping = true
    this.controls.update()
  }
  resize() {
    const aspectRatio = this.sizes.width / this.sizes.height
    this.instance.aspect = aspectRatio
    this.instance.updateProjectionMatrix()
  }
  destroy() {
    this.controls.dispose()
  }
}
