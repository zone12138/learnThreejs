import { CanvasTexture } from 'three'

/** @type {import('../types').TextTextureOpts} */
const TEXT_TEXTURE_DEFAULT_OPTS = {
  text: '', // 要显示的文字
  lines: [], // 多行文字（多行纹理用）
  textureType: 'simple', // 纹理类型：'simple' | 'reflection' | 'multiline'
  font: 'bold 48px Arial', // 字体样式
  color: '#ffffff', // 文字颜色
  bgColor: 'transparent', // 背景颜色
  padding: 20, // 内边距
  reflectionOpacity: 0.3, // 倒影透明度 (0-1)
  reflectionGap: 10, // 文字与倒影的间距
  textAlign: 'center', // 文字对齐方式
  lineHeight: 1.2, // 行高倍数（多行文字用）
}

/**
 * 文字纹理创建器 - 用于创建 canvas2D 文字纹理（支持倒影效果）
 */
export class TextTextureCreator extends CanvasTexture {
  /** @type {import('../types').TextTextureOpts} */
  #opts = {}

  /**
   * 文字纹理创建器
   * @param {import('../types').TextTextureOpts} opts 配置项
   */
  constructor(opts = {}) {
    const mergedOpts = Object.assign({}, TEXT_TEXTURE_DEFAULT_OPTS, opts)
    const canvas = TextTextureCreator.#createCanvas(mergedOpts)
    super(canvas)
    this.#opts = mergedOpts
    this.needsUpdate = true
  }

  /**
   * 创建 canvas
   * @private
   * @param {import('../types').TextTextureOpts} opts 配置项
   * @returns {HTMLCanvasElement} canvas 元素
   */
  static #createCanvas(opts) {
    const { textureType } = opts

    // 根据纹理类型选择创建方法
    switch (textureType) {
      case 'reflection':
        return TextTextureCreator.#createTextCanvas(opts)
      case 'multiline':
        return TextTextureCreator.#createMultilineTextCanvas(opts)
      case 'simple':
      default:
        return TextTextureCreator.#createSimpleTextCanvas(opts)
    }
  }

  /**
   * 创建带倒影的文字 canvas
   * @private
   * @param {import('../types').TextTextureOpts} opts 配置项
   * @returns {HTMLCanvasElement} canvas 元素
   */
  static #createTextCanvas(opts) {
    const { text, font, color, bgColor, padding, reflectionOpacity, reflectionGap, textAlign } =
      opts

    // 创建 canvas 元素
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // 设置字体
    ctx.font = font

    // 测量文字尺寸
    const metrics = ctx.measureText(text)
    const textWidth = metrics.width
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

    // 计算 canvas 尺寸（包含倒影）
    const canvasWidth = textWidth + padding * 2
    const canvasHeight = textHeight * 2 + reflectionGap + padding * 2

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    // 重新设置字体（canvas 尺寸改变后需要重新设置）
    ctx.font = font
    ctx.textAlign = textAlign
    ctx.textBaseline = 'top'

    // 绘制背景
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }

    // 计算文字起始位置
    let textX = padding
    if (textAlign === 'center') {
      textX = canvasWidth / 2
    } else if (textAlign === 'right') {
      textX = canvasWidth - padding
    }

    const textY = padding

    // 绘制原始文字
    ctx.fillStyle = color
    ctx.fillText(text, textX, textY)

    // 绘制倒影
    ctx.save()
    ctx.translate(0, canvasHeight)
    ctx.scale(1, -1) // 垂直翻转
    ctx.globalAlpha = reflectionOpacity

    // 创建渐变效果，让倒影从上到下逐渐消失
    const gradient = ctx.createLinearGradient(0, 0, 0, textHeight + reflectionGap + padding)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.fillStyle = gradient
    ctx.fillText(text, textX, padding + reflectionGap + textHeight)
    ctx.restore()

    return canvas
  }

  /**
   * 创建简单文字 canvas
   * @private
   * @param {import('../types').TextTextureOpts} opts 配置项
   * @returns {HTMLCanvasElement} canvas 元素
   */
  static #createSimpleTextCanvas(opts) {
    const { text, font, color, bgColor, padding, textAlign } = opts

    // 创建 canvas 元素
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // 设置字体
    ctx.font = font

    // 测量文字尺寸
    const metrics = ctx.measureText(text)
    const textWidth = metrics.width
    const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

    // 计算 canvas 尺寸
    const canvasWidth = textWidth + padding * 2
    const canvasHeight = textHeight + padding * 2

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    // 重新设置字体
    ctx.font = font
    ctx.textAlign = textAlign
    ctx.textBaseline = 'top'

    // 绘制背景
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }

    // 计算文字起始位置
    let textX = padding
    if (textAlign === 'center') {
      textX = canvasWidth / 2
    } else if (textAlign === 'right') {
      textX = canvasWidth - padding
    }

    const textY = padding

    // 绘制文字
    ctx.fillStyle = color
    ctx.fillText(text, textX, textY)

    return canvas
  }

  /**
   * 创建多行文字 canvas
   * @private
   * @param {import('../types').TextTextureOpts} opts 配置项
   * @returns {HTMLCanvasElement} canvas 元素
   */
  static #createMultilineTextCanvas(opts) {
    const {
      lines,
      font,
      color,
      bgColor,
      padding,
      lineHeight,
      reflectionOpacity,
      reflectionGap,
      textAlign,
    } = opts

    // 创建 canvas 元素
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // 设置字体
    ctx.font = font

    // 测量文字尺寸
    let maxWidth = 0
    const lineMetrics = lines.map((line) => {
      const metrics = ctx.measureText(line)
      maxWidth = Math.max(maxWidth, metrics.width)
      return metrics
    })

    const textHeight =
      lineMetrics[0].actualBoundingBoxAscent + lineMetrics[0].actualBoundingBoxDescent
    const totalTextHeight = textHeight * lines.length * lineHeight

    // 计算 canvas 尺寸（包含倒影）
    const canvasWidth = maxWidth + padding * 2
    const canvasHeight = totalTextHeight + padding * 2 + reflectionGap + totalTextHeight

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    // 重新设置字体
    ctx.font = font
    ctx.textAlign = textAlign
    ctx.textBaseline = 'top'

    // 绘制背景
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }

    // 计算文字起始 X 位置
    let textX = padding
    if (textAlign === 'center') {
      textX = canvasWidth / 2
    } else if (textAlign === 'right') {
      textX = canvasWidth - padding
    }

    const textY = padding

    // 绘制原始文字（多行）
    ctx.fillStyle = color
    lines.forEach((line, index) => {
      ctx.fillText(line, textX, textY + index * textHeight * lineHeight)
    })

    // 绘制倒影
    ctx.save()
    ctx.translate(0, canvasHeight)
    ctx.scale(1, -1) // 垂直翻转
    ctx.globalAlpha = reflectionOpacity

    // 创建渐变效果
    const gradient = ctx.createLinearGradient(0, 0, 0, totalTextHeight + reflectionGap + padding)
    gradient.addColorStop(0, color)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.fillStyle = gradient
    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        textX,
        padding + reflectionGap + totalTextHeight + index * textHeight * lineHeight,
      )
    })
    ctx.restore()

    return canvas
  }
}

export default TextTextureCreator
