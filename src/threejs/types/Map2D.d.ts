import type { Group, Material } from 'three'
import type { GeoProjectionOpts, Vector3LikeOrTuple } from './Variable.js'
import type { MapLabelOpts } from './MapLabel.js'
import type { FlowLineOpts } from './FlowLine.js'
import type { BasicThreejsContext } from './Core.js'
import type { MapEventItem } from './Map3D.js'

export interface Map2DOpts {
  /** 地图位置 */
  position?: Vector3LikeOrTuple
  /** 墨卡托投影参数 */
  projection?: GeoProjectionOpts
  /** 渲染顺序 */
  renderOrder?: number
  /** 地图材质 */
  material?: Material
  /** 是否启用默认高亮 */
  highLight?: boolean
  /** 高亮材质 */
  highLightMaterial?: Material
  /** GeoJSON FeatureCollection */
  data?: object | null
  /** 是否自动挂到场景 */
  autoAddToScene?: boolean
  /** 是否把所有区域合并成一个几何体（合并后不再有独立交互） */
  mergeAll?: boolean
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
    filter?: 'all' | 'max' | 'min' | number | number[]
    opts?: FlowLineOpts
  }
  /** 交互事件列表 */
  eventList?: MapEventItem[]
}

/**
 * 2D 平面地图组件（ShapeGeometry，无厚度）。
 * 构造后通过 `.instance` 访问主 Group。
 */
export class Map2D {
  constructor(basic: BasicThreejsContext, opts?: Map2DOpts)
  /** 主 Group */
  readonly instance: Group
  readonly lineGroup?: Group
  readonly labelGroup?: Group
  readonly flowLineGroup?: Group
  readonly opts: Map2DOpts
}
