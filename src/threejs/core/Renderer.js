import { WebGLRenderer, SRGBColorSpace, PCFSoftShadowMap } from 'three'
import merge from 'lodash-es/merge'

const RENDERER_DEFAULT_OPTS = {
  alpha: false, // 是否透明背景
  antialias: true, // 是否抗锯齿
  toneMapping: null, // 色调映射（如 ACESFilmicToneMapping），null 表示不设置
  toneMappingExposure: 1, // 曝光
  outputColorSpace: SRGBColorSpace, // 输出颜色空间
  shadow: false, // 是否开启阴影渲染
  clearColor: null, // 清除颜色，null 表示不设置
}

export class Renderer extends WebGLRenderer {
  /**
   * @param {Object} basic - BasicThreejs 实例（依赖其 canvas / sizes / opts.rendererOpts）
   */
  constructor(basic) {
    const { alpha, antialias } = merge({}, RENDERER_DEFAULT_OPTS, basic?.opts?.rendererOpts)
    super({ alpha, antialias, canvas: basic.canvas })

    const resize = ({ width, height, pixelRatio }) => {
      this.setSize(width, height)
      this.setPixelRatio(pixelRatio)
    }
    resize(basic.sizes)
    basic.sizes.onResize(resize)

    const { toneMapping, toneMappingExposure, outputColorSpace, shadow, clearColor } = merge(
      {},
      RENDERER_DEFAULT_OPTS,
      basic?.opts?.rendererOpts,
    )

    if (toneMapping) {
      this.toneMapping = toneMapping
      this.toneMappingExposure = toneMappingExposure
    }
    this.outputColorSpace = outputColorSpace
    if (shadow) {
      this.shadowMap.enabled = true
      this.shadowMap.type = PCFSoftShadowMap
    }
    if (clearColor != null) this.setClearColor(clearColor)
  }
}
