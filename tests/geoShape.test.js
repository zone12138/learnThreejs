import test from 'node:test'
import assert from 'node:assert/strict'
import {
  forEachRing,
  projectRing,
  createShape,
  createRingGeometry,
} from '../src/threejs/utils/geoShape.js'

const polygonFeature = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
}

const multiPolygonFeature = {
  type: 'Feature',
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      ],
      [
        [
          [2, 2],
          [3, 2],
          [3, 3],
        ],
      ],
    ],
  },
}

test('forEachRing 对 Polygon 展平一层', () => {
  const rings = []
  forEachRing(polygonFeature, (ring) => rings.push(ring))
  assert.equal(rings.length, 1)
  assert.equal(rings[0].length, 4)
})

test('forEachRing 对 MultiPolygon 展平两层', () => {
  const rings = []
  forEachRing(multiPolygonFeature, (ring) => rings.push(ring))
  assert.equal(rings.length, 2)
  assert.deepEqual(rings[1][0], [2, 2])
})

test('forEachRing 对缺失/未知几何类型不抛错', () => {
  let called = 0
  forEachRing({}, () => called++)
  forEachRing({ geometry: { type: 'Point', coordinates: [0, 0] } }, () => called++)
  forEachRing(null, () => called++)
  assert.equal(called, 0)
})

test('projectRing 取负 y 并丢弃无效点', () => {
  // 模拟墨卡托：x 原样，y 线性；x > 100 的点视为越界返回 NaN
  const projection = ([lon, lat]) => (lon > 100 ? [NaN, NaN] : [lon * 10, lat * 10])
  const coords = projectRing(
    [
      [1, 2],
      [101, 2],
      [3, 4],
    ],
    projection,
  )

  assert.deepEqual(coords, [
    [10, -20],
    [30, -40],
  ])
})

test('projectRing 捕获投影函数抛错，跳过单点', () => {
  const projection = ([lon]) => {
    if (lon === 0) throw new Error('bad coord')
    return [lon, lon]
  }
  assert.deepEqual(
    projectRing(
      [
        [0, 0],
        [1, 1],
      ],
      projection,
    ),
    [[1, -1]],
  )
})

test('createShape 少于 3 个点返回 null', () => {
  assert.equal(
    createShape([
      [0, 0],
      [1, 1],
    ]),
    null,
  )
  assert.equal(createShape([]), null)
})

test('createShape 生成闭合路径', () => {
  const shape = createShape([
    [0, 0],
    [1, 0],
    [1, 1],
  ])
  assert.ok(shape)
  const points = shape.getPoints()
  assert.ok(points.length >= 3)
})

test('createRingGeometry 对无效环返回 null，对正常环返回带包围体的几何体', () => {
  const projection = ([lon, lat]) => [lon, lat]

  assert.equal(createRingGeometry([[0, 0]], projection, { depth: 0 }), null)

  const geometry = createRingGeometry(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    projection,
    { depth: 0.5, bevelEnabled: false },
  )

  assert.ok(geometry)
  assert.ok(geometry.attributes.position.count > 0)
  assert.ok(geometry.boundingBox)
  assert.ok(geometry.boundingSphere.radius > 0)
})
