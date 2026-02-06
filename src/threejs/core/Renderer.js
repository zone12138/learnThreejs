import { WebGLRenderer } from 'three'

export class Renderer extends WebGLRenderer {
  constructor({ canvas, sizes }) {
    super({ alpha: false, antialias: true, canvas })

    const resize = ({ width, height, pixelRatio }) => {
      this.setSize(width, height)
      this.setPixelRatio(pixelRatio)
    }
    resize(sizes)
    sizes.onResize(resize.bind(this))
  }
}
