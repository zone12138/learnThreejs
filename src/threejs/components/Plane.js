import { Vector3, MeshBasicMaterial, PlaneGeometry, Mesh } from 'three'
import merge from 'lodash-es/merge'
import { getV3Position } from '../utils/index.js'

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
  renderOrder: 0,
  autoAddToScene: true,
}

export class Plane extends Mesh {
  #opts = {}
  /**
   * 
   * @param {*} param0 时钟对象
   * @param {import('../types').PlaneOpts} opts 配置项
   */
  constructor({ scene, tickClock }, opts = {}) {
    const mergedOpts = merge({}, PLANE_DEFAULT_OPTS, opts)
    super(new PlaneGeometry(mergedOpts.width, mergedOpts.width), mergedOpts.material)
    this.#opts = mergedOpts
    this.renderOrder = mergedOpts.renderOrder
    this.scale.set(mergedOpts.scale, mergedOpts.scale, mergedOpts.scale)
    this.position.copy(getV3Position(mergedOpts.position))

    this.userData.update = () => {
      if (this.#opts.autoRotate) {
        this.rotation.z += this.#opts.rotateSpeed
      }
    }
    tickClock?.onTick(() => this.userData.update())

    if (mergedOpts.autoAddToScene) scene?.add(this)
  }
}
