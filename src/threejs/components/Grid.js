import {
  Vector3,
  Color,
  Group,
  Mesh,
  DoubleSide,
  Vector2,
  Shape,
  ShapeGeometry,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Points,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'
import merge from 'lodash-es/merge'
import { getV3Position } from '../utils/index'

/** @type {import('../types').GridOpts} */
const GRID_DEFAULT_OPTS = {
  name: 'grid',
  position: new Vector3(0, 0, 0),
  gridSize: 100,
  gridDivision: 25,
  shapeSize: 1,
  shapeColor: 0x8e9b9e,
  pointSize: 0.2,
  pointColor: 0x66673ff,
  pointLayout: { row: 200, col: 200 }, // 密度决定3D平滑度
  scan: {
    enabled: true, // 是否开启扫光效果(布尔值)
    center: new Vector3(0, 0, 0), // 扫光3D中心
    color: 0x00ffff, // 扫光颜色
    width: 5.0, // 光圈本身的宽度(浮点数)
    bumpHeight: 0.2, // 凸起高度(浮点数)
    speed: 10, // 扫描速度(浮点数)
  },
  autoAddToScene: true,
}

export class Grid extends Group {
  /** @type {import('../types').GridOpts} */
  #opts = {}
  #uniforms = {}

  /**
   * 创建一个 Grid 实例
   * @param {Object} context - 上下文对象
   * @param {import('three').Scene} context.scene - 场景
   * @param {Object} context.tickClock - 时钟实例
   * @param {import('../types').GridOpts} opts - 网格选项
   */
  constructor({ scene, tickClock }, opts = {}) {
    super()
    this.#opts = merge({}, GRID_DEFAULT_OPTS, opts)

    this.userData.update = (elapsedTime = 0) => {
      const { scan, gridSize } = this.#opts
      if (!scan.enabled) return
      // 让半径在 0 到 gridSize 之间循环，模拟单次扫光
      this.#uniforms.uRadius.value = (elapsedTime * scan.speed) % (gridSize + scan.width)
    }
    this.#init()

    if (this.#opts.autoAddToScene) scene?.add(this)
    // 接收 tickClock 回调 (delta, elapsedTime)
    tickClock?.onTick((_, elapsedTime) => {
      this.userData.update(elapsedTime)
    })
  }

  // 核心：单次扩散 Shader
  get sharedVertexShader() {
    return `
      varying float vHeight;
      uniform float uRadius;
      uniform float uWidth;
      uniform float uBumpHeight;
      uniform vec3 uCenter;
      uniform bool uScanEnabled;

      void main() {
        vec3 pos = position;
        float strength = 0.0;

        if (uScanEnabled) {
          float dist = distance(pos.xz, uCenter.xz);
          strength = smoothstep(uRadius - uWidth, uRadius, dist) * (1.0 - smoothstep(uRadius, uRadius + 0.1, dist));
          pos.y += strength * uBumpHeight;
        }
        vHeight = strength;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        #ifdef IS_POINTS
          gl_PointSize = ${this.#opts.pointSize.toFixed(2)} * (300.0 / -mvPosition.z);
        #endif
        gl_Position = projectionMatrix * mvPosition;
      }
    `
  }

  #init() {
    const { scan, pointColor, shapeColor, position, name } = this.#opts

    this.#uniforms = {
      uScanEnabled: { value: scan.enabled },
      uColor: { value: new Color(scan.color) },
      uRadius: { value: 0.0 },
      uWidth: { value: scan.width },
      uBumpHeight: { value: scan.bumpHeight },
      uCenter: { value: getV3Position(scan.center) },
      uPointColor: { value: new Color(pointColor) },
      uShapeColor: { value: new Color(shapeColor) },
    }

    this.name = name
    this.add(this.#createShapes(), this.#createAnimatedPoints())
    this.position.copy(getV3Position(position))
  }

  #createAnimatedPoints() {
    const { gridSize, pointLayout } = this.#opts
    const { row, col } = pointLayout
    const positions = new Float32Array(row * col * 3)
    for (let i = 0; i < row; i++) {
      for (let j = 0; j < col; j++) {
        const idx = (i * col + j) * 3
        positions[idx] = (i / (row - 1)) * gridSize - gridSize / 2
        positions[idx + 1] = 0
        positions[idx + 2] = (j / (col - 1)) * gridSize - gridSize / 2
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))

    return new Points(
      geometry,
      new ShaderMaterial({
        uniforms: this.#uniforms,
        transparent: true,
        defines: { IS_POINTS: true },
        vertexShader: this.sharedVertexShader,
        fragmentShader: `
        varying float vHeight;
        uniform vec3 uColor;
        uniform vec3 uPointColor;
        void main() {
          vec3 finalColor = mix(uPointColor, uColor, vHeight);
          gl_FragColor = vec4(finalColor, 0.5 + vHeight * 0.5);
        }
      `,
      }),
    )
  }

  #createShapes() {
    const { gridSize, gridDivision, shapeSize } = this.#opts
    const shapeSpace = gridSize / gridDivision
    const range = gridSize / 2
    const shapeGeometries = []
    for (let i = 0; i <= gridDivision; i++) {
      for (let j = 0; j <= gridDivision; j++) {
        const g = this.#createPlus(shapeSize)
        g.rotateX(-Math.PI / 2)
        g.translate(-range + i * shapeSpace, 0.05, -range + j * shapeSpace)
        shapeGeometries.push(g)
      }
    }
    return new Mesh(
      mergeGeometries(shapeGeometries),
      new ShaderMaterial({
        uniforms: this.#uniforms,
        side: DoubleSide,
        transparent: true,
        vertexShader: this.sharedVertexShader,
        fragmentShader: `
        varying float vHeight;
        uniform vec3 uColor;
        uniform vec3 uShapeColor;
        void main() {
          vec3 finalColor = mix(uShapeColor, uColor, vHeight);
          gl_FragColor = vec4(finalColor, 0.5 + vHeight * 0.5);
        }
      `,
      }),
    )
  }

  #createPlus(s = 1) {
    let w = s / 8,
      h = s / 2
    let shape = new Shape([
      new Vector2(-h, -w),
      new Vector2(-w, -w),
      new Vector2(-w, -h),
      new Vector2(w, -h),
      new Vector2(w, -w),
      new Vector2(h, -w),
      new Vector2(h, w),
      new Vector2(w, w),
      new Vector2(w, h),
      new Vector2(-w, h),
      new Vector2(-w, w),
      new Vector2(-h, w),
    ])
    return new ShapeGeometry(shape)
  }
}
