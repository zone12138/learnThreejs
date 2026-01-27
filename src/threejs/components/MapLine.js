import { Vector3, BufferGeometry, LineSegments, LineBasicMaterial } from 'three'

const MAPLINE_DEFAULT_OPTS = {
  color: 0xffffff, // 颜色
  linewidth: 1, // 线宽
  fog: true, // 是否开启雾效
  linecap: 'round', // 线头样式
  linejoin: 'round', // 线角样式
}

export class MapLine {
  constructor({ coordinates }, opts = {}) {
    this.coordinates = coordinates
    this.opts = Object.assign({}, MAPLINE_DEFAULT_OPTS, opts)
    return this.create()
  }

  create() {
    const points = []
    for (let i = 0; i < this.coordinates.length - 1; i++) {
      const [x1, y1, z1 = 0] = this.coordinates[i]
      const [x2, y2, z2 = 0] = this.coordinates[i + 1]
      points.push(new Vector3(x1, y1, z1))
      points.push(new Vector3(x2, y2, z2))
    }
    const geometry = new BufferGeometry().setFromPoints(points)
    const material = new LineBasicMaterial(this.opts)
    return new LineSegments(geometry, material)
  }
}
