import { onMounted, onUnmounted, shallowRef, toValue } from 'vue'
import { BasicThreejs } from '@/threejs/core'

/**
 * BasicThreejs 的 Vue 生命周期适配层（唯一的场景管理入口）：
 * onMounted 时创建实例，onUnmounted 时自动销毁（destroy 幂等，可重复调用）。
 *
 * 用法：
 *   const three = useThree(canvasRef, { cameraOpts: {...} })
 *   // 在组件自身的 onMounted（注册晚于本 hook）中即可访问 three.value
 *
 * @param {import('vue').Ref<HTMLCanvasElement>|HTMLCanvasElement} canvasRef canvas 引用
 * @param {Object} opts BasicThreejs 配置（cameraOpts / rendererOpts / controlsOpts / useInteraction）
 * @returns {import('vue').ShallowRef<BasicThreejs|null>} Three.js 基座实例
 */
export function useThree(canvasRef, opts = {}) {
  const three = shallowRef(null)

  onMounted(() => {
    const canvas = toValue(canvasRef)
    if (!canvas) {
      console.warn('useThree: canvas 未就绪，跳过 Three.js 初始化')
      return
    }
    three.value = new BasicThreejs(canvas, opts)
  })

  onUnmounted(() => {
    three.value?.destroy()
    three.value = null
  })

  return three
}
