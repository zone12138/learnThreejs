import {
  Vector3,
  Vector2,
  Group,
  MeshBasicMaterial,
  Shape,
  ExtrudeGeometry,
  Mesh,
  Object3D,
} from 'three'
import { getMercatorProjection } from '@/utils/GeoProjection.js'

const MAPD_DEFAULT_OPTS = {
  position: new Vector3(0, 0, 0),
  projection: {
    center: [0, 0],
    scale: 1,
    translate: [0, 0],
  },
  renderOrder: 1,
  surfaceMaterial: new MeshBasicMaterial({
    color: 0x18263b,
    transparent: true,
    opacity: 1,
  }),
  sideMaterial: new MeshBasicMaterial({
    color: 0x07152b,
    transparent: true,
    opacity: 1,
  }),
  extrudeOpts: {
    depth: 0.1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelThickness: 0.1,
  },
  data: null,
}

export class Map3D {
  constructor({ scene }, opts = {}) {
    this.scene = scene
    this.opts = Object.assign({}, MAPD_DEFAULT_OPTS, opts)
    this.init()
  }
  init() {
    const { projection, position, renderOrder } = this.opts
    this.projection = getMercatorProjection(projection)
    this.group = new Group()
    this.group.renderOrder = renderOrder
    this.group.position.copy(position)
    this.createGroundMap()
  }
  createGroundMap() {
    const { data, surfaceMaterial, sideMaterial, extrudeOpts } = this.opts
    if (!data) {
      console.warn('data is null, create ground map failed')
      return
    }
    const object3D = new Object3D()
    data?.features?.forEach((feature) => {
      const { geometry, properties } = feature
      const { type, coordinates } = geometry ?? {}

      coordinates?.forEach((multiPolygon) => {
        if (type === 'Polygon') multiPolygon = [multiPolygon]

        multiPolygon?.forEach((polygon) => {
          const shape = new Shape()
          for (let i = 0; i < polygon.length; i++) {
            const [lng, lat] = polygon[i]
            if (!lng || !lat) return
            const [x, y] = this.projection(polygon[i])
            if (i === 0) {
              shape.moveTo(x, -y)
            } else {
              shape.lineTo(x, -y)
            }
          }
          const geometry = new ExtrudeGeometry(shape, extrudeOpts)
          const mesh = new Mesh(geometry, [surfaceMaterial, sideMaterial])
          object3D.add(mesh)
        })
      })
      this.group.add(object3D)
    })
    this.scene.add(this.group)
    console.log(this.scene)
  }
}
