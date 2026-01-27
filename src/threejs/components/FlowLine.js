import {
  TextureLoader,
  AdditiveBlending,
  RepeatWrapping,
  CatmullRomCurve3,
  TubeGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three'

const FLOW_LINE_TEXTURE = new TextureLoader().load('@/threejs/textures/flowline.png')

const NAME = 'FlowLine'
const FLOW_LINE_DEFAULT_OPTS = {
  points: [], // 基础路径点 (Vector3 数组)
  color: '#00ffff', // 粒子颜色
  tubularSegments: 16, // 管子分段数
  radius: 0.05, // 管子半径
  radiusSegments: 1, // 半径分段数
  closed: true, // 是否闭合
  renderOrder: 10, // 渲染顺序
  materialOpts: {
    color: 0x48afff,
    transparent: true,
    opacity: 1,
    map: FLOW_LINE_TEXTURE,
    alphaMap: FLOW_LINE_TEXTURE,
    fog: true,
    blending: AdditiveBlending,
  },
}

export class FlowLine {
  constructor({ tickClock }, opts = {}) {
    this.tickClock = tickClock
    this.opts = Object.assign({}, FLOW_LINE_DEFAULT_OPTS, opts)
    this.line = this.init()

    this.tickClock?.onTick(() => this.update())
    return this.line
  }
  init() {
    const { points, tubularSegments, radius, radiusSegments, closed, materialOpts, renderOrder } =
      this.opts
    if (materialOpts.map) materialOpts.map.wrapT = materialOpts.map.wrapS = RepeatWrapping
    const path = new CatmullRomCurve3(points)
    const geometry = new TubeGeometry(path, tubularSegments, radius, radiusSegments, closed)
    const material = new MeshBasicMaterial(materialOpts)
    const line = new Mesh(geometry, material)
    line.renderOrder = renderOrder
    return line
  }
  update() {
    const { materialOpts } = this.opts
    if (materialOpts.map) materialOpts.map.offset.x += 0.005
  }
}
