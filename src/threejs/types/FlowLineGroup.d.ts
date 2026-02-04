import { GeoProjection } from './Variable.js'
import { FlowLineOpts } from './FlowLine.d.ts'

type FilterEnum = 'all' | 'min' | 'max' | number | number[]

export interface FlowLineGroupOpts {
  /**
   * 投影配置项
   */
  projection: GeoProjection
  /**
   * 数据数组
   */
  data: any[] | null
  /**
   * 深度值(3D的Z轴使用)
   */
  depth: number
  /**
   * 过滤数据
   */
  filter: FilterEnum
  /**
   * 流动线配置项数组
   */
  flowLineOpts: FlowLineOpts
}