import { PerspectiveCamera, Vector3 } from 'three'

/**
 * 相机取景拟合。
 *
 * 常见写法是「包围盒半宽 / tan(fov/2)」求距离，但那是正交投影的算法：
 * 透视下靠近相机的一侧会被放大，按平面尺寸算出来的距离会让近端与左右角点被裁掉
 * （实测省域地图左右角点 NDC 会顶到 ±0.99，边缘贴死）。
 *
 * 这里改为对包围盒 8 个角点做投影试算：二分距离直到所有角点落进 ±limit，
 * 再二分观察点位置让投影范围上下居中。与层级尺寸、画幅比例无关，可自适应。
 *
 * 只依赖 three 的数学部分，不碰场景与纹理，方便单测。
 */

/** 固定观察方向：摄像机在南侧俯视，画面上方即北方 */
export const DEFAULT_VIEW_DIRECTION = new Vector3(0, 0.95, 0.72).normalize()

const FIT_LIMIT = 0.9
const MIN_DISTANCE = 1
const MAX_DISTANCE = 400

/**
 * @typedef {Object} FitCameraOptions
 * @property {number} fov 视野角度（度）
 * @property {number} aspect 画幅比
 * @property {number} [near] 近裁剪面
 * @property {number} [far] 远裁剪面
 * @property {import('three').Vector3} [direction] 观察方向（由目标指向相机）
 * @property {number} [limit] 允许占用的最大 NDC（0~1），越小留白越多
 */

/**
 * 求一个能完整装下包围盒的机位。
 * @param {import('three').Box3} box 世界坐标包围盒
 * @param {FitCameraOptions} options 相机参数
 * @returns {{ position: Vector3, target: Vector3, distance: number } | null}
 */
export function fitCameraToBox(box, { fov, aspect, near = 0.1, far = 1000, direction, limit = FIT_LIMIT } = {}) {
  if (!box || box.isEmpty?.() || !fov || !aspect) return null

  const viewDirection = (direction ?? DEFAULT_VIEW_DIRECTION).clone().normalize()
  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())

  // 只用于试算，不参与渲染
  const probe = new PerspectiveCamera(fov, aspect, near, far)

  const corners = []
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z))
    }
  }

  /** 给定观察点与距离，量出角点在 NDC 上的范围 */
  const measure = (target, distance) => {
    probe.position.copy(target).addScaledVector(viewDirection, distance)
    probe.lookAt(target)
    probe.updateMatrixWorld()
    probe.updateProjectionMatrix()

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const corner of corners) {
      const ndc = corner.clone().project(probe)
      if (ndc.x < minX) minX = ndc.x
      if (ndc.x > maxX) maxX = ndc.x
      if (ndc.y < minY) minY = ndc.y
      if (ndc.y > maxY) maxY = ndc.y
    }

    return {
      extent: Math.max(-minX, maxX, -minY, maxY),
      centerY: (minY + maxY) / 2,
    }
  }

  // 初值：观察点往相机方向挪一点，抵消「近端放大导致整体偏下」
  const target = center.clone()
  target.z += size.z * 0.12

  const fitDistance = () => {
    let low = MIN_DISTANCE
    let high = MAX_DISTANCE
    for (let i = 0; i < 26; i++) {
      const mid = (low + high) / 2
      if (measure(target, mid).extent <= limit) high = mid
      else low = mid
    }
    return high
  }

  /**
   * 竖直居中：对观察点 z 做二分，让投影范围上下对称。
   * centerY 随 target.z 单调变化，二分十几步即可压到 0 附近。
   */
  const centerVertically = (distance) => {
    let low = target.z - size.z
    let high = target.z + size.z
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2
      if (measure(new Vector3(target.x, target.y, mid), distance).centerY > 0) high = mid
      else low = mid
    }
    target.z = (low + high) / 2
  }

  let distance = fitDistance()
  // 居中会轻微改变取景范围，交替几轮收敛
  for (let i = 0; i < 3; i++) {
    centerVertically(distance)
    distance = fitDistance()
  }

  return {
    position: target.clone().addScaledVector(viewDirection, distance),
    target,
    distance,
  }
}
