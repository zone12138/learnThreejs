import h337 from 'heatmap.js'
import merge from 'lodash-es/merge'

const HEATMAP_DEFAULT_OPTS = {
  projection: {
    center: [0, 0],
    scale: 1,
    translate: [0, 0],
  },
  gradient: {
    0.5: '#1fc2e1',
    0.6: '#24d560',
    0.7: '#9cd522',
    0.8: '#f1e12a',
    0.9: '#ffbf3a',
    1.0: '#ff0000',
  },
  blur: 1,
  radius: 10,
  maxOpacity: 1,
}

export class Heatmap {
  constructor({ scene, sizes }, opts = {}) {
    this.scene = scene
    this.sizes = sizes ?? {}
    this.opts = merge({}, HEATMAP_DEFAULT_OPTS, opts)
    this.init()
  }
  init() {
    this.width = this.sizes.width ?? 1024
    this.height = this.sizes.height ?? 1024

    const { gradient, blur, radius, maxOpacity } = this.opts

    this.dom = document.createElement('div')
    this.dom.style.width = `${this.width}px`
    this.dom.style.height = `${this.height}px`
    this.dom.style.position = 'absolute'
    this.dom.style.top = '-9999px'
    document.body.appendChild(this.dom)

    this.instance = h337.create({
      container: this.dom,
      gradient,
      blur,
      radius,
      maxOpacity,
    })

    const greymap = h337.create({
      container: this.dom,
      gradient: {
        0.0: 'black',
        1.0: 'white',
      },
    })
  }
}
