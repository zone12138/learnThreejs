import {
  TextureLoader,
  DoubleSide,
  AdditiveBlending,
  RepeatWrapping,
  CatmullRomCurve3,
  TubeGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import merge from 'lodash-es/merge'
import flowline from '@/threejs/textures/flowline.png'
const FLOW_LINE_TEXTURE = new TextureLoader().load(flowline)

const FLOW_LINE_DEFAULT_OPTS = {
  points: [], // 基础路径点 (Vector3 数组)
  speed: 0.002, // 流动速度
  tubularSegments: 2560, // 管子分段数
  radius: 0.02, // 管子半径
  radiusSegments: 40, // 半径分段数
  closed: false, // 是否闭合
  renderOrder: 10, // 渲染顺序
  textureRepeat: [1, 1], // 纹理重复次数
  materialOpts: {
    color: 0x00ffff, // 颜色
    transparent: true, // 是否透明
    opacity: 1, // 透明度
    side: DoubleSide, // 双面渲染
    map: FLOW_LINE_TEXTURE, // 主贴图
    alphaMap: FLOW_LINE_TEXTURE, // 透明度贴图
    fog: false, // 是否开启雾效
    blending: AdditiveBlending, // 混合模式
  },
}

export class FlowLine {
  constructor({ tickClock }, opts = {}) {
    this.tickClock = tickClock
    this.opts = merge({}, FLOW_LINE_DEFAULT_OPTS, opts)
    this.texture = this.opts.materialOpts.map?.clone()
    this.line = this.init()
    this.tickClock?.onTick(() => this.update())
    return {
      instance: this.line,
      update: () => this.update(),
    }
  }
  init() {
    const {
      textureRepeat,
      points,
      tubularSegments,
      radius,
      radiusSegments,
      closed,
      materialOpts,
      renderOrder,
    } = this.opts
    if (this.texture?.isTexture) {
      this.texture.wrapT = this.texture.wrapS = RepeatWrapping
      this.texture.repeat.set(...textureRepeat)
    }
    const path = new CatmullRomCurve3(points)
    const geometry = new TubeGeometry(path, tubularSegments, radius, radiusSegments, closed)
    const material = new MeshBasicMaterial({
      ...materialOpts,
      map: this.texture,
      alphaMap: this.texture,
    })
    const line = new Mesh(geometry, material)
    line.renderOrder = renderOrder
    return line
  }
  update() {
    if (this.texture?.isTexture) this.texture.offset.x += this.opts.speed
  }
}
