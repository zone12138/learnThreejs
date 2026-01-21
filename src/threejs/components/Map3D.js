import { Vector3, Group, MeshBasicMaterial, Shape, ExtrudeGeometry, Mesh, Object3D } from 'three'
import { getMercatorProjection, getFeatureCenter } from '@/utils/GeoProjection.js'
import { MapLine } from './MapLine.js'
import { MapLabel } from './MapLabel.js'

const MAPD_DEFAULT_OPTS = {
  position: new Vector3(0, 0, 0),
  projection: {
    center: [0, 0],
    scale: 100,
    translate: [0, 0],
  },
  renderOrder: 1,
  surfaceMaterial: new MeshBasicMaterial({
    color: 0xff0000,
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
  autoAddToScene: true,
  mapLine: {
    show: true,
    opts: {},
  },
  mapLabel: {
    show: true,
    opts: {},
  },
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
    this.instance = this.group
    this.createGroundMap()
  }
  createGroundMap() {
    const { data, surfaceMaterial, sideMaterial, extrudeOpts, mapLine, mapLabel } = this.opts
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
          const coordinates = []
          for (let i = 0; i < polygon.length; i++) {
            const [lng, lat] = polygon[i]
            if (!lng || !lat) return
            const [x, y] = this.projection(polygon[i])
            if (i === 0) {
              shape.moveTo(x, -y)
            }
            shape.lineTo(x, -y)
            coordinates.push([x, -y])
          }
          const geometry = new ExtrudeGeometry(shape, extrudeOpts)
          geometry.computeBoundingBox()
          geometry.computeBoundingSphere()
          const mesh = new Mesh(geometry, [surfaceMaterial, sideMaterial])
          object3D.add(mesh)

          if (mapLine.show) {
            const line = new MapLine(
              {
                projection: this.projection,
                coordinates: coordinates.map((v) => [...v, extrudeOpts.depth + 0.1]),
              },
              mapLine.opts,
            )
            this.group.add(line)
          }
        })
      })

      if (mapLabel.show) {
        const center = getFeatureCenter(feature)
        const [x, y] = this.projection(center)
        const label = new MapLabel(
          {
            name: properties?.name ?? '',
            position: [x, -y, extrudeOpts.depth + 0.2],
          },
          mapLabel.opts,
        )
        this.group.add(label)
      }

      this.group.add(object3D)
    })

    if (this.opts.autoAddToScene) this.scene?.add(this.group)
  }
}
