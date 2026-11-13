import type { Group, Material } from 'three'
import type { GeoProjectionOpts, Vector3LikeOrTuple } from './Variable.js'
import type { MapLabelOpts } from './MapLabel.js'
import type { FlowLineOpts } from './FlowLine.js'
import type { BasicThreejsContext } from './Core.js'

/** 事件监听项：target 由组件内部补全为对应 mesh */
export interface MapEventItem {
  /** three.interactive 支持的事件名 */
  event: string
  /** 事件回调 */
  callback: (event: unknown) => void
}

export interface Map3DOpts {
  /** 地图位置 */
  position?: Vector3LikeOrTuple
  /** 墨卡托投影参数 */
  projection?: GeoProjectionOpts
  /** 渲染顺序，用于解决与其它组件的遮挡 */
  renderOrder?: number
  /** 地表材质（正面） */
  surfaceMaterial?: Material
  /** 侧面材质；不传则由 extrudeOpts.depth 生成渐变侧壁 */
  sideMaterial?: Material | null
  /** 是否启用默认高亮（mouseover/mouseout 切换材质） */
  highLight?: boolean
  /** 高亮材质 */
  highLightMaterial?: Material
  /** 挤出参数 */
  extrudeOpts?: {
    depth?: number
    bevelEnabled?: boolean
    bevelSegments?: number
    bevelThickness?: number
  }
  /** GeoJSON FeatureCollection */
  data?: object | null
  /** 是否自动挂到场景 */
  autoAddToScene?: boolean
  /** 地图轮廓线 */
  mapLine?: {
    show?: boolean
    opts?: Record<string, unknown>
  }
  /** 地图名称标签 */
  mapLabel?: {
    show?: boolean
    opts?: MapLabelOpts
  }
  /** 流动线 */
  flowLine?: {
    show?: boolean
    /** all: 全部；max: 最长；min: 最短；number: 第 n 条；number[]: 多条 */
    filter?: 'all' | 'max' | 'min' | number | number[]
    opts?: FlowLineOpts
  }
  /** 交互事件列表 */
  eventList?: MapEventItem[]
}

/**
 * 3D 挤出地图组件。
 * 构造后通过 `.instance`（主 Group）/ `.lineGroup` / `.labelGroup` / `.flowLineGroup` 访问内部对象。
 */
export class Map3D {
  constructor(basic: BasicThreejsContext, opts?: Map3DOpts)
  /** 主 Group */
  readonly instance: Group
  readonly lineGroup?: Group
  readonly labelGroup?: Group
  readonly flowLineGroup?: Group
  readonly opts: Map3DOpts
}
