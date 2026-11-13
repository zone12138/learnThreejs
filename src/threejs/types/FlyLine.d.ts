import type { Vector3, Mesh, Line, Curve } from 'three'
import type { BasicThreejsContext } from './Core.js'

export interface FlyLineOpts {
  /** 起点 */
  start?: Vector3
  /** 终点 */
  end?: Vector3
  /** 飞线颜色 */
  color?: number
  /** 弧线最高点高度 */
  height?: number
  /** 飞线粗细 */
  radius?: number
  /** 流动速度 */
  speed?: number
  /** 流动光带长度比例（0~1） */
  length?: number
  /** 曲线分段数 */
  curveSegments?: number
}

/**
 * 两点之间的动态飞线（管状主体 + 流动光带）。
 * 动画挂在 tickClock 上，场景销毁时随基座一并停止。
 */
export class FlyLine {
  constructor(basic: BasicThreejsContext, opts?: FlyLineOpts)
  readonly options: Required<FlyLineOpts>
  /** 飞线路径 */
  readonly path: Curve<Vector3>
  /** 管状主体 */
  readonly mesh: Mesh
  /** 流动光带 */
  readonly flowLine?: Line
}
