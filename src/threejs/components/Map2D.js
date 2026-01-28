import { Mesh, Vector3, Group, Object3D, Shape, ShapeGeometry, MeshBasicMaterial } from 'three'
import merge from 'lodash-es/merge'
import { MapLabel, MapLine, FlowLineGroup } from './index.js'
import { getV3Position, changeMeshMaterial } from '../utils/index.js'
import { getMercatorProjection, getFeatureCenter, bindEvents } from '../libs/index.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'

const NAME = 'Map2D' // 地图2D组件名称
const MAP2D_DEFAULT_OPTS = {
  position: new Vector3(0, 0, 0), // 地图2D位置
  projection: {
    center: [0, 0],
    scale: 50,
    translate: [0, 0],
  },
  renderOrder: 2, // 地图2D渲染顺序，用于解决渲染顺序问题，数值越大越靠前渲染
  material: new MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 1 }), // 地图2D材质，用于渲染地图2D元素
  highLight: true, // 是否显示地图2D元素的高亮效果
  highLightMaterial: new MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 }), // 地图2D元素的高亮材质，用于渲染地图2D元素的高亮效果
  data: null, // 地图2D元素的数据，用于存储地图2D元素的相关信息
  autoAddToScene: true, // 是否自动添加到场景中
  mergeAll: true, // 是否合并所有地图2D元素【合并所有区域，不拥有交互功能】
  mapLine: {
    show: true, // 是否显示地图线
    opts: {}, // 地图线选项
  },
  mapLabel: {
    show: false, // 是否显示地图标签
    opts: {}, // 地图标签选项
  },
  flowLine: {
    show: false, // 是否显示流水线
    filter: 'max', // all: 所有线; max: 最大线; min: 最小线; number: 第几条线; Array<number>: 多条线
    opts: {}, // 流水线选项
  },
  eventList: [], // 事件监听
}

export class Map2D {
  constructor({ scene, interactionManager = null, tickClock = null }, opts = {}) {
    this.scene = scene
    this.interactionManager = interactionManager
    this.tickClock = tickClock
    this.opts = merge({}, MAP2D_DEFAULT_OPTS, opts)
    this.init()

    return {
      instance: this.group,
      labelGroup: this.labelGroup ?? null,
      lineGroup: this.lineGroup ?? null,
      flowLineGroup: this.flowLineGroup ?? null,
    }
  }
  init() {
    const { projection, position, renderOrder, mapLabel, mapLine, flowLine, autoAddToScene } =
      this.opts
    this.projection = getMercatorProjection(projection)
    this.group = new Group()
    this.group.name = `${NAME}-Group`
    this.group.renderOrder = renderOrder
    this.group.position.copy(getV3Position(position))

    if (mapLabel.show) {
      this.labelGroup = new Group()
      this.labelGroup.name = `${NAME}-LabelGroup`
      this.labelGroup.renderOrder = renderOrder // 要保证label不被遮挡
      this.group.add(this.labelGroup)
    }
    if (mapLine.show) {
      this.lineGroup = new Group()
      this.lineGroup.name = `${NAME}-LineGroup`
      this.group.add(this.lineGroup)
    }
    this.createGroundMap()
    if (flowLine.show) {
      this.flowLineGroup = this.createFlowLineGroup()
      this.flowLineGroup.instance.name = `${NAME}-FlowLineGroup`
      this.flowLineGroup.instance.renderOrder = renderOrder // 要保证flowLine不被遮挡
      this.group.add(this.flowLineGroup.instance)
    }
    if (autoAddToScene) this.scene.add(this.group)
  }
  createGroundMap() {
    const { data, mergeAll, material, highLight, highLightMaterial, eventList, mapLine, mapLabel } =
      this.opts
    if (!data) return console.warn('data is null, create ground map failed')
    const geometries = []
    data?.features?.forEach((feature) => {
      const object3D = new Object3D()
      const { geometry, properties } = feature
      const { type, coordinates } = geometry ?? {}

      coordinates?.forEach((multiPolygon) => {
        if (type === 'Polygon') multiPolygon = [multiPolygon]

        multiPolygon?.forEach((polygon) => {
          const shape = new Shape()
          const lineCoordinates = []

          for (let i = 0; i < polygon.length; i++) {
            const [lng, lat] = polygon[i]
            if (Number.isNaN(lng) || Number.isNaN(lat)) return
            const [x, y] = this.projection(polygon[i])
            if (i === 0) shape.moveTo(x, -y)
            shape.lineTo(x, -y)
            lineCoordinates.push([x, -y])
          }

          const geometry = new ShapeGeometry(shape)
          // 如果是合并所有区域，不拥有交互功能
          if (mergeAll) {
            geometries.push(geometry)
          } else {
            const mesh = new Mesh(geometry, material)
            mesh.userData = Object.assign({}, properties)
            object3D.add(mesh)
            // 地图交互
            if (this.interactionManager) {
              this.interactionManager.add(mesh)
              let unbindAll = bindEvents(eventList.map((v) => ({ target: mesh, ...v, opts: true })))
              let unbindMouseOut = null,
                unbindMouseOver = null
              if (highLight) {
                unbindMouseOver = bindEvents(mesh, 'mouseover', (e) => {
                  changeMeshMaterial(e.target.parent, highLightMaterial)
                })
                unbindMouseOut = bindEvents(mesh, 'mouseout', (e) => {
                  changeMeshMaterial(e.target.parent, material)
                })
              }
              // 手动加cleanup方法，去销毁几何体的一些非常规对象（比如解绑事件）
              mesh.userData.cleanup = () => {
                unbindAll()
                unbindMouseOver?.()
                unbindMouseOut?.()
                unbindAll = null
                unbindMouseOver = null
                unbindMouseOut = null
              }
            }
          }
          // 地图线
          if (this.lineGroup) {
            const line = new MapLine(
              {
                projection: this.projection,
                coordinates: lineCoordinates.map((v) => [...v, 0.01]),
              },
              mapLine.opts,
            )
            this.lineGroup.add(line)
          }
        })
      })
      // 地图标签
      if (this.labelGroup) {
        const center = getFeatureCenter(feature)
        const [x, y] = this.projection(center)
        const label = new MapLabel(
          {
            name: properties?.name ?? '',
            position: [x, -y, 0.2],
          },
          mapLabel.opts,
        )
        this.labelGroup.add(label)
      }
      if (!mergeAll) this.group.add(object3D)
    })
    if (mergeAll) {
      const geometry = mergeGeometries(geometries)
      const mesh = new Mesh(geometry, material)
      this.group.add(mesh)
    }
  }
  createFlowLineGroup() {
    const { flowLine, projection, data } = this.opts
    const { filter, opts } = flowLine
    return new FlowLineGroup(
      { tickClock: this.tickClock },
      { projection, data, filter, flowLineOpts: opts },
    )
  }
}
