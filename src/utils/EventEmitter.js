export class EventEmitter {
  constructor() {
    this.events = new Map() // 事件名称 => 事件回调函数 Set
  }

  /**
   * 监听事件监听器
   * @param {string} eventName - 事件名称
   * @param {function} callback - 事件回调函数
   */
  on(eventName, callback) {
    let callbacks = this.events.get(eventName)
    if (!callbacks) {
      callbacks = new Set()
      this.events.set(eventName, callbacks)
    }
    callbacks.add(callback)
  }
  /**
   * 移除事件监听器
   * @param {string} eventName - 事件名称
   * @param {function} callback - 事件回调函数
   */
  off(eventName, callback) {
    const callbacks = this.events.get(eventName)
    if (callbacks) {
      if (callback) {
        callbacks.delete(callback)
      } else {
        this.events.delete(eventName)
      }
    } else if (eventName === '*') {
      this.events.clear()
    }
  }
  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {...any} args - 事件参数
   */
  emit(eventName, ...args) {
    const callbacks = this.events.get(eventName)
    if (callbacks) {
      callbacks.forEach((callback) => callback(...args))
    }
  }
  /**
   * 监听事件一次
   * @param {string} eventName - 事件名称
   * @param {function} callback - 事件回调函数
   */
  once(eventName, callback) {
    const onceCallback = (...args) => {
      callback(...args)
      this.off(eventName, onceCallback)
    }
    this.on(eventName, onceCallback)
  }
}
