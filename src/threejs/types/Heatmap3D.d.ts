import type { Mesh } from 'three'
import type { GeoProjectionOpts } from './Variable.js'

/** 热力点数据：经纬度格式（推荐，走投影与地图对齐） */
export interface Heatmap3DGeoDataItem {
  lng: number
  lat: number
  value: number
}

/** 热力点数据：画布像素格式（兼容旧数据，0~512） */
export interface Heatmap3DPixelDataItem {
  x: number
  y: number
  value: number
}

export type Heatmap3DDataItem = Heatmap3DGeoDataItem | Heatmap3DPixelDataItem

export interface Heatmap3DOpts {
  /** 投影参数（经纬度 → 画布坐标），需与地图组件一致才能对齐 */
  projection?: GeoProjectionOpts
  /** 热力图平面的世界坐标边长，需覆盖地图投影范围 */
  worldSize?: number
  /** 热点半径（世界单位） */
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
 * 纹理在组件内部创建，销毁时通过 dispose() 释放容器与 GPU 资源。
 * 支持经纬度数据（{lng, lat, value}）与画布像素数据（{x, y, value}）。
 */
export class Heatmap3D extends Mesh {
  constructor(opts?: Heatmap3DOpts)
  /** 更新热力数据（数据项格式同 data），纹理同步刷新 */
  setData(data?: Heatmap3DDataItem[]): void
  /** 释放离屏容器与 GPU 资源 */
  dispose(): void
}
