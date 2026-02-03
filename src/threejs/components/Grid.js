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
    enabled: true,
    color: 0x00ffff,
    width: 5.0, // 光圈本身的宽度
    bumpHeight: 0.2, // 凸起高度
    speed: 10, // 扫描速度
  },
  autoAddToScene: true,
}

export class Grid {
  constructor({ scene, tickClock }, opts = {}) {
    this.scene = scene
    this.tickClock = tickClock
    this.opts = merge({}, GRID_DEFAULT_OPTS, opts)

    // 接收 tickClock 回调 (delta, elapsedTime)
    this.tickClock.onTick((_, elapsedTime) => {
      this.update(elapsedTime)
    })

    return this.init()
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
          gl_PointSize = ${this.opts.pointSize.toFixed(2)} * (300.0 / -mvPosition.z);
        #endif
        gl_Position = projectionMatrix * mvPosition;
      }
    `
  }

  init() {
    const { scan, pointColor, position, name, autoAddToScene } = this.opts

    this.uniforms = {
      uScanEnabled: { value: scan.enabled },
      uColor: { value: new Color(scan.color) },
      uRadius: { value: 0.0 },
      uWidth: { value: scan.width },
      uBumpHeight: { value: scan.bumpHeight },
      uCenter: { value: getV3Position(position) },
      uBaseColor: { value: new Color(pointColor) },
    }

    const group = new Group()
    group.name = name
    group.add(this.createShapes(), this.createAnimatedPoints())
    group.position.copy(getV3Position(position))
    if (autoAddToScene) this.scene?.add(group)
    group.userData.update = this.update.bind(this)
    return group
  }

  createAnimatedPoints() {
    const { gridSize, pointLayout } = this.opts
    const positions = new Float32Array(pointLayout.row * pointLayout.col * 3)
    for (let i = 0; i < pointLayout.row; i++) {
      for (let j = 0; j < pointLayout.col; j++) {
        const idx = (i * pointLayout.col + j) * 3
        positions[idx] = (i / (pointLayout.row - 1)) * gridSize - gridSize / 2
        positions[idx + 1] = 0
        positions[idx + 2] = (j / (pointLayout.col - 1)) * gridSize - gridSize / 2
      }
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))

    return new Points(
      geometry,
      new ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        defines: { IS_POINTS: true },
        vertexShader: this.sharedVertexShader,
        fragmentShader: `
        varying float vHeight;
        uniform vec3 uColor;
        uniform vec3 uBaseColor;
        void main() {
          vec3 baseColor = uBaseColor;
          vec3 finalColor = mix(baseColor, uColor, vHeight);
          gl_FragColor = vec4(finalColor, 0.4 + vHeight * 0.6);
        }
      `,
      }),
    )
  }

  createShapes() {
    const { gridSize, gridDivision, shapeSize } = this.opts
    const shapeSpace = gridSize / gridDivision
    const range = gridSize / 2
    const shapeGeometries = []
    for (let i = 0; i <= gridDivision; i++) {
      for (let j = 0; j <= gridDivision; j++) {
        const g = this.createPlus(shapeSize)
        g.rotateX(-Math.PI / 2)
        g.translate(-range + i * shapeSpace, 0.05, -range + j * shapeSpace)
        shapeGeometries.push(g)
      }
    }
    return new Mesh(
      mergeGeometries(shapeGeometries),
      new ShaderMaterial({
        uniforms: this.uniforms,
        side: DoubleSide,
        transparent: true,
        vertexShader: this.sharedVertexShader,
        fragmentShader: `
        varying float vHeight;
        uniform vec3 uColor;
        void main() {
          vec3 baseColor = vec3(0.4, 0.45, 1);
          vec3 finalColor = mix(baseColor, uColor, vHeight);
          gl_FragColor = vec4(finalColor, 0.5 + vHeight * 0.5);
        }
      `,
      }),
    )
  }

  createPlus(s = 1) {
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

  update(elapsedTime = 0) {
    const { scan } = this.opts
    if (!scan.enabled) return
    // 让半径在 0 到 gridSize 之间循环，模拟单次扫光
    const maxRadius = this.opts.gridSize
    this.uniforms.uRadius.value = (elapsedTime * scan.speed) % (maxRadius + scan.width)
  }
}
