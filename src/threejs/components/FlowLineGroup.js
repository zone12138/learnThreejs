import { Group, Vector3 } from 'three'
import merge from 'lodash-es/merge'
import { FlowLine } from './index'
import { getUnion, getMercatorProjection, getFeatureCoordinates } from '../libs/index.js'

const FLG_DEFAULT_OPTS = {
  projection: {
    center: [0, 0],
    scale: 50,
    translate: [0, 0],
  },
  data: null,
  depth: 0, // 流光线段z轴坐标【3D的需加上z轴】
  filter: 'all', // all: 所有线; max: 最大线; min: 最小线; number: 第几条线; Array<number>: 多条线
  flowLineOpts: {},
}

export class FlowLineGroup extends Group {
  #opts = {}
  #flowLineList = []
  /**
   * 
   * @param {*} param0 时钟对象
   * @param {import('../types').FlowLineGroupOpts} opts 配置项
   */
  constructor({ tickClock }, opts = {}) {
    super()
    this.#opts = merge({}, FLG_DEFAULT_OPTS, opts)
    this.#init({ tickClock }, this.#opts)

    this.userData.update = () => {
      this.#flowLineList.forEach((flowLine) => flowLine.userData.update())
    }
    tickClock?.onTick(() => this.userData.update())
  }
  #init({ tickClock }, opts) {
    const { data, projection, filter, depth, flowLineOpts } = opts
    if (!data) return console.warn('data is null, create flow line group failed')
    const mercatorProjection = getMercatorProjection(projection)
    const outline = getUnion(data, { type: 'feature' })
    const { geometry = {} } = outline ?? {}
    const { coordinates = [], type } = geometry
    let polygons = coordinates
    if (type === 'Polygon') polygons = [coordinates]
    const polygens = getFeatureCoordinates(data, { filter })
    polygens?.forEach((polygon) => {
      // 转换坐标
      const points = polygon.map((coord) => {
        const [x, y] = mercatorProjection(coord)
        return new Vector3(x, -y, depth)
      })
      const flowLine = new FlowLine({ tickClock }, { ...flowLineOpts, points })
      this.add(flowLine)
      // 如果有tickClock，就不添加到列表中；否则，添加到列表中，后续手动执行update方法更新
      if (!tickClock) this.#flowLineList.push(flowLine)
    })
  }
}
