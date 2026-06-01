import type { ColorRepresentation } from 'three'

export interface ReflectTextureOpts {
  /**
   * 反射纹理高度
   */
  height?: number
  /**
   * 反射纹理字体大小
   */
  fontSize?: number
  /**
   * 反射纹理字体类型
   */
  fontFamily?: string
  /**
   * 反射纹理文本颜色
   */
  textColor?: ColorRepresentation
  /**
   * 反射纹理阴影颜色
   */
  shadowColor?: ColorRepresentation
  /**
   * 反射纹理文本间距
   */
  gap?: number
  /**
   * 反射纹理反射度
   */
  reflectionOpacity?: number
  /**
   * 反射纹理文本内容
   */
  text?: string
}
