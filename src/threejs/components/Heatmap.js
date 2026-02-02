import h337 from 'heatmap.js'
import merge from 'lodash-es/merge'

const HEATMAP_DEFAULT_OPTS = {}

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

    this.dom = document.createElement('div')
    this.dom.style.width = `${this.width}px`
    this.dom.style.height = `${this.height}px`
    this.dom.style.position = 'absolute'
    this.dom.style.top = '-9999px'
    document.body.appendChild(this.dom)

    this.instance = h337.create({
      container: this.dom,
      radius: 10,
      blur: 3,
    })
  }
}
