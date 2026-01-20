import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { getV3Position } from '../utils/Position'

const CAMERA_DEFAULT_OPTS = {
  position: new Vector3(0, 0, 5),
  fov: 45,
  near: 1,
  far: 10000,
}

export class Camera {
  constructor({ sizes, scene, canvas }, opts = {}) {
    this.sizes = sizes
    this.scene = scene
    this.canvas = canvas
    this.opts = Object.assign({}, CAMERA_DEFAULT_OPTS, opts)
    this.init()
  }
  init() {
    const aspectRatio = this.sizes.width / this.sizes.height
    const { fov, near, far, position } = this.opts
    this.instance = new PerspectiveCamera(fov, aspectRatio, near, far)
    this.instance.position.copy(getV3Position(position))
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
  update() {
    this.controls.update()
  }
  destroy() {
    this.controls.dispose()
  }
}
