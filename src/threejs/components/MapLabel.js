import { CanvasTexture, SpriteMaterial, Sprite, Vector3, LinearFilter } from 'three'
import { getV3Position } from '../utils/index.js'

const MAPLABEL_DEFAULT_OPTS = {
  fontSize: 16, // 字体大小
  fontFamily: 'Arial', // 字体
  fontWeight: 'Bold', // 字重
  color: '#ffffff', // 文字颜色
  backgroundColor: null, // 背景颜色 (支持透明度)
  borderColor: null, // 边框颜色 (可选)
  borderWidth: 2, // 边框宽度
  padding: [10, 20], // 内边距 [上下, 左右]
  scale: 0.016, // 世界缩放比例 (将像素映射到3D世界的倍数)
  offset: [0, 0, 0], // 相对位置偏移 (比如在坐标点上方一点显示)
  resolution: 4, // 清晰度倍数 (越高越清晰，但显存占用越大)
}

export class MapLabel {
  constructor({ name, position }, opts = {}) {
    this.name = name
    this.position = position
    this.opts = Object.assign({}, MAPLABEL_DEFAULT_OPTS, opts)
    return this.create()
  }

  create() {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const fontStr = `${this.opts.fontWeight} ${this.opts.fontSize}px ${this.opts.fontFamily}`
    ctx.font = fontStr

    const textMetrics = ctx.measureText(this.name)
    const textWidth = textMetrics.width
    // 估算文字高度 (近似值，canvas没有直接获取高度的完美API)
    const textHeight = this.opts.fontSize * 1.2

    // 计算画布实际需要的宽高 (包含内边距)
    const [padY, padX] = this.opts.padding
    const rawWidth = textWidth + padX * 2
    const rawHeight = textHeight + padY * 2

    // 应用清晰度倍数 (放大画布以抗锯齿)
    const r = this.opts.resolution
    canvas.width = rawWidth * r
    canvas.height = rawHeight * r

    // 重新设置 Context 属性 (因为修改 canvas 大小后会重置)
    ctx.font = `${this.opts.fontWeight} ${this.opts.fontSize * r}px ${this.opts.fontFamily}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    // 绘制背景 (圆角矩形逻辑稍微复杂，这里用普通矩形演示)
    if (this.opts.backgroundColor) {
      ctx.fillStyle = this.opts.backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // 绘制边框
    if (this.opts.borderColor) {
      ctx.strokeStyle = this.opts.borderColor
      ctx.lineWidth = this.opts.borderWidth * r
      ctx.strokeRect(0, 0, canvas.width, canvas.height)
    }

    // 绘制文字
    ctx.fillStyle = this.opts.color
    // 文字居中位置 = 画布中心
    ctx.fillText(this.name, canvas.width / 2, canvas.height / 2)

    const texture = new CanvasTexture(canvas)
    // 消除纹理缩放时的模糊
    texture.minFilter = LinearFilter

    const material = new SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const sprite = new Sprite(material)

    // style.scale 控制整体大小。比如 rawWidth=100, scale=0.01, 那么在3D里宽就是 1
    sprite.scale.set(rawWidth * this.opts.scale, rawHeight * this.opts.scale, 1)

    // 设置位置 + 偏移量
    sprite.position.copy(getV3Position(this.position)).add(new Vector3(...this.opts.offset))

    canvas.remove()

    return sprite
  }
}
