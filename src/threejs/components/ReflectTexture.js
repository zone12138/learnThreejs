import {
  CanvasTexture,
  Mesh,
  PlaneGeometry,
  MathUtils,
  DoubleSide,
  LinearFilter,
  MeshBasicMaterial,
} from 'three'
import merge from 'lodash-es/merge'

/** @type {import('../types').ReflectTextureOpts} */
const REFLECTOR_DEFAULT_OPTS = {
  height: 4,
  fontSize: 100,
  fontFamily: 'Arial',
  textColor: 'white',
  shadowColor: 'rgba(0, 255, 255, 0.6)',
  gap: 20,
  reflectionOpacity: 0.5,
  text: 'Reflect Texture',
}

export class ReflectTexture extends Mesh {
  #opts = {}
  /**
   * 反射纹理选项
   * @param {import('../types').ReflectTextureOpts} opts - 反射纹理选项
   */
  constructor(opts = {}) {
    const mergedOpts = merge(REFLECTOR_DEFAULT_OPTS, opts)
    const { height, fontSize, fontFamily, textColor, shadowColor, gap, reflectionOpacity, text } =
      mergedOpts
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = `bold ${fontSize}px ${fontFamily}`

    const textMetrics = ctx.measureText(text)
    canvas.width = MathUtils.ceilPowerOfTwo(textMetrics.width + 100)
    canvas.height = MathUtils.ceilPowerOfTwo(fontSize * 3)

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.font = `bold ${fontSize}px ${fontFamily}`
    ctx.textAlign = 'center'

    ctx.save()
    ctx.fillStyle = textColor
    ctx.textBaseline = 'bottom'
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = 20
    ctx.fillText(text, centerX, centerY - gap / 2)
    ctx.restore()

    ctx.save()
    ctx.translate(centerX, centerY + gap / 2)
    ctx.scale(1, -1)
    ctx.font = `bold ${fontSize}px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = textColor
    ctx.fillText(text, 0, 0)
    ctx.restore()

    const gradient = ctx.createLinearGradient(0, centerY, 0, canvas.height)
    gradient.addColorStop(0, `rgba(0, 0, 0, ${1.0 - reflectionOpacity})`)
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 1.0)')

    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = gradient
    ctx.fillRect(0, centerY, canvas.width, canvas.height / 2)
    ctx.globalCompositeOperation = 'source-over'

    const texture = new CanvasTexture(canvas)
    texture.minFilter = LinearFilter

    const aspect = canvas.width / canvas.height
    const planeWidth = height * aspect
    const geometry = new PlaneGeometry(planeWidth, height)

    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
      alphaTest: 0.05,
    })
    super(geometry, material)
    this.#opts = mergedOpts
  }
}
