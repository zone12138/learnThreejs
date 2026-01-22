import { DoubleSide, ShaderMaterial, Color } from 'three'

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
