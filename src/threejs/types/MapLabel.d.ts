export interface MapLabelOpts {
    /**
     * 字体大小
     */
  fontSize: number
  /**
   * 字体
   */
  fontFamily: string
  /**
   * 字重
   */
  fontWeight: string
  /**
   * 文字颜色
   */
  color: string
  /**
   * 背景颜色 (支持透明度)
   */
  backgroundColor: null
  /**
   * 边框颜色 (可选)
   */
  borderColor: null
  /**
   * 边框宽度
   */
  borderWidth: number
  /**
   * 内边距 [上下, 左右]
   */
  padding: [number, number]
  /**
   * 世界缩放比例 (将像素映射到3D世界的倍数)
   */
  scale: number
  /**
   * 相对位置偏移 (比如在坐标点上方一点显示)
   */
  offset: [number, number, number]
  /**
   * 清晰度倍数 (越高越清晰，但显存占用越大)
   */
  resolution: number
}