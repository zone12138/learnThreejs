import {
  Vector3,
  QuadraticBezierCurve3,
  TubeGeometry,
  ShaderMaterial,
  Mesh,
  Color,
  DoubleSide,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  AdditiveBlending,
} from 'three'
import merge from 'lodash-es/merge'

/**
 * 飞线类 - 用于在 3D 地图中创建两点之间的动态流动效果
 */
export class FlyLine {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Vector3} options.start - 起点位置
   * @param {Vector3} options.end - 终点位置
   * @param {number} [options.color=0x00ffff] - 飞线颜色
   * @param {number} [options.height=5] - 飞线最高点高度
   * @param {number} [options.radius=0.1] - 飞线粗细
   * @param {number} [options.speed=1.0] - 流动速度
   * @param {number} [options.length=0.3] - 流动光带长度
   * @param {number} [options.curveSegments=64] - 曲线分段数
   */
  constructor({ tickClock }, options = {}) {
    // 默认配置
    const defaultOptions = {
      start: new Vector3(0, 0, 0),
      end: new Vector3(10, 0, 10),
      color: 0x00ffff,
      height: 5,
      radius: 0.1,
      speed: 1.0,
      length: 0.3,
      curveSegments: 64,
    }

    // 合并配置
    this.options = merge({}, defaultOptions, options)

    // 创建飞线路径
    this.path = this.#createPath()

    // 创建飞线几何体和材质
    this.mesh = this.#createMesh()

    // 时间变量，用于控制流动效果
    this.time = 0

    tickClock.onTick((delta) => {
      this.update(delta)
    })
  }

  /**
   * 创建飞线路径
   * @private
   * @returns {QuadraticBezierCurve3} 飞线路径
   */
  #createPath() {
    const { start, end, height } = this.options

    // 计算中点并抬高高度，形成弧形
    const middle = new Vector3().addVectors(start, end).multiplyScalar(0.5)
    middle.y += height
    // middle.z += height

    // 创建二次贝塞尔曲线
    return new QuadraticBezierCurve3(start, middle, end)
  }

  /**
   * 创建飞线网格
   * @private
   * @returns {Mesh} 飞线网格
   */
  #createMesh() {
    const { radius, color, curveSegments, length, speed } = this.options

    // 创建管道几何体
    const geometry = new TubeGeometry(this.path, curveSegments, radius, 8, false)

    // 创建着色器材质
    const material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uTime: { value: 0 },
        uLength: { value: length },
        uSpeed: { value: speed },
      },
      transparent: true,
      side: DoubleSide,
      blending: AdditiveBlending, // 关键：使用叠加模式，让颜色像光一样叠加，而不是像颜料一样混合
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
        uniform float uSpeed;
        
        void main() {
          // 计算流动位置
          float flowPosition = fract(vUv.x - uTime * uSpeed);

          // 只显示流动光带部分
          if (flowPosition > uLength) {
            discard;
          }
          
          // 计算透明度渐变（头部亮，尾部暗）
          float alpha = flowPosition / uLength;
          
          // 增强头部亮度效果
          alpha = pow(alpha, 2.0);
          
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })

    // 创建网格
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = 9999
    return mesh
  }

  /**
   * 更新飞线动画
   * @param {number} delta - 时间增量
   */
  update(delta) {
    if (this.mesh && this.mesh.material.uniforms) {
      this.time += delta
      this.mesh.material.uniforms.uTime.value = this.time
    }
  }

  /**
   * 销毁飞线，释放资源
   */
  dispose() {
    if (this.mesh) {
      // 释放几何体和材质
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose()
      }
      if (this.mesh.material) {
        this.mesh.material.dispose()
      }
    }
  }

  /**
   * 获取飞线网格对象
   * @returns {Mesh} 飞线网格
   */
  get object3D() {
    return this.mesh
  }
}

/**
 * 轻量级飞线类 - 适用于大量飞线场景，性能更高
 */
export class LightFlyLine {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {Vector3} options.start - 起点位置
   * @param {Vector3} options.end - 终点位置
   * @param {number} [options.color=0x00ffff] - 飞线颜色
   * @param {number} [options.height=3] - 飞线最高点高度
   * @param {number} [options.points=20] - 路径点数
   */
  constructor(options = {}) {
    const defaultOptions = {
      start: new Vector3(0, 0, 0),
      end: new Vector3(10, 0, 10),
      color: 0x00ffff,
      height: 3,
      points: 20,
    }

    this.options = merge({}, defaultOptions, options)
    this.path = this.#createPath()
    this.mesh = this.#createMesh()
  }

  /**
   * 创建飞线路径点
   * @private
   * @returns {Vector3[]} 路径点数组
   */
  #createPath() {
    const { start, end, height, points } = this.options
    const pathPoints = []

    // 计算中点并抬高
    const middle = new Vector3().addVectors(start, end).multiplyScalar(0.5)
    middle.y += height

    // 创建二次贝塞尔曲线路径点
    const curve = new QuadraticBezierCurve3(start, middle, end)

    // 生成路径点
    for (let i = 0; i <= points; i++) {
      const point = curve.getPoint(i / points)
      pathPoints.push(point)
    }

    return pathPoints
  }

  /**
   * 创建轻量级飞线
   * @private
   * @returns {Line} 飞线对象
   */
  #createMesh() {
    const { color } = this.options

    // 创建几何体
    const geometry = new BufferGeometry()
    const positions = []

    // 填充位置数据
    for (const point of this.path) {
      positions.push(point.x, point.y, point.z)
    }

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))

    // 创建材质
    const material = new LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.6,
    })

    // 创建线条
    const line = new Line(geometry, material)
    return line
  }

  /**
   * 获取飞线对象
   * @returns {Line} 飞线对象
   */
  get object3D() {
    return this.mesh
  }

  /**
   * 销毁飞线
   */
  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose()
      }
      if (this.mesh.material) {
        this.mesh.material.dispose()
      }
    }
  }
}
