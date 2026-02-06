import type { ColorRepresentation } from 'three'
import { Vector3LikeOrTuple } from './Variable'

export interface ScanOpts {
  /**
   * 是否开启扫光效果
   */
  enabled?: boolean
  /**
   * 扫光3D中心
   */
  center?: Vector3LikeOrTuple
  /**
   * 扫光颜色
   * @example 0xffffff
   */
  color?: ColorRepresentation
  /**
   * 扫光宽度(浮点数 float)
   */
  width?: number
  /**
   * 扫光高度(浮点数 float)
   */
  bumpHeight?: number
  /**
   * 扫光速度
   */
  speed?: number
}

export interface GridOpts {
  /**
   * 网格名称
   */
  name?: string
  /**
   * 网格位置
   */
  position?: Vector3LikeOrTuple
  /**
   * 网格大小
   */
  gridSize?: number
  /**
   * 网格划分
   */
  gridDivision?: number
  /**
   * 网格形状大小
   */
  shapeSize?: number
  /**
   * 网格形状颜色
   */
  shapeColor?: ColorRepresentation
  /**
   * 网格点大小
   */
  pointSize?: number
  /**
   * 网格点颜色
   */
  pointColor?: ColorRepresentation
  /**
   * 网格点布局
   */
  pointLayout?: {
    /**
     * 网格点行数
     */
    row: number
    /**
     * 网格点列数
     */
    col: number
  }
  /**
   * 扫光效果
   */
  scan?: ScanOpts
  /**
   * 是否自动添加到场景
   */
  autoAddToScene?: boolean
}
