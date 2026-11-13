import { Vector3, MeshBasicMaterial, PlaneGeometry, Mesh } from 'three'
import merge from 'lodash-es/merge'
import { getV3Position } from '../utils/index.js'

/**
 * 默认配置工厂：材质 / Vector3 每次新生成，避免跨实例共享。
 * @returns {import('../types').PlaneOpts}
 */
const createPlaneDefaultOpts = () => ({
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
})

export class Plane extends Mesh {
  #opts = {}
  /**
   * 平面组件
   * @param {Object} basic - BasicThreejs 实例（依赖其 scene / tickClock）
   * @param {import('../types').PlaneOpts} opts 配置项
   */
  constructor(basic, opts = {}) {
    const { scene, tickClock } = basic ?? {}
    const mergedOpts = merge({}, createPlaneDefaultOpts(), opts)
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
