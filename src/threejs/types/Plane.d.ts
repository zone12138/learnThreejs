import { Material } from 'three'
import { Vector3LikeOrTuple } from './Variable'

export interface PlaneOpts {
  /**
   * 宽度
   */
  width: number,
  /**
   * 高度
   */
  height: number,
  /**
   * 缩放比例
   */
  scale: number,
  /**
   * 位置
   * @example
   * - [0, 0, 0]
   * - new Vector3(0, 0, 0)
   * - { x: 0, y: 0, z: 0 }
   */
  position: Vector3LikeOrTuple,
  /**
   * 是否自动旋转
   */
  autoRotate: boolean,
  /**
   * 旋转速度
   */
  rotateSpeed: number,
  /**
   * 材质
   */
  material: Material,
  /**
   * 渲染顺序
   */
  renderOrder: number,
  /**
   * 是否自动添加到场景
   */
  autoAddToScene: boolean,
}