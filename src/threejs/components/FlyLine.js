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
      depthWrite: false, // 禁用深度写入，避免透明物体渲染问题
      depthTest: true, // 启用深度测试，确保正确渲染
      side: DoubleSide,
      blending: AdditiveBlending, // 使用叠加模式，让颜色像光一样叠加
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uLength;
        uniform float uSpeed;
        
        void main() {
          // 计算流动位置（使用 x 方向的 UV 作为流动方向）
          float flowPosition = fract(vUv.x - uTime * uSpeed);

          float progressAlpha = 0.0;

          // 只显示流动光带部分
          // if (flowPosition > uLength) {
          //   discard;
          // }

          if (flowPosition <= uLength) {
            // 计算流动透明度渐变（头部亮，尾部暗）
            progressAlpha = flowPosition / uLength;
            progressAlpha = pow(progressAlpha, 2.0);
          }
          
          // 添加 3D 立体感
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(-vPosition);
          vec3 reflectDir = reflect(-viewDir, normal);
          float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
          
          // 基础颜色 + 高光增强
          vec3 finalColor = uColor + vec3(spec * 0.5);
          
          // 添加流动头部的亮度增强
          if (flowPosition <= uLength) {
            float headGlow = 1.0 - (flowPosition / uLength);
            headGlow = pow(headGlow, 4.0) * 2.0;
            finalColor += vec3(headGlow);
          }
          
          // 最终输出：非光带区域的 progressAlpha 是 0.0，在 Additive 叠加模式下就是完美的纯透明，绝无黑色条状
          gl_FragColor = vec4(finalColor * progressAlpha, progressAlpha);
        }
      `,
    })

    // 创建网格
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = 20
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
