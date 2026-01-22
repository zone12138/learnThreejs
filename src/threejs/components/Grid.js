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
import merge from 'lodash-es/merge'

const GRID_DEFAULT_OPTS = {
  name: 'grid', // 网格名称
  position: new Vector3(0, 0, 0), // 网格位置
  gridSize: 100, // 网格大小
  gridDivision: 20, // 网格分割数
  gridColor: 0x28373a, // 网格颜色
  shapeSize: 1, // 形状大小
  shapeColor: 0x8e9b9e, // 形状颜色
  pointSize: 0.2, // 点大小
  pointColor: 0x28373a, // 点颜色
  pointLayout: {
    row: 200, // 点布局行数
    col: 200, // 点布局列数
  },
  pointBlending: NormalBlending, // 点混合模式
  helper: false, // 是否开启网格辅助线
  autoAddToScene: true, // 是否自动添加到场景
}

export class Grid {
  constructor({ scene }, opts = {}) {
    this.scene = scene
    this.opts = merge({}, GRID_DEFAULT_OPTS, opts)
    return this.init()
  }
  init() {
    const group = new Group()
    group.name = this.opts.name
    if (this.opts.helper) {
      const gridHelper = this.createGridHelper()
      group.add(gridHelper)
    }
    const shapeMesh = this.createShapes()
    const point = this.createPoint()
    group.add(shapeMesh, point)
    group.position.copy(this.opts.position)
    if (this.opts.autoAddToScene) this.scene?.add(group)
    return group
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
