import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Color,
  Line,
} from 'three'

const FLOWLINE_DEFAULT_OPTS = {
  points: [], // 点列表
  color: 0x00ccff, // 颜色
  speed: 0.001, // 移动速度
  length: 0.2, // 流光长度 (0-1)
}

export class FlowLine {
  constructor({ tickClock }, opts = {}) {
    this.tickClock = tickClock
    this.opts = Object.assign({}, FLOWLINE_DEFAULT_OPTS, opts)
    this.line = this.init()

    this.tickClock?.onTick(() => this.update())
    return this.line
  }
  init() {
    const { color, length, points } = this.opts
    const geometry = new BufferGeometry().setFromPoints(points)
    const count = points.length
    const progressArr = new Float32Array(count)
    let totalDistance = 0
    const distances = [0]
    for (let i = 1; i < count; i++) {
      totalDistance += points[i].distanceTo(points[i - 1])
      distances.push(totalDistance)
    }
    for (let i = 0; i < count; i++) {
      progressArr[i] = distances[i] / totalDistance
    }
    geometry.setAttribute('aProgress', new BufferAttribute(progressArr, 1))
    const material = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      blending: AdditiveBlending,
      uniforms: {
        uColor: { value: new Color(color) },
        uTime: { value: 0 },
        uLength: { value: length },
      },
      vertexShader: `
            attribute float aProgress;
            varying float vProgress;
            void main() {
                vProgress = aProgress;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
      fragmentShader: `
            uniform vec3 uColor;
            uniform float uTime;
            uniform float uLength;
            varying float vProgress;
            void main() {
                float time = mod(uTime, 1.0);
                float dist = mod(time - vProgress, 1.0);
                float alpha = 0.0;
                if (dist < uLength) {
                    alpha = 1.0 - (dist / uLength);
                    alpha = pow(alpha, 3.0);
                }
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
    })
    return new Line(geometry, material)
  }
  update() {
    const { speed } = this.opts
    if (this.line?.material?.uniforms) {
      this.line.material.uniforms.uTime.value += speed
    }
  }
}
