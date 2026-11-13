import { Shape, Sphere, Box3, Vector3, ExtrudeGeometry } from 'three'

/**
 * GeoJSON → three 几何体的公共构件。
 *
 * 四种视图（GuangzhouCityMap / GuangdongProvinceMap / FlyLineMap / use3DMap）
 * 此前各写了一遍「展平环 → 投影 → 建 Shape → 挤出 → 兜底包围盒」，
 * 而且对 Polygon / MultiPolygon 的处理各不相同：GuangdongProvinceMap 的
 * Polygon 分支因为多套了一层循环，实际一个面都建不出来（数据恰好全是
 * MultiPolygon 才没有暴露）。统一收在这里，只保留一份正确实现。
 *
 * 本文件只做坐标与几何，不碰材质与场景，方便单测。
 */

/**
 * 遍历一个 feature 的所有环。
 * @param {Object} feature GeoJSON Feature
 * @param {(ring: number[][], feature: Object) => void} callback 环回调
 */
export function forEachRing(feature, callback) {
  const geometry = feature?.geometry
  const coordinates = geometry?.coordinates
  if (!Array.isArray(coordinates)) return

  if (geometry.type === 'Polygon') {
    coordinates.forEach((ring) => callback(ring, feature))
  } else if (geometry.type === 'MultiPolygon') {
    coordinates.forEach((polygon) => polygon.forEach((ring) => callback(ring, feature)))
  }
}

/**
 * 经纬度环 → 世界坐标点。
 * d3 墨卡托投影的 y 轴与 three 场景的 y 轴相反，这里统一取负；
 * 投影失败的点（越界岛屿、缺失值）直接丢弃，避免 NaN 进入几何体导致整块区域消失。
 *
 * @param {number[][]} ring 经纬度环
 * @param {(coord: number[]) => number[]} projection 投影函数
 * @returns {number[][]} 世界坐标点
 */
export function projectRing(ring, projection) {
  const coords = []
  if (!Array.isArray(ring)) return coords

  for (const coord of ring) {
    try {
      const [x, y] = projection(coord)
      if (Number.isFinite(x) && Number.isFinite(y)) coords.push([x, -y])
    } catch {
      // 单点异常不影响整条环
    }
  }
  return coords
}

/**
 * 世界坐标点 → 闭合 Shape。少于 3 个点无法构成面，返回 null。
 * @param {number[][]} coords 世界坐标点
 * @returns {Shape|null}
 */
export function createShape(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null

  const shape = new Shape()
  coords.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()
  return shape
}

/**
 * 挤出几何体 + 安全的包围体计算。
 * 真实边界数据会生成退化三角形，computeBoundingSphere 抛错会让整块地图加载中断，
 * 这里兜底一个保守包围体，保证该区域仍能被射线检测命中。
 *
 * @param {Shape} shape 形状
 * @param {Object} [extrudeOpts] ExtrudeGeometry 参数
 * @returns {ExtrudeGeometry}
 */
export function createExtrudeGeometry(shape, extrudeOpts = { depth: 0, bevelEnabled: false }) {
  const geometry = new ExtrudeGeometry(shape, extrudeOpts)

  try {
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  } catch {
    geometry.boundingBox = new Box3(new Vector3(-50, -50, -5), new Vector3(50, 50, 10))
    geometry.boundingSphere = new Sphere(new Vector3(0, 0, 5), 100)
  }

  return geometry
}

/**
 * 环 → 挤出几何体（无效环返回 null）。
 * @param {number[][]} ring 经纬度环
 * @param {(coord: number[]) => number[]} projection 投影函数
 * @param {Object} [extrudeOpts] ExtrudeGeometry 参数
 * @returns {ExtrudeGeometry|null}
 */
export function createRingGeometry(ring, projection, extrudeOpts) {
  const shape = createShape(projectRing(ring, projection))
  return shape ? createExtrudeGeometry(shape, extrudeOpts) : null
}
