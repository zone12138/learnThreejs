import { Vector3, Color, Group, Scene } from 'three'

export interface ScanOpts {
  enabled?: boolean
  color?: number
  width?: number
  bumpHeight?: number
  speed?: number
}

export interface GridOpts {
  name?: string
  position?: Vector3
  gridSize?: number
  gridDivision?: number
  shapeSize?: number
  shapeColor?: Color
  pointSize?: number
  pointColor?: Color
  pointLayout?: {
    row: number
    col: number
  }
  scan?: ScanOpts
  autoAddToScene?: boolean
}
