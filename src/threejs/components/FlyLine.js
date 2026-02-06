import {
  Vector3,
  QuadraticBezierCurve3,
  TubeGeometry,
  ShaderMaterial,
  Mesh,
  Color,
  DoubleSide,
} from 'three'
import merge from 'lodash-es/merge'
import { getV3Position } from '../utils'

const FLYLINE_DEFAULT_OPTS = {
  start: new Vector3(0, 0, 0),
  end: new Vector3(0, 0, 0),
  color: 0x00ffff,
  radius: 0.1,
  height: 5,
  speed: 1.0,
  length: 0.4,
}

export class FlyLine extends Mesh {
  #opts = {}
  /**
   * @param {import('./FlyLine').FlyLineOpts} opts 配置项
   */
  constructor({ tickClock }, opts = {}) {
    const mergedOpts = merge({}, FLYLINE_DEFAULT_OPTS, opts)
    super(...FlyLine.#createMesh(mergedOpts))
    this.#opts = mergedOpts

    this.userData.update = (delta) => {
      if (this.material) {
        this.material.uniforms.uTime.value += delta * this.#opts.speed
      }
    }
    tickClock.onTick((delta) => {
      this.userData.update(delta)
    })
  }

  static #createMesh(opts) {
    const { start, end, height, radius, length, color } = opts
    // 二次贝塞尔曲线路径
    // 计算中点并抬高高度
    const middle = getV3Position(start).lerp(getV3Position(end), 0.5)
    middle.z += height

    const curve = new QuadraticBezierCurve3(start, middle, end)

    // 管道几何体 (64是分段数，越多越平滑)
    const geometry = new TubeGeometry(curve, 64, radius, 8, false)

    // 着色器
    const material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uTime: { value: 0 },
        uLength: { value: length },
      },
      transparent: true,
      depthWrite: false, // 飞线通常不写深度，防止遮挡透明层
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
        uniform float uLength;

        void main() {
          // 核心逻辑：利用 fract 实现循环流动偏移
          // vUv.x 是管道的路径长度方向
          float alpha = fract(vUv.x - uTime);
          
          // 只保留一段亮线
          if (alpha > uLength) {
            discard;
          }

          // 渐变效果：头部亮，尾部暗
          float strength = alpha / uLength;
          gl_FragColor = vec4(uColor, strength);
        }
      `,
    })

    return [geometry, material]
  }

  /**
   * 必须在外部的渲染循环中调用此更新方法
   * @param {number} delta
   */
  update(delta) {
    if (this.material) {
      this.material.uniforms.uTime.value += delta * this.opts.speed
    }
  }

  dispose() {
    this.instance.geometry.dispose()
    this.instance.material.dispose()
    this.scene.remove(this.instance)
  }
}
