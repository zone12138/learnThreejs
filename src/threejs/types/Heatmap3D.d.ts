import type { Mesh } from 'three'
import type { GeoProjectionOpts } from './Variable.js'

export interface Heatmap3DDataItem {
  x: number
  y: number
  value: number
}

export interface Heatmap3DOpts {
  /** 投影参数（heatmap.js 画布坐标 → 经纬度） */
  projection?: GeoProjectionOpts
  width?: number
  height?: number
  radius?: number
  maxOpacity?: number
  minOpacity?: number
  blur?: number
  /** 色带：键为 0~1 的字符串比例，值为 CSS 颜色 */
  gradient?: Record<string, string>
  maxValue?: number
  minValue?: number
  /** 热力点数据 */
  data?: Heatmap3DDataItem[]
}

/**
 * 用 heatmap.js 生成画布纹理再贴到平面上的伪 3D 热力图。
 * 纹理在组件内部创建，销毁时随 material 的 map 一并释放。
 */
export class Heatmap3D extends Mesh {
  constructor(opts?: Heatmap3DOpts)
}
