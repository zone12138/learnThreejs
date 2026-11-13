import type {
  Scene,
  Camera,
  WebGLRenderer,
  OrbitControls,
  ToneMapping,
  ColorRepresentation,
  ColorSpace,
} from 'three'
import type { InteractionManager } from 'three.interactive'
import type { Vector3LikeOrTuple } from './Variable.js'
import type { Size, TickClock } from '../utils/index.js'

export interface CameraOpts {
  /** 相机位置 */
  position?: Vector3LikeOrTuple
  /** 相机视野角度 */
  fov?: number
  /** 相机最近距离 */
  near?: number
  /** 相机最远距离 */
  far?: number
  /** 是否添加相机辅助线 */
  helper?: boolean
}

export interface RendererOpts {
  /** 是否透明背景 */
  alpha?: boolean
  /** 是否抗锯齿 */
  antialias?: boolean
  /** 色调映射；null 表示不设置 */
  toneMapping?: ToneMapping | null
  /** 曝光 */
  toneMappingExposure?: number
  /** 输出颜色空间 */
  outputColorSpace?: ColorSpace
  /** 是否开启阴影渲染 */
  shadow?: boolean
  /** 清除颜色；null 表示不设置 */
  clearColor?: ColorRepresentation | null
}

/** 轨道控制器选项：透传给 OrbitControls 的属性（minDistance / maxDistance / dampingFactor 等） */
export type ControlsOpts = Partial<OrbitControls>

/**
 * BasicThreejs 构造参数。
 * 注意：这里只描述「配置」；组件（Map3D / Map2D / Grid …）的第一个参数是
 * BasicThreejs 实例本身，见 BasicThreejsContext。
 */
export interface BasicThreejsOpts {
  /** 相机选项 */
  cameraOpts?: CameraOpts
  /** 渲染器选项 */
  rendererOpts?: RendererOpts
  /** 轨道控制器选项 */
  controlsOpts?: ControlsOpts
  /** 是否启用 three.interactive 交互管理器（默认 true） */
  useInteraction?: boolean
}

/**
 * 组件构造函数的第一参数：BasicThreejs 实例中组件真正依赖的部分。
 * 用结构类型而不是直接引用 BasicThreejs 类，避免组件与基座形成循环依赖。
 */
export interface BasicThreejsContext {
  scene: Scene
  camera: Camera
  renderer: WebGLRenderer
  controls: OrbitControls
  tickClock: TickClock
  sizes: Size
  canvas: HTMLCanvasElement
  interactionManager: InteractionManager | null
}
