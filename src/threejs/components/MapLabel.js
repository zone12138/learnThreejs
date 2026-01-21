import { CanvasTexture, SpriteMaterial, Sprite } from 'three'

export class MapLabel {
  constructor({ name, position }, style = {}) {
    this.name = name
    this.position = position // [x, y, z]
    this.style = Object.assign(
      {
        color: '#ffffff',
        fontSize: 14,
        scale: [2, 0.5, 1],
      },
      style,
    )

    return this.create()
  }

  create() {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 64

    // 绘制文字
    ctx.fillStyle = this.style.color
    ctx.font = `Bold ${this.style.fontSize * 4}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.name, 128, 32)

    const texture = new CanvasTexture(canvas)
    const material = new SpriteMaterial({ map: texture, transparent: true })
    const sprite = new Sprite(material)

    const [x, y, z = 0] = this.position
    console.log(x, y, z)
    sprite.position.set(x, y, z + 0.2) // 悬浮在表面上方
    sprite.scale.set(...this.style.scale)

    return sprite
  }
}
