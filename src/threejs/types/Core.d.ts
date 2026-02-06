import type { Scene, Camera, WebGLRenderer, Clock, InteractionManager, OrbitControls } from 'three'
import type { Vector3LikeOrTuple } from './Variable.js'

export interface CameraOpts {
  /**
   * 相机位置
   */
  position: Vector3LikeOrTuple
  /**
   * 相机视野角度
   */
  fov: number
  /**
   * 相机最近距离
   */
  near: number
  /**
   * 相机最远距离
   */
  far: number
  /**
   * 是否添加相机辅助线
   */
  helper: boolean
}

export interface BasicThreejsOpts {
  /**
   * 场景
   */
  scene: Scene
  /**
   * 相机
   */
  camera: Camera
  /**
   * 渲染器
   */
  renderer: Renderer
  /**
   * 时钟
   */
  tickClock: TickClock
  /**
   * 交互管理器
   */
  interactionManager: InteractionManager
  /**
   * 控制器
   */
  controls: OrbitControls
}
