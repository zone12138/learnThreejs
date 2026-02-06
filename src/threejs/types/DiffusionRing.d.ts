import type { ColorRepresentation } from 'three'

export interface DiffusionRingOpts {
  /**
   * 扩散环颜色
   */
  color?: ColorRepresentation
  /**
   * 扩散环半径
   */
  radius?: number
  /**
   * 扩散环宽度(浮点数 float)
   */
  ringWidth?: number
  /**
   * 扩散环速度(浮点数 float)
   */
  speed?: number
  /**
   * 扩散环渲染顺序
   */
  renderOrder?: number
}
