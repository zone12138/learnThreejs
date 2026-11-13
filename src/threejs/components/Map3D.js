import { Vector3, Group, MeshBasicMaterial, Shape, ExtrudeGeometry, Mesh, Object3D } from 'three'
import merge from 'lodash-es/merge'
import { createSideLayerMaterial, changeMeshMaterial, getV3Position } from '../utils/index.js'
import { MapLine } from './MapLine.js'
import { MapLabel } from './MapLabel.js'
import { FlowLineGroup } from './FlowLineGroup.js'
import { bindEvents, getFeatureCenter, getMercatorProjection } from '../libs/index'

const NAME = 'Map3D' // 地图3D组件名称

/**
 * 默认配置工厂：材质等实例每次新生成，
 * 避免模块级共享材质被多个 Map3D 实例共用后互相污染颜色/透明度。
 * @returns {import('../types').Map3DOpts}
 */
const createMap3DDefaultOpts = () => ({
  position: new Vector3(0, 0, 0), // 地图3D位置
  projection: {
    center: [0, 0], // 地图中心坐标
    scale: 100, // 地图缩放比例
    translate: [0, 0], // 地图平移坐标
  },
  renderOrder: 1, // 地图渲染顺序
  // 地图表面材质
  surfaceMaterial: new MeshBasicMaterial({
    color: 0x48afff, // 地图表面颜色
    transparent: true, // 是否透明
    opacity: 0.5, // 透明度
  }),
  // 地图边框材质
  sideMaterial: null,
  highLight: true, // 是否使用默认高亮材质和事件
  // 地图高亮材质
  highLightMaterial: new MeshBasicMaterial({
    color: 0xffffff, // 地图高亮颜色
    transparent: true, // 是否透明
    opacity: 0.5, // 透明度
  }),
  // 地图拉伸选项(拉伸几何体)
  extrudeOpts: {
    depth: 0.4, // 地图拉伸深度
    bevelEnabled: true, // 是否开启边框
    bevelSegments: 1, // 地图拉伸分段数
    bevelThickness: 0.1, // 地图拉伸厚度
  },
  data: null, // 地图数据
  autoAddToScene: true, // 是否自动添加到场景
  mapLine: {
    show: true, // 是否显示地图线
    opts: {}, // 地图线选项
  },
  mapLabel: {
    show: true, // 是否显示地图标签
    opts: {}, // 地图标签选项
  },
  flowLine: {
    show: true, // 是否显示流动线
    filter: 'max', // all: 所有线; max: 最大线; min: 最小线; number: 第几条线; Array<number>: 多条线
    opts: {}, // 流动线选项
  },
  eventList: [], // 事件监听
})

/**
 * 地图3D组件
 * 构造后通过 `.instance`(主Group) / `.lineGroup` / `.labelGroup` / `.flowLineGroup` 访问内部对象。
 */
export class Map3D {
  /**
   * @param {Object} basic - BasicThreejs 实例（依赖其 scene / interactionManager / tickClock）
   * @param {import('../types').Map3DOpts} opts 配置项
   */
  constructor(basic, opts = {}) {
    this.scene = basic?.scene
    this.interactionManager = basic?.interactionManager ?? null
    this.tickClock = basic?.tickClock ?? null
    this.opts = merge({}, createMap3DDefaultOpts(), opts)
    if (!this.opts.sideMaterial)
      this.opts.sideMaterial = createSideLayerMaterial({ depth: this.opts.extrudeOpts.depth })

    this.init()
  }

  /** 主 Group（历史调用方通过 .instance 访问） */
  get instance() {
    return this.group
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
      this.flowLineGroup.name = `${NAME}-FlowLineGroup`
      this.flowLineGroup.renderOrder = renderOrder // 要保证flowLine不被遮挡
      this.group.add(this.flowLineGroup)
    }
    if (autoAddToScene) this.scene?.add(this.group)
  }
  createGroundMap() {
    const {
      data,
      surfaceMaterial,
      sideMaterial,
      extrudeOpts,
      mapLine,
      mapLabel,
      eventList,
      highLight,
      highLightMaterial,
    } = this.opts
    if (!data) return console.warn('data is null, create ground map failed')

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
          const geometry = new ExtrudeGeometry(shape, extrudeOpts)
          geometry.computeBoundingBox()
          geometry.computeBoundingSphere()
          const mesh = new Mesh(geometry, [surfaceMaterial, sideMaterial])
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
                changeMeshMaterial(e.target.parent, highLightMaterial, { index: 0 })
              })
              unbindMouseOut = bindEvents(mesh, 'mouseout', (e) => {
                changeMeshMaterial(e.target.parent, surfaceMaterial, { index: 0 })
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
          // 地图线
          if (this.lineGroup) {
            const line = new MapLine(
              {
                projection: this.projection,
                coordinates: lineCoordinates.map((v) => [...v, extrudeOpts.depth + 0.1]),
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
            position: [x, -y, extrudeOpts.depth + 0.3],
          },
          mapLabel.opts,
        )
        this.labelGroup.add(label)
      }
      this.group.add(object3D)
    })
  }
  createFlowLineGroup() {
    const { flowLine, projection, data, extrudeOpts } = this.opts
    const { filter, opts } = flowLine
    return new FlowLineGroup(
      { tickClock: this.tickClock },
      { projection, data, filter, depth: extrudeOpts.depth + 0.14, flowLineOpts: opts },
    )
  }
}
