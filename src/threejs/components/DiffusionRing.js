import merge from 'lodash-es/merge'
import { AdditiveBlending, Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three'

const DIFFUSION_RINGING = {
  color: 0x00ffff, // 颜色
  radius: 20, // 半径
  ringWidth: 0.03, // 环宽度
  speed: 0.002, // 流动速度
  renderOrder: 10, // 渲染顺序
}

export class DiffusionRing {
  constructor({ tickClock }, opts = {}) {
    this.tickClock = tickClock
    this.opts = merge({}, DIFFUSION_RINGING, opts)
    this.tickClock?.onTick(() => this.update())
    this.instance = this.init()
    return {
      instance: this.instance,
      update: () => this.update(),
    }
  }
  init() {
    const { radius, color, ringWidth, renderOrder } = this.opts
    const geometry = new PlaneGeometry(radius * 2, radius * 2)

    const material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uTime: { value: 0 },
        uWidth: { value: ringWidth },
      },
      transparent: true,
      depthWrite: false, // 防止遮挡其他物体
      blending: AdditiveBlending, // 叠加模式，更有发光感
      side: DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uWidth;
        void main() {
          // 计算当前像素到中心的距离 (0.0 到 0.5)
          float dist = distance(vUv, vec2(0.5));
          
          // 核心动画：进度从 0 到 0.5 循环
          float progress = mod(uTime, 0.5);
          
          // 计算环的位置
          // smoothstep 用于平滑边缘，防止锯齿
          float opacity = smoothstep(progress - uWidth, progress, dist) - smoothstep(progress, progress + 0.01, dist);
          
          // 边缘消失逻辑：距离中心越远，透明度越低 (实现由内向外消失)
          float fade = 1.0 - (progress / 0.5);
          
          gl_FragColor = vec4(uColor, opacity * fade);
        }
      `,
    })
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = renderOrder
    return mesh
  }
  update() {
    const { speed } = this.opts
    if (this.instance) this.instance.material.uniforms.uTime.value += speed
  }
}
