import * as THREE from 'three'

const FLOW_POINTS_DEFAULTS = {
  points: [], // 基础路径点 (Vector3 数组)
  color: '#00ffff', // 粒子颜色
  size: 0.1, // 粒子大小
  count: 500, // 路径上的粒子总数
  speed: 0.03, // 流动速度
  length: 0.15, // 流光段的长度占比 (0-1)
}

export class FlowPoint {
  constructor({ tickClock }, opts = {}) {
    this.tickClock = tickClock
    this.opts = Object.assign({}, FLOW_POINTS_DEFAULTS, opts)
    this.instance = this.init()

    this.tickClock?.onTick(() => this.update())
    return this.instance
  }

  init() {
    const { points, count, color, size, length } = this.opts

    // 1. 使用曲线对原始点进行平滑重采样，确保粒子分布均匀
    const curve = new THREE.CatmullRomCurve3(points)
    const sampledPoints = curve.getSpacedPoints(count)

    const positions = new Float32Array(count * 3)
    const aProgress = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = sampledPoints[i].x
      positions[i * 3 + 1] = sampledPoints[i].y
      positions[i * 3 + 2] = sampledPoints[i].z

      // 每个粒子在路径上的进度位置 (0-1)
      aProgress[i] = i / count
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(aProgress, 1))

    // 2. 编写粒子 Shader
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
        uSize: { value: size },
        uLength: { value: length },
      },
      vertexShader: `
        uniform float uSize;
        uniform float uTime;
        uniform float uLength;
        attribute float aProgress;
        varying float vAlpha;

        void main() {
          // 计算粒子透明度：根据时间偏移进度
          // 这里的逻辑让粒子在原地通过透明度变化产生“流动”视觉
          float time = mod(uTime, 1.0);
          float dist = mod(time - aProgress, 1.0);
          
          vAlpha = 0.0;
          if (dist < uLength) {
            vAlpha = pow(1.0 - (dist / uLength), 2.0);
          }

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          // 粒子大小随距离衰减（可选）
          gl_PointSize = uSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          // 绘制圆形粒子（默认是方形）
          float r = distance(gl_PointCoord, vec2(0.5));
          if (r > 0.5) discard;
          
          // 边缘虚化
          float strength = (0.5 - r) * 2.0;
          gl_FragColor = vec4(uColor, vAlpha * strength);
        }
      `,
    })

    return new THREE.Points(geometry, material)
  }

  update() {
    if (this.instance?.material?.uniforms) {
      this.instance.material.uniforms.uTime.value += this.opts.speed * 0.01
    }
  }
}
