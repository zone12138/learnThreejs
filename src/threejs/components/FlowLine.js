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

/** @type {import('../types').FlowLineOpts} */
const FLOW_LINE_DEFAULT_OPTS = {
  points: [], // 基础路径点 (Vector3 数组)
  speed: 0.002, // 流动速度
  tubularSegments: 1600, // 管子分段数
  radius: 0.02, // 管子半径
  radiusSegments: 8, // 半径分段数
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

export class FlowLine extends Mesh {
  /** @type {import('../types').FlowLineOpts} */
  #opts = {}
  /**
   *
   * @param {*} param0 时钟对象
   * @param {import('../types').FlowLineOpts} opts 配置项
   */
  constructor({ tickClock }, opts = {}) {
    const mergedOpts = merge({}, FLOW_LINE_DEFAULT_OPTS, opts)
    super(FlowLine.#createGeometry(mergedOpts), FlowLine.#createMaterial(mergedOpts))
    this.#opts = mergedOpts
    this.renderOrder = this.#opts.renderOrder
    this.userData.update = () => {
      if (this.material.map?.isTexture) this.material.map.offset.x += this.#opts.speed
    }
    tickClock?.onTick(() => this.userData.update())
  }
  /**
   * 创建几何体
   * @param {import('../types').FlowLineOpts} opts 配置项
   * @returns {import('three').TubeGeometry} 管子几何体
   */
  static #createGeometry(opts) {
    const { points, tubularSegments, radius, radiusSegments, closed } = opts
    const path = new CatmullRomCurve3(points)
    console.log(path.getLength())
    return new TubeGeometry(path, tubularSegments, radius, radiusSegments, closed)
  }
  /**
   * 创建材质
   * @param {import('../types').FlowLineOpts} opts 配置项
   * @returns {import('three').MeshBasicMaterial} 管子材质
   */
  static #createMaterial(opts) {
    const { textureRepeat, materialOpts } = opts
    const cloneTexture = materialOpts?.map?.clone()
    if (cloneTexture?.isTexture) {
      cloneTexture.wrapT = cloneTexture.wrapS = RepeatWrapping
      cloneTexture.repeat.set(...textureRepeat)
    }
    return new MeshBasicMaterial({
      ...materialOpts,
      map: cloneTexture,
      alphaMap: cloneTexture,
    })
  }
}
