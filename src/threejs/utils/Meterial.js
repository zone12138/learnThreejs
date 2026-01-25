import { DoubleSide, ShaderMaterial, Color, Material } from 'three'

const SIDELAYER_DEFAULT_OPTS = {
  color1: 0x2a6e92,
  color2: 0x102736,
  depth: 0.5,
  lineCount: 12,
  lineWidth: 0.05,
}
export const createSideLayerMaterial = (opts) => {
  const { color1, color2, depth, lineCount, lineWidth } = Object.assign(
    {},
    SIDELAYER_DEFAULT_OPTS,
    opts,
  )
  return new ShaderMaterial({
    transparent: true,
    side: DoubleSide,
    uniforms: {
      uTopColor: { value: new Color(color1) },
      uBottomColor: { value: new Color(color2) },
      uDepth: { value: depth },
      uLineCount: { value: lineCount },
      uLineWidth: { value: lineWidth },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position; // 将局部坐标传递给片元着色器
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPosition;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uDepth;
      uniform float uLineCount;
      uniform float uLineWidth;

      void main() {
        // 1. 计算当前像素在高度上的占比 (0.0 到 1.0)
        // 注意：ExtrudeGeometry 默认沿 Z 轴拉伸
        float h = vPosition.z / uDepth;

        // 2. 基础渐变底色
        vec3 baseColor = mix(uBottomColor, uTopColor, h);

        // 3. 计算层级线条 (使用 fract 函数产生周期性)
        // fract(h * uLineCount) 会在每个层级内产生 0->1 的循环
        float linePattern = fract(h * uLineCount);
        
        // 使用 smoothstep 创造清晰的线条边缘
        float lineEffect = smoothstep(1.0 - uLineWidth, 1.0, linePattern);

        // 4. 最终颜色融合：底色 + 线条发光
        vec3 finalColor = baseColor + (uTopColor * lineEffect * 0.8);

        // 5. 透明度处理：越往下越透明，增加悬浮感
        float alpha = mix(0.4, 0.9, h);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  })
}

/**
 * 改变mesh的material
 * @param {*} targetObject 网格/组
 * @param {*} materialOrConfig 网格材质
 * @param {*} cloneMaterial 是否克隆材质【因为如果其他mesh也使用了同一个材质（地址引用），不克隆的话，其他mesh的材质也会被改变】
 */
export const changeMeshMaterial = (targetObject, materialOrConfig, cloneMaterial = true) => {
  if (!targetObject || !materialOrConfig) return
  // 使用 traverse 递归遍历目标对象及其所有子对象
  console.log('changeMeshMaterial', targetObject)
  targetObject.traverse((child) => {
    // 只处理 Mesh (网格)，忽略光源、相机或空 Group
    if (child.isMesh) {
      // 传入的是材质实例 (直接替换)
      if (materialOrConfig.isMaterial) {
        child.material = materialOrConfig
      } else if (typeof materialOrConfig === 'object') {
        // 传入的是配置对象 (修改现有材质属性)
        // 如果 Mesh 有多个材质 (Array)，则遍历处理；如果是单个材质，直接处理
        const isArrayMaterial = Array.isArray(child.material)
        let materials = isArrayMaterial ? child.material : [child.material]
        // 如果开启了克隆，我们需要先克隆一份出来
        if (cloneMaterial) {
          // 如果是材质数组，需要逐个克隆
          if (isArrayMaterial) {
            child.material = child.material.map((m) => m.clone())
            materials = child.material // 更新引用指向新的克隆体
          } else {
            child.material = child.material.clone()
            materials = [child.material] // 更新引用
          }
        }
        materials.forEach((mat) => {
          for (const key in materialOrConfig) {
            const value = materialOrConfig[key]
            // 特殊处理颜色 (Three.js 的 Color 对象建议用 set 方法)
            if (key === 'color' && mat.color && mat.color.isColor) {
              mat.color.set(value)
            } else if (key === 'map' || key === 'alphaMap') {
              // 特殊处理贴图 (如果传入的是 Texture 对象 - 贴图更新通常需要标记)
              mat[key] = value
              mat.needsUpdate = true
            } else {
              // 普通属性直接赋值 (如 opacity, transparent, wireframe)
              mat[key] = value
            }
          }
        })
      }
    }
  })
}
