import type { LineBasicMaterialParameters, LineSegments } from 'three'

export interface MapLineOpts extends LineBasicMaterialParameters {}

/**
 * 地图轮廓线：把一串世界坐标点两两连成线段。
 * 直接作为子对象挂在 mesh 上，随父级的几何体一起被回收。
 */
export class MapLine extends LineSegments {
  constructor(params: { coordinates: number[][] }, opts?: MapLineOpts)
}
