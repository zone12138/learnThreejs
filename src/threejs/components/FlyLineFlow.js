import {
  AddEquation,
  AdditiveBlending,
  CanvasTexture,
  Color,
  CubicBezierCurve3,
  CustomBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OneFactor,
  RingGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
} from 'three'
import gsap from 'gsap'

/**
 * 流光飞线（加色光带 + 彗星头 + 节点脉冲）。
 *
 * 与旧实现（LineBasicMaterial + 整条透明度呼吸）的区别：
 * 1. 用 TubeGeometry 承载 uv.x（沿弧长均匀分布），着色器据此画「常亮链路 + 指数拖尾 + 高斯头部」，
 *    一条管子上同时有三种层次，且不需要逐帧重建几何体。
 * 2. 纯加色混合（One / One），亮度可以超过 1，头部自然过曝成白芯，无需后期 bloom。
 * 3. 线宽 / 光点 / 脉冲环全部按当前层级的跨度等比缩放。
 *    这些尺寸是世界单位，下钻后相机拉近 5~8 倍，固定尺寸会变成一根根粗管子。
 *
 * 用法：
 *   const flow = new FlyLineFlow({ scene })
 *   flow.setNodes([{ position: new Vector3(...) }, ...], { extent })
 *   scene.onTick((delta, elapsed) => flow.update(delta, elapsed))
 *   flow.dispose()
 */

/** 飞线配色：青绿为主，琥珀作点缀 */
export const DEFAULT_ROUTE_COLORS = [0x35e0ff, 0x5ff0c0, 0x9ff0ff, 0xffd166]

const FLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHead;     // 头部在曲线上的位置（0~1，按弧长参数化）
  uniform float uOpacity;  // 淡入淡出用
  uniform float uTail;     // 拖尾长度系数
  varying vec2 vUv;

  void main() {
    float u = vUv.x;
    float behind = uHead - u;

    // 头部：以 uHead 为中心的窄高斯，形成亮点而不是一刀切的断口。
    // 不能用 pow(behind, 2.0)：behind 可为负，GLSL 对负数底数的 pow 未定义
    float k = behind / 0.038;
    float head = exp(-k * k);

    // 拖尾：只保留头部之后（已飞过）的部分，指数衰减
    float tail = behind >= 0.0 ? exp(-behind / uTail) : 0.0;

    // 底层链路常亮，光带循环回卷时链路不会突然消失
    float base = 0.22 * smoothstep(0.0, 0.015, u) * (1.0 - smoothstep(0.985, 1.0, u));

    float intensity = base + tail * 1.25 + head * 2.4;
    vec3 color = mix(uColor, vec3(1.0), clamp(head * 0.9 + tail * 0.25, 0.0, 1.0));

    // 纯加色：alpha 不参与混合，亮度直接叠加，头部自然过曝
    gl_FragColor = vec4(color * intensity * uOpacity, 1.0);
  }
`

/**
 * 生成一张径向渐变贴图，供飞线头部与节点光点复用。
 * @param {number} [size] 贴图边长
 * @returns {CanvasTexture}
 */
function createGlowTexture(size = 128) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const half = size / 2
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.22, 'rgba(198, 250, 255, 0.85)')
  gradient.addColorStop(0.5, 'rgba(84, 214, 255, 0.3)')
  gradient.addColorStop(1, 'rgba(0, 150, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * 两点之间的弧线。侧向交替偏移，避免同一枢纽发出的多条线在投影上重叠成一条。
 * @param {Vector3} start 起点
 * @param {Vector3} end 终点
 * @param {number} index 序号（决定偏移方向与幅度）
 * @param {number} levelScale 当前层级跨度
 * @returns {CubicBezierCurve3}
 */
function createRouteCurve(start, end, index, levelScale) {
  const distance = start.distanceTo(end)
  // 抬升与跨度成比例：固定底座会让近景视图里的短程线变成尖刺，
  // 上下限则保证远距离线不至于飞出画面、近距离线也不至于贴地
  const lift = Math.min(Math.max(distance * 0.34, levelScale * 0.012), levelScale * 0.3)
  const direction = new Vector3().subVectors(end, start).setY(0).normalize()
  const side = new Vector3(-direction.z, 0, direction.x).multiplyScalar(
    (index % 2 === 0 ? 1 : -1) * distance * 0.07,
  )

  const control1 = start
    .clone()
    .lerp(end, 0.32)
    .add(new Vector3(0, lift, 0))
    .addScaledVector(side, 0.55)
  const control2 = start
    .clone()
    .lerp(end, 0.7)
    .add(new Vector3(0, lift * 0.8, 0))
    .add(side)

  return new CubicBezierCurve3(start.clone(), control1, control2, end.clone())
}

export class FlyLineFlow {
  #scene
  #colors
  #maxRoutes
  #texture
  #group = null
  #items = []
  #pulses = []
  #decorMaterials = []
  #scratch = new Vector3()

  /**
   * @param {Object} params
   * @param {import('three').Scene} params.scene 场景
   * @param {number[]} [params.colors] 飞线配色
   * @param {number} [params.maxRoutes] 最多绘制多少条线
   */
  constructor({ scene, colors = DEFAULT_ROUTE_COLORS, maxRoutes = 20 } = {}) {
    this.#scene = scene
    this.#colors = colors
    this.#maxRoutes = maxRoutes
    this.#texture = createGlowTexture()
  }

  /**
   * 重建飞线：以第一个节点为枢纽，连向其余节点。
   * @param {{ position: Vector3 }[]} nodes 节点（含世界坐标）
   * @param {{ extent?: number, fadeIn?: boolean }} [options] extent 为当前层级跨度
   */
  setNodes(nodes = [], { extent = 30, fadeIn = true } = {}) {
    this.clear()
    if (!this.#scene || nodes.length < 2) return

    const levelScale = Math.max(extent, 1)
    const tubeRadius = Math.max(0.008, levelScale * 0.0026)
    const headSize = Math.max(0.12, levelScale * 0.032)
    const dotSize = Math.max(0.08, levelScale * 0.018)
    const ringSize = Math.max(0.05, levelScale * 0.0085)

    const group = new Group()
    this.#scene.add(group)
    this.#group = group

    const hub = nodes[0]
    const targets = nodes.slice(1, this.#maxRoutes + 1)

    targets.forEach((target, index) => {
      const color = this.#colors[index % this.#colors.length]

      // 各条线在枢纽周围均匀错开一个很小的起点偏移：
      // 共用同一个起点时，加色混合会在枢纽叠成一团纯白，散开后才会有辐射的层次
      const angle = (index / targets.length) * Math.PI * 2
      const spread = levelScale * 0.014
      const start = hub.position
        .clone()
        .add(new Vector3(Math.cos(angle) * spread, 0, Math.sin(angle) * spread))

      const curve = createRouteCurve(start, target.position, index, levelScale)

      // 128 段保证弧线足够顺滑（uv.x 沿弧长均匀分布，见着色器）
      const tube = new Mesh(
        new TubeGeometry(curve, 128, tubeRadius, 8, false),
        this.#createFlowMaterial(color),
      )
      group.add(tube)

      const head = new Sprite(
        new SpriteMaterial({
          map: this.#texture,
          color,
          transparent: true,
          opacity: 0.9,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      )
      head.scale.setScalar(headSize)
      group.add(head)

      this.#items.push({
        curve,
        material: tube.material,
        head,
        progress: (index * 0.137) % 1, // 错峰出发，避免所有光点同步
        speed: 0.17 + (index % 5) * 0.02,
      })
    })

    // 节点：中心光点 + 扩散脉冲环，给静态板块一个「活着」的参照
    nodes.forEach((node, index) => {
      const dot = new Sprite(
        new SpriteMaterial({
          map: this.#texture,
          color: 0x9ff4ff,
          transparent: true,
          opacity: 0.85,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      )
      dot.position.copy(node.position)
      dot.scale.setScalar(dotSize)
      group.add(dot)

      const ring = new Mesh(
        // 单位半径，靠 scale 适配层级，脉冲动画在此基础上做倍数变化
        new RingGeometry(0.84, 1, 48),
        new MeshBasicMaterial({
          color: 0x5fe6ff,
          transparent: true,
          opacity: 0.4,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(node.position)
      ring.scale.setScalar(ringSize)
      group.add(ring)

      this.#pulses.push({ ring, phase: index / nodes.length, baseScale: ringSize })
    })

    this.#collectDecorMaterials()
    if (fadeIn) this.#fadeIn()
  }

  /**
   * 逐帧更新：推进光带、更新头部光点、驱动脉冲环。
   * @param {number} delta 距上一帧的秒数
   * @param {number} elapsed 场景运行时间（秒）
   */
  update(delta, elapsed) {
    // 切后台回来时 delta 可能很大，钳制一下避免光带瞬移
    const step = Math.min(delta, 0.05)

    for (const item of this.#items) {
      item.progress += item.speed * step
      if (item.progress > 1) item.progress -= 1

      item.material.uniforms.uHead.value = item.progress
      // getPointAt 是弧长参数化，与 TubeGeometry 的 uv.x 一致，光点不会脱离光带
      item.head.position.copy(item.curve.getPointAt(item.progress, this.#scratch))
      // 回卷到起点时让头部光点淡出，避免「瞬移」
      const edgeFade = Math.min(item.progress / 0.1, (1 - item.progress) / 0.1, 1)
      item.head.material.opacity = 0.9 * Math.max(edgeFade, 0)
    }

    for (const { ring, phase, baseScale } of this.#pulses) {
      const cycle = (elapsed * 0.4 + phase) % 1
      ring.scale.setScalar(baseScale * (0.8 + cycle * 3.2))
      ring.material.opacity = 0.45 * (1 - cycle)
    }
  }

  /** 移除并销毁当前所有飞线对象（保留贴图，供下次重建复用）。 */
  clear() {
    for (const item of this.#items) {
      gsap.killTweensOf(item.material.uniforms.uOpacity)
    }
    for (const material of this.#decorMaterials) gsap.killTweensOf(material)

    this.#items = []
    this.#pulses = []
    this.#decorMaterials = []

    if (!this.#group) return
    this.#group.traverse((object) => {
      object.geometry?.dispose?.()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material?.dispose?.())
    })
    this.#scene?.remove(this.#group)
    this.#group = null
  }

  /** 销毁：清空对象并释放共享贴图。 */
  dispose() {
    this.clear()
    this.#texture?.dispose()
    this.#texture = null
    this.#scene = null
  }

  /** 着色器材质：纯加色混合 + 自定义流动光带 */
  #createFlowMaterial(color) {
    return new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uHead: { value: 0 },
        uOpacity: { value: 1 },
        uTail: { value: 0.22 },
      },
      vertexShader: FLOW_VERTEX,
      fragmentShader: FLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    })
  }

  /** 收集节点光点/脉冲环的材质，用于整体淡入与补间清理 */
  #collectDecorMaterials() {
    this.#decorMaterials = []
    this.#group?.traverse((object) => {
      if (!object.isSprite && !object.isMesh) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!material || material.uniforms) return
        material.userData.baseOpacity = material.opacity
        this.#decorMaterials.push(material)
      })
    })
  }

  #fadeIn() {
    for (const item of this.#items) {
      item.material.uniforms.uOpacity.value = 0
      gsap.to(item.material.uniforms.uOpacity, {
        value: 1,
        duration: 0.7,
        ease: 'sine.out',
        overwrite: true,
      })
    }
    for (const material of this.#decorMaterials) {
      material.opacity = 0
      gsap.to(material, {
        opacity: material.userData.baseOpacity,
        duration: 0.7,
        ease: 'sine.out',
        overwrite: true,
      })
    }
  }
}
