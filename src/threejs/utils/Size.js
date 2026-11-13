import { EventEmitter, bindEvents } from '../libs/index'

/**
 * 尺寸监听：优先用 ResizeObserver 监听容器（分栏/面板折叠等非窗口级变化也能响应），
 * 降级为 window resize。读取 canvas 父容器尺寸作为渲染尺寸。
 */
export class Size extends EventEmitter {
  constructor({ canvas }) {
    super()
    this.canvas = canvas
    this.init()

    this.unbindResize = bindEvents(window, 'resize', () => {
      this.windowResize()
    })

    this.observer = null
    if (typeof ResizeObserver !== 'undefined' && canvas?.parentElement) {
      this.observer = new ResizeObserver(() => {
        this.windowResize()
      })
      this.observer.observe(canvas.parentElement)
    }
  }
  init() {
    this.width = this.canvas.parentElement.offsetWidth
    this.height = this.canvas.parentElement.offsetHeight
    // 安全地获取设备像素比，限制最大值为2，默认值为1
    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    this.pixelRatio = Math.min(devicePixelRatio, 2)
  }
  windowResize() {
    const width = this.canvas.parentElement.offsetWidth
    const height = this.canvas.parentElement.offsetHeight
    // 尺寸未变化时跳过，避免 ResizeObserver 重复触发
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.emit('resize', { width: this.width, height: this.height, pixelRatio: this.pixelRatio })
  }
  onResize(callback) {
    this.on('resize', callback)
  }
  destroy() {
    this.off('resize')
    this.unbindResize?.()
    this.observer?.disconnect()
    this.observer = null
  }
}
