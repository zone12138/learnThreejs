import { CameraHelper, PerspectiveCamera, Vector3 } from 'three'
import merge from 'lodash-es/merge'
import { getV3Position } from '../utils/index'

/** @type {import('../types').CameraOpts} */
const CAMERA_DEFAULT_OPTS = {
  position: new Vector3(0, 0, 5), // 相机位置
  // 相机选项
  fov: 45, // 相机视野角度
  near: 1, // 相机最近距离
  far: 10000, // 相机最远距离
  helper: false, // 是否添加相机辅助线
}

export class Camera extends PerspectiveCamera {
  /**
   *
   * @param {*} param0
   * @param {import('../types').CameraOpts} opts 配置项
   */
  constructor({ sizes, scene }, opts = {}) {
    const mergedOpts = merge({}, CAMERA_DEFAULT_OPTS, opts)
    const aspectRatio = sizes.width / sizes.height
    const { fov, near, far, position, helper } = mergedOpts
    super(fov, aspectRatio, near, far)
    this.position.copy(getV3Position(position))

    if (helper) {
      const helper = new CameraHelper(this)
      scene.add(helper)
    }

    sizes.onResize(({ width, height }) => {
      if (width == null || height == null) return console.warn('width or height is empty')
      this.aspect = width / height
      this.updateProjectionMatrix()
    })

    scene.add(this)
  }
}
