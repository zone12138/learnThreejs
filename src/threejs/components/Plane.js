import { Vector3, MeshBasicMaterial, PlaneGeometry, Mesh } from 'three'
import { getV3Position } from '../utils/Position'

const PLANE_DEFAULT_OPTS = {
  width: 10,
  scale: 1,
  position: new Vector3(0, 0, 0),
  autoRotate: true,
  rotateSpeed: 0.001,
  material: new MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    depthTest: true,
  }),
}

export class Plane {
  constructor({ scene, tickClock }, opts = {}) {
    this.scene = scene
    this.tickClock = tickClock
    this.opts = Object.assign({}, PLANE_DEFAULT_OPTS, opts)
    return this.init()
  }
  init() {
    const { width, scale, material, position } = this.opts
    const geometry = new PlaneGeometry(width, width)
    const mesh = new Mesh(geometry, material)
    mesh.scale.set(scale, scale, scale)
    mesh.position.copy(getV3Position(position))
    this.instance = mesh
    this.scene?.add(mesh)

    this.tickClock?.onTick(() => this.update())
    return mesh
  }
  update() {
    if (this.opts.autoRotate) {
      this.instance.rotation.z += this.opts.rotateSpeed
    }
  }
}
