/**
 * 通用事件绑定函数
 * 支持两种传参模式：
 * 1. 数组模式: [{ target, event, callback, opts: {}|boolean, args: [] }, ...]
 * 2. 参数模式: target, eventName, listener, opts: {}|boolean, arg1, arg2, ...
 * * @returns {Function} 解绑函数 (调用即移除所有绑定的事件)
 */
export function bindEvents(...args) {
  let tasks = []
  if (args.length === 0) return () => {}
  // 判断参数模式
  if (args.length === 1 && Array.isArray(args[0])) {
    tasks = args[0]
  } else if (args.length >= 3) {
    tasks = [
      {
        target: args[0],
        event: args[1],
        callback: args[2],
        opts: args[3] || false,
        args: args.slice(4),
      },
    ]
  }

  if (tasks.length === 0) return () => {}
  // 用于存储所有的解绑操作
  const unbinders = []
  // 执行绑定事件
  tasks.forEach((task) => {
    const { target = window, event, callback, opts = false, args = [] } = task
    // 安全检查：确保目标存在且具备 addEventListener 方法
    if (
      target &&
      typeof target.addEventListener === 'function' &&
      event &&
      typeof callback === 'function' &&
      (opts instanceof Object || typeof opts === 'boolean')
    ) {
      const handler = function (e) {
        callback.apply(this, [e, ...args])
      }
      console.log('opts', opts)
      // 绑定事件
      target.addEventListener(event, handler, opts)
      // 将对应的解绑逻辑推入数组
      unbinders.push(() => {
        target.removeEventListener(event, handler)
      })
    } else {
      console.warn('bindEvents: Invalid arguments for task', task)
    }
  })
  // 返回解绑函数
  return function unbindAll() {
    unbinders.forEach((unbind) => unbind())
    unbinders.length = 0
  }
}
