import { EventEmitter } from '@/utils/EventEmitter'

export class Size extends EventEmitter {
  constructor({ canvas }) {
    super()
    this.canvas = canvas
    this.init()
    window.addEventListener('resize', this.windowResize)
  }
  init() {
    this.width = this.canvas.parentElement.offsetWidth
    this.height = this.canvas.parentElement.offsetHeight
    // 安全地获取设备像素比，限制最大值为2，默认值为1
    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    this.pixelRatio = Math.min(devicePixelRatio, 2)
  }
  windowResize() {
    this.init()
    this.emit('resize', this.width, this.height, this.pixelRatio)
  }
  onResize(callback) {
    this.on('resize', callback)
  }
  destroy() {
    this.off('resize')
    window.removeEventListener('resize', this.windowResize)
  }
}
