import { CameraHelper, PerspectiveCamera, Vector3 } from 'three'
import merge from 'lodash-es/merge'
import { getV3Position } from '../utils/index'

/**
 * 相机默认配置工厂：每次调用生成新的 Vector3，
 * 避免模块级共享实例被 lodash merge 深改写后污染后续所有 Camera 实例。
 * @returns {import('../types').CameraOpts}
 */
const createCameraDefaultOpts = () => ({
  position: new Vector3(0, 0, 5), // 相机位置
  fov: 45, // 相机视野角度
  near: 1, // 相机最近距离
  far: 10000, // 相机最远距离
  helper: false, // 是否添加相机辅助线
})

export class Camera extends PerspectiveCamera {
  /**
   * @param {Object} basic - BasicThreejs 实例（依赖其 sizes / scene）
   * @param {import('../types').CameraOpts} opts 配置项
   */
  constructor(basic, opts = {}) {
    const mergedOpts = merge({}, createCameraDefaultOpts(), opts)
    const { sizes, scene } = basic
    const aspectRatio = sizes.width / sizes.height
    const { fov, near, far, position, helper } = mergedOpts
    super(fov, aspectRatio, near, far)
    this.position.copy(getV3Position(position))

    if (helper) {
      const cameraHelper = new CameraHelper(this)
      cameraHelper.name = 'CameraHelper'
      scene.add(cameraHelper)
    }

    sizes.onResize(({ width, height }) => {
      if (width == null || height == null) return console.warn('width or height is empty')
      this.aspect = width / height
      this.updateProjectionMatrix()
    })

    scene.add(this)
  }
}
