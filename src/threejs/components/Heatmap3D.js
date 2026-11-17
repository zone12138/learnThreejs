import { CanvasTexture, DoubleSide, Mesh, PlaneGeometry, MeshBasicMaterial, SRGBColorSpace } from 'three'
import h337 from 'heatmap.js'
import merge from 'lodash-es/merge'
import { getMercatorProjection } from '../libs/index'

/** 离屏画布尺寸（热力图先画在 2D 画布上，再作为纹理贴到平面） */
const CANVAS_SIZE = 512

const HEATMAP3D_DEFAULT_OPTS = {
  projection: {
    center: [0, 0],
    translate: [0, 0],
    scale: 1,
  },
  /** 热力图平面的世界坐标边长，需覆盖目标地图的投影范围 */
  worldSize: 30,
  /** 热点半径（世界单位，内部按 worldSize 换算成画布像素） */
  radius: 2,
  maxOpacity: 1,
  minOpacity: 0,
  blur: 0.85,
  gradient: {
    '.3': 'blue',
    '.5': 'cyan',
    '.7': 'lime',
    '.85': 'yellow',
    '1.0': 'red',
  },
  maxValue: 100,
  minValue: 0,
  data: [],
}

export class Heatmap3D extends Mesh {
  constructor(opts = {}) {
    const mergedOpts = merge({}, HEATMAP3D_DEFAULT_OPTS, opts)
    const {
      projection,
      worldSize,
      radius,
      maxOpacity,
      minOpacity,
      blur,
      gradient,
      maxValue,
      minValue,
      data,
    } = mergedOpts

    // 离屏画布：挂在 body 外侧隐藏，仅用于产出纹理。
    // 用 fixed 而不是 absolute：fixed 元素完全不参与文档布局，也不会撑出滚动区域。
    // 注意这份样式必须在 h337.create 之后再套一次 —— heatmap.js 内部会无条件执行
    // `container.style.position = 'relative'`（它要相对定位来放自己的 canvas），
    // 一旦被改成 relative，left/top 的偏移只作用于视觉，元素本身仍在 body 末尾占位 512×512，
    // 页面因此多出 512px 高度、出现纵向滚动条。
    const offscreenCss = `width: ${CANVAS_SIZE}px; height: ${CANVAS_SIZE}px; position: fixed; left: -10000px; top: 0; visibility: hidden; pointer-events: none;`
    const heatmapContainer = document.createElement('div')
    heatmapContainer.style.cssText = offscreenCss
    document.body.appendChild(heatmapContainer)

    const heatmapInstance = h337.create({
      container: heatmapContainer,
      radius: (radius / worldSize) * CANVAS_SIZE,
      maxOpacity,
      minOpacity,
      blur,
      gradient,
      backgroundColor: 'rgba(0,0,0,0)',
    })
    heatmapContainer.style.cssText = offscreenCss

    // 世界单位 → 画布像素 的换算系数
    const scaleRatio = CANVAS_SIZE / worldSize
    // 与 Map2D 同一套墨卡托投影，保证热点经纬度和地图轮廓对齐
    const mercator = getMercatorProjection(projection)

    /**
     * 数据点 → 画布坐标。
     * { lng, lat, value }：经纬度走投影，画布中心即投影 center（世界原点）；
     * { x, y, value }：画布像素坐标直接使用（兼容旧数据）。
     */
    function toCanvasPoint(item) {
      if (item.lng != null && item.lat != null) {
        // d3 投影与画布同为 y 向下，无需翻转
        const [px, py] = mercator([item.lng, item.lat])
        return {
          x: Math.round(CANVAS_SIZE / 2 + px * scaleRatio),
          y: Math.round(CANVAS_SIZE / 2 + py * scaleRatio),
          value: item.value,
        }
      }
      return { x: Math.round(item.x), y: Math.round(item.y), value: item.value }
    }

    const heatmapCanvas = heatmapContainer.querySelector('canvas')
    const texture = new CanvasTexture(heatmapCanvas)
    texture.needsUpdate = true
    // 画布颜色是 sRGB，不显式声明会被当成线性色导致整体发灰
    texture.colorSpace = SRGBColorSpace

    const geometry = new PlaneGeometry(worldSize, worldSize, 120, 120)

    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
      alphaTest: 0.05,
    })

    super(geometry, material)

    this.opts = mergedOpts
    this._container = heatmapContainer
    this._instance = heatmapInstance
    this._toCanvasPoint = toCanvasPoint
    this._texture = texture

    // 构造参数里的 data 要主动画一次：heatmap.js 的实例创建出来是空画布，
    // 少了这一步页面打开后必须点一次按钮才看得到热力，初始数据等于被丢弃
    if (data.length) this.setData(data)
  }

  /**
   * 更新热力数据，数据项格式同构造参数 data。
   * @param {Array<{lng?: number, lat?: number, x?: number, y?: number, value: number}>} data
   */
  setData(data = []) {
    const { maxValue, minValue } = this.opts
    this._instance.setData({
      max: maxValue,
      min: minValue,
      data: data.map((item) => this._toCanvasPoint(item)),
    })
    // heatmap.js 重绘的是同一张 canvas，刷新纹理让平面同步更新
    this._texture.needsUpdate = true
  }

  /** 释放离屏容器与 GPU 资源 */
  dispose() {
    this._container.remove()
    this._container = null
    this._instance = null
    this._toCanvasPoint = null
    this._texture.dispose()
    this.material.dispose()
    this.geometry.dispose()
  }
}
