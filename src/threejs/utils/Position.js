import { Vector3 } from 'three'

export function getPosition(position) {
  if (position instanceof Vector3) {
    return position
  } else if (
    position instanceof Object &&
    typeof position.x === 'number' &&
    typeof position.y === 'number' &&
    typeof position.z === 'number'
  ) {
    return new Vector3(position.x, position.y, position.z)
  } else {
    console.warn('position is not a valid position, default to (0, 0, 0)')
    return new Vector3(0, 0, 0)
  }
}
