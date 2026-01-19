import {
  Vector3,
  NormalBlending,
  Group,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Vector2,
  Shape,
  ShapeGeometry,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'

const GRID_DEFAULT_OPTS = {
  position: new Vector3(0, 0, 0),
  gridSize: 100,
  gridDivision: 20,
  gridColor: 0x28373a,
  shapeSize: 1,
  shapeColor: 0x8e9b9e,
  pointSize: 0.2,
  pointColor: 0x28373a,
  pointLayout: {
    row: 200,
    col: 200,
  },
  pointBlending: NormalBlending,
}

export class Grid {
  constructor({ scene }, opts = {}) {
    this.scene = scene
    this.opts = Object.assign({}, GRID_DEFAULT_OPTS, opts)
    this.init()
  }
  init() {
    const group = new Group()
    group.name = 'grid'
    const gridHelper = this.createGridHelper()
    const shapeMesh = this.createShapes()
    const point = this.createPoint()
    group.add(gridHelper, shapeMesh, point)
    this.scene.add(group)
    group.position.copy(this.opts.position)
    this.instance = group
    this.scene.add(group)
    console.log(group, this.scene)
  }
  createGridHelper() {
    const { gridSize, gridDivision, gridColor } = this.opts
    const gridHelper = new GridHelper(gridSize, gridDivision, gridColor, gridColor)
    return gridHelper
  }
  createShapes() {
    const { gridSize, gridDivision, shapeSize, shapeColor } = this.opts
    const shapeSpace = gridSize / gridDivision
    const range = gridSize / 2
    const shapeGeometries = []
    for (let i = 0; i < gridDivision; i++) {
      for (let j = 0; j < gridDivision; j++) {
        const shapeGeometry = this.createPlus(shapeSize)
        shapeGeometry.translate(-range + i * shapeSpace, -range + j * shapeSpace, 0)
        shapeGeometries.push(shapeGeometry)
      }
    }
    const geometry = mergeGeometries(shapeGeometries)
    const shapeMaterial = new MeshBasicMaterial({ color: shapeColor, side: DoubleSide })
    const shapeMesh = new Mesh(geometry, shapeMaterial)
    shapeMesh.renderOrder = -1
    shapeMesh.rotateX(-Math.PI / 2)
    shapeMesh.position.y += 0.01
    return shapeMesh
  }
  createPlus(shapeSize = 50) {
    let w = shapeSize / 6 / 3
    let h = shapeSize / 3
    let points = [
      new Vector2(-h, -w),
      new Vector2(-w, -w),
      new Vector2(-w, -h),
      new Vector2(w, -h),
      new Vector2(w, -h),
      new Vector2(w, -w),
      new Vector2(h, -w),
      new Vector2(h, w),
      new Vector2(w, w),
      new Vector2(w, h),
      new Vector2(-w, h),
      new Vector2(-w, w),
      new Vector2(-h, w),
    ]
    let shape = new Shape(points)
    let shapeGeometry = new ShapeGeometry(shape, 24)
    return shapeGeometry
  }
  createPoint() {
    const { gridSize, pointSize, pointColor, pointBlending, pointLayout } = this.opts
    const rows = pointLayout.row
    const cols = pointLayout.col
    const positions = new Float32Array(rows * cols * 3)
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = (i / (rows - 1)) * gridSize - gridSize / 2
        const y = 0
        const z = (j / (cols - 1)) * gridSize - gridSize / 2
        const index = (i * cols + j) * 3
        positions[index] = x
        positions[index + 1] = y
        positions[index + 2] = z
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    const material = new PointsMaterial({
      size: pointSize,
      sizeAttenuation: true,
      color: pointColor,
      blending: pointBlending,
    })
    const particles = new Points(geometry, material)

    return particles
  }
}
