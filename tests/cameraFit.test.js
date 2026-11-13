import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { fitCameraToBox } from '../src/threejs/utils/cameraFit.js'

/**
 * 取景拟合的回归测试。
 *
 * 背景：旧实现按「半宽 / tan(fov/2)」算距离，那是正交投影的算法；
 * 透视下近端会被放大，实测省域地图左右角点 NDC 顶到 ±0.99，边缘贴死。
 * 这里直接量角点投影结果，锁住「完整可见 + 不留过多空白」两个目标。
 */

const FOV = 52
const LIMIT = 0.9
const EPSILON = 1e-6

/** 按返回的机位投影包围盒 8 个角点，返回 NDC 范围 */
function projectCorners(box, pose, aspect) {
  const camera = new PerspectiveCamera(FOV, aspect, 0.1, 1000)
  camera.position.copy(pose.position)
  camera.lookAt(pose.target)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const ndc = new Vector3(x, y, z).project(camera)
        minX = Math.min(minX, ndc.x)
        maxX = Math.max(maxX, ndc.x)
        minY = Math.min(minY, ndc.y)
        maxY = Math.max(maxY, ndc.y)
      }
    }
  }

  return { minX, maxX, minY, maxY, extent: Math.max(-minX, maxX, -minY, maxY) }
}

const cases = [
  // 省域：宽 30、厚 0.5、深 20
  { name: '省域 · 宽画幅', box: new Box3(new Vector3(-15, 0, -10), new Vector3(15, 0.5, 10)), aspect: 2.14 },
  // 市域：小一个数量级，验证距离不会因固定余量而失效
  { name: '市域 · 宽画幅', box: new Box3(new Vector3(-6, 0, -8.8), new Vector3(2, 0.2, -2.2)), aspect: 2.14 },
  // 竖屏：左右受限，验证能自适应
  { name: '省域 · 竖屏', box: new Box3(new Vector3(-15, 0, -10), new Vector3(15, 0.5, 10)), aspect: 0.6 },
]

for (const { name, box, aspect } of cases) {
  test(`取景完整可见：${name}`, () => {
    const pose = fitCameraToBox(box, { fov: FOV, aspect })
    assert.ok(pose, '应返回机位')

    const ndc = projectCorners(box, pose, aspect)
    assert.ok(ndc.minX >= -LIMIT - EPSILON, `左边界越界：${ndc.minX}`)
    assert.ok(ndc.maxX <= LIMIT + EPSILON, `右边界越界：${ndc.maxX}`)
    assert.ok(ndc.minY >= -LIMIT - EPSILON, `下边界越界：${ndc.minY}`)
    assert.ok(ndc.maxY <= LIMIT + EPSILON, `上边界越界：${ndc.maxY}`)
  })

  test(`取景不过度留白：${name}`, () => {
    const pose = fitCameraToBox(box, { fov: FOV, aspect })
    const ndc = projectCorners(box, pose, aspect)
    // 至少有一个方向接近 limit，否则说明相机被推得太远
    assert.ok(ndc.extent > LIMIT - 0.05, `视野利用不足：${ndc.extent}`)
  })

  test(`上下居中：${name}`, () => {
    const pose = fitCameraToBox(box, { fov: FOV, aspect })
    const ndc = projectCorners(box, pose, aspect)
    assert.ok(Math.abs(ndc.minY + ndc.maxY) < 0.05, `竖直偏移过大：${ndc.minY} / ${ndc.maxY}`)
  })
}

test('畸形输入返回 null', () => {
  assert.equal(fitCameraToBox(new Box3(), { fov: FOV, aspect: 1.8 }), null)
  assert.equal(fitCameraToBox(new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1)), {}), null)
})
