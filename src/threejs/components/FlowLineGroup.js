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

export class FlowLineGroup {
  constructor({ tickClock }, opts = {}) {
    this.tickClock = tickClock
    this.opts = merge({}, FLG_DEFAULT_OPTS, opts)
    this.projection = getMercatorProjection(this.opts.projection)
    this.flowLineList = []
    this.init()
    return {
      instance: this.flowLineGroup,
      update: () => this.update(),
    }
  }
  init() {
    const { data, filter, depth, flowLineOpts } = this.opts
    if (!data) return console.warn('data is null, create flow line group failed')
    this.flowLineGroup = new Group()
    const outline = getUnion(data, { type: 'feature' })
    const { geometry = {} } = outline ?? {}
    const { coordinates = [], type } = geometry
    let polygons = coordinates
    if (type === 'Polygon') polygons = [coordinates]
    const polygens = getFeatureCoordinates(data, { filter })
    polygens?.forEach((polygon) => {
      // 转换坐标
      const points = polygon.map((coord) => {
        const [x, y] = this.projection(coord)
        return new Vector3(x, -y, depth)
      })
      const flowLine = new FlowLine({ tickClock: this.tickClock }, { ...flowLineOpts, points })
      this.flowLineGroup.add(flowLine.instance)
      // 如果有tickClock，就不添加到列表中；否则，添加到列表中，后续手动执行update方法更新
      if (!this.tickClock) this.flowLineList.push(flowLine)
    })
  }
  update() {
    this.flowLineList.forEach((flowLine) => flowLine.update())
  }
}
