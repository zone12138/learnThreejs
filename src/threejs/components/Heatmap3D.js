import { CanvasTexture, DoubleSide, Mesh, PlaneGeometry, MeshBasicMaterial } from 'three'
import h337 from 'heatmap.js'
import merge from 'lodash-es/merge'

const HEATMAP3D_DEFAULT_OPTS = {
  projection: {
    center: [0, 0],
    translate: [0, 0],
    scale: 1,
  },
  width: 10,
  height: 10,
  radius: 25,
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
  maxValue: 100, // 与随机数据的最大值匹配
  minValue: 0,
  data: [],
}

export class Heatmap3D extends Mesh {
  constructor(opts = {}) {
    const mergedOpts = merge({}, HEATMAP3D_DEFAULT_OPTS, opts)
    const {
      projection,
      width,
      height,
      radius,
      maxOpacity,
      minOpacity,
      blur,
      gradient,
      maxValue,
      minValue,
      data,
    } = mergedOpts

    const heatmapContainer = document.createElement('div')
    heatmapContainer.id = 'heatmap-container'
    const canvasSize = 512
    heatmapContainer.style.cssText = `width: ${canvasSize}px; height: ${canvasSize}px; position: absolute; left: -9999px; top: -9999px;`
    document.body.appendChild(heatmapContainer)
    const heatmapInstance = h337.create({
      container: heatmapContainer,
      radius,
      maxOpacity,
      minOpacity,
      blur,
      gradient,
      backgroundColor: 'rgba(0,0,0,0)',
    })

    heatmapInstance.setData({
      max: maxValue,
      min: minValue,
      /** 热力图数据格式: [{x: 0, y: 0, value: 100}, ...] x, y 需要是整数, value 需要大于等于 minValue, 小于等于 maxValue */
      data,
    })

    console.log(heatmapInstance, data)

    const heatmapCanvas = heatmapContainer.querySelector('canvas')
    const heatmapDataURL = heatmapCanvas.toDataURL()
    console.log(heatmapDataURL)
    const texture = new CanvasTexture(heatmapCanvas)
    texture.needsUpdate = true

    const geometry = new PlaneGeometry(width, height, 120, 120)

    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
      alphaTest: 0.05,
      //   roughness: 0.2,
      //   metalness: 0.1,

      //   displacementMap: texture,
      //   displacementScale: 1.5,
      //   displacementBias: 0,
    })

    super(geometry, material)
  }
}
