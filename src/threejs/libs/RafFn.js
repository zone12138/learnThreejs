export function rafFn(fn) {
  let id = null,
    active = false,
    paused = false

  function animate() {
    if (!active || paused) return
    fn()
    id = requestAnimationFrame(animate)
  }

  function start() {
    if (active) return
    active = true
    animate()
  }

  function stop() {
    if (active || paused) {
      active = false
      paused = false
      cancelAnimationFrame(id)
    }
  }

  function pause() {
    if (active) {
      active = false
      paused = true
      cancelAnimationFrame(id)
    }
  }

  function resume() {
    if (!active && paused) {
      active = true
      paused = false
      animate()
    }
  }

  return {
    start,
    stop,
    pause,
    resume,
    isActive: () => active,
    isPaused: () => paused,
  }
}
