import test from 'node:test'
import assert from 'node:assert/strict'
import { getFeatureCoordinates, getMercatorProjection } from '../src/threejs/libs/GeoProjection.js'

// 两个互不相交的图形：三角形（闭合后 4 点）与正方形（闭合后 5 点）。
// 用非共线的三角形，避免 turf 的 union 把共线中间点优化掉，导致两者点数相同。
const triangle = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
}

const square = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [5, 5],
        [8, 5],
        [8, 8],
        [5, 8],
        [5, 5],
      ],
    ],
  },
}

const collection = { type: 'FeatureCollection', features: [triangle, square] }

test('filter 为数组时返回对应序号的环', () => {
  const polygons = getFeatureCoordinates(collection, { filter: [0] })
  assert.equal(polygons.length, 1)
  assert.equal(polygons[0].length, 4)
})

test("filter 为 'max' 时返回点数最多的环", () => {
  const [polygon] = getFeatureCoordinates(collection, { filter: 'max' })
  assert.equal(polygon.length, 5)
})

test("filter 为 'min' 时返回点数最少的环（本次修复的 `??` 优先级问题）", () => {
  const [polygon] = getFeatureCoordinates(collection, { filter: 'min' })
  assert.equal(polygon.length, 4)
})

test('filter 为 number 时只返回该序号', () => {
  const polygons = getFeatureCoordinates(collection, { filter: 1 })
  assert.equal(polygons.length, 1)
  assert.equal(polygons[0].length, 5)
})

test('空数据返回空数组而不是抛错', () => {
  assert.deepEqual(getFeatureCoordinates({ type: 'FeatureCollection', features: [] }), [])
})

test('getMercatorProjection 使用传入的 center/scale', () => {
  const projection = getMercatorProjection({ center: [113, 23], scale: 1000, translate: [0, 0] })
  const [x, y] = projection([113, 23])
  // 中心点应投影到 translate 位置（此处为原点）
  assert.ok(Math.abs(x) < 1e-6)
  assert.ok(Math.abs(y) < 1e-6)
})
