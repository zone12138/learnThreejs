import { Vector2 } from 'three'
import { geoMercator } from 'd3'

const PROJECTION_DEFAULT_CENTER = {
  center: new Vector2(0, 0),
  scale: 1,
  translate: new Vector2(0, 0),
}

export function getMercatorProjection({
  center = PROJECTION_DEFAULT_CENTER.center,
  scale = PROJECTION_DEFAULT_CENTER.scale,
  translate = PROJECTION_DEFAULT_CENTER.translate,
} = PROJECTION_DEFAULT_CENTER) {
  return geoMercator().center(center).scale(scale).translate(translate)
}
