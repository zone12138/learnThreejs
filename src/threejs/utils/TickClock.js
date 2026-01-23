import { Clock } from 'three'
import { EventEmitter, rafFn } from '../libs/index'

export class TickClock extends EventEmitter {
  constructor() {
    super()
    this.instance = new Clock()
    this.raf = rafFn(() => this.nextTick())
    this.raf.start()
  }
  nextTick() {
    const delta = this.instance.getDelta()
    const elapsedTime = this.instance.getElapsedTime()
    this.emit('tick', delta, elapsedTime)
  }
  onTick(callback) {
    this.on('tick', callback)
  }
  destroy() {
    this.off('tick')
    this.raf.stop()
  }
}
