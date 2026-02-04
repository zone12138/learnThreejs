import { Vector3, Vector3Tuple, Vector3Like } from 'three'

export interface GeoProjection {
  /**
   * 投影中心
   */
  center: [number, number]
  /**
   * 投影比例
   */
  scale: number
  /**
   * 投影平移
   */
  translate: [number, number]
}

export type Vector3LikeOrTuple = Vector3 | Vector3Tuple | Vector3Like
