import { Vector3, BufferGeometry, LineSegments, LineBasicMaterial } from 'three'
import merge from 'lodash-es/merge'

/** @type {import('three').LineBasicMaterialParameters} */
const MAPLINE_DEFAULT_OPTS = {
  color: 0xffffff, // 颜色
  linewidth: 1, // 线宽
  fog: true, // 是否开启雾效
  linecap: 'round', // 线头样式
  linejoin: 'round', // 线角样式
}

export class MapLine extends LineSegments {
  /**
   * 
   * @param {*} param0 
   * @param {import('three').LineBasicMaterialParameters} opts 
   */
  constructor({ coordinates }, opts = {}) {
    const mergedOpts = merge({}, MAPLINE_DEFAULT_OPTS, opts)
    super(MapLine.#createGeometry(coordinates), new LineBasicMaterial(mergedOpts))
  }

  static #createGeometry(coordinates) {
    const points = []
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [x1, y1, z1 = 0] = coordinates[i]
      const [x2, y2, z2 = 0] = coordinates[i + 1]
      points.push(new Vector3(x1, y1, z1))
      points.push(new Vector3(x2, y2, z2))
    }
    return new BufferGeometry().setFromPoints(points)
  }
}
