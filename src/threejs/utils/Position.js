import { Vector3 } from 'three'

/**
 * 获取Vector3位置
 * @param {*} position 位置
 * @returns {Vector3} Vector3位置
 */
export const getV3Position = (position) => {
  if (position instanceof Vector3) {
    return position
  } else if (
    position instanceof Object &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    typeof position.z === 'number'
  ) {
    return new Vector3(position.x, position.y, position.z)
  } else if (
    Array.isArray(position) &&
    position.length === 3 &&
    position.every((v) => typeof v === 'number')
  ) {
    return new Vector3(...position)
  } else {
    console.warn('position is not a valid position, default to (0, 0, 0)')
    return new Vector3(0, 0, 0)
  }
}
