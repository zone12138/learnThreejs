import { Vector3, MeshBasicMaterialParameters } from 'three'

export interface FlowLineOpts {
  /**
   * 基础路径点 (Vector3 数组)
   */
  points: Vector3[]
  /**
   * 流动速度
   */
  speed: number
  /**
   * 管子分段数
   */
  tubularSegments: number
  /**
   * 管子半径
   */
  radius: number
  /**
   * 半径分段数
   */
  radiusSegments: number
  /**
   * 是否闭合
   */
  closed: boolean
  /**
   * 渲染顺序
   */
  renderOrder: number
  /**
   * 纹理重复次数
   */
  textureRepeat: [number, number],
  /**
   * 材质
   */
  materialOpts: MeshBasicMaterialParameters,
}
