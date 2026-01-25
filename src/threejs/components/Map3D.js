import { Vector3, Group, MeshBasicMaterial, Shape, ExtrudeGeometry, Mesh, Object3D } from 'three'
import merge from 'lodash-es/merge'
import { createSideLayerMaterial } from '../utils/index.js'
import { MapLine, MapLabel } from './index.js'
import { bindEvents, getFeatureCenter, getMercatorProjection } from '../libs/index'

const NAME = 'Map3D'

const MAPD_DEFAULT_OPTS = {
  position: new Vector3(0, 0, 0), // 地图3D位置
  projection: {
    center: [0, 0], // 地图中心坐标
    scale: 100, // 地图缩放比例
    translate: [0, 0], // 地图平移坐标
  },
  renderOrder: 1, // 地图渲染顺序
  // 地图表面材质
  surfaceMaterial: new MeshBasicMaterial({
    color: 0xff0000, // 地图表面颜色
    transparent: true, // 是否透明
    opacity: 1, // 透明度
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
    depth: 0.25, // 地图拉伸深度
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
  eventList: [], // 事件监听
}

export class Map3D {
  constructor({ scene, interactionManager = null }, opts = {}) {
    this.scene = scene
    this.interactionManager = interactionManager
    this.opts = merge({}, MAPD_DEFAULT_OPTS, opts)
    if (!this.opts.sideMaterial)
      this.opts.sideMaterial = createSideLayerMaterial({ depth: this.opts.extrudeOpts.depth })

    this.init()
    return {
      instance: this.group,
      labelGroup: this.labelGroup,
      lineGroup: this.lineGroup,
    }
  }
  init() {
    const { projection, position, renderOrder } = this.opts
    this.projection = getMercatorProjection(projection)
    this.group = new Group()
    this.group.name = `${NAME}-Group`
    this.group.renderOrder = renderOrder
    this.group.position.copy(position)

    this.labelGroup = new Group()
    this.labelGroup.name = `${NAME}-LabelGroup`
    this.labelGroup.renderOrder = renderOrder // 要保证label不被遮挡

    this.lineGroup = new Group()
    this.lineGroup.name = `${NAME}-LineGroup`

    this.group.add(this.labelGroup, this.lineGroup)
    this.createGroundMap()
  }
  createGroundMap() {
    const { data, surfaceMaterial, sideMaterial, extrudeOpts, mapLine, mapLabel , highLight } = this.opts
    if (!data) {
      console.warn('data is null, create ground map failed')
      return
    }
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
            let unbindAll = bindEvents(
              this.opts.eventList.map((v) => ({ target: mesh, ...v, opts: true })),
            )
            let unbindMouseOut = null, unbindMouseOver = null
            if (highLight) {
              unbindMouseOver = bindEvents(
                mesh, 'mouseover', (e) => {
                  this.changeMeshMaterial(e.target.parent, this.opts.highLightMaterial)
                },
              )
              unbindMouseOut = bindEvents(
                mesh, 'mouseout', (e) => {
                  this.changeMeshMaterial(e.target.parent, surfaceMaterial)
                },
              )
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
          if (mapLine.show) {
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
      if (mapLabel.show) {
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
    if (this.opts.autoAddToScene) this.scene?.add(this.group)
  }
  /**
   * 改变网格材质
   * @param {*} group 组
   * @param {Material} material 网格材质  
   */
  changeMeshMaterial(group, material) {
    if (!group || !material) return
    group?.traverse((child) => {
      if (child.isMesh) child.material = material
    })
  }
}
