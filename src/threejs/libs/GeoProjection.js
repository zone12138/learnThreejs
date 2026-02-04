import { Vector2 } from 'three'
import { geoMercator } from 'd3-geo'
import {
  union,
  featureCollection,
  centroid,
  centerOfMass,
  pointOnFeature,
  flatten,
} from '@turf/turf'

/** @type {import('../types/Variable').GeoProjectionOpts} */
const PROJECTION_DEFAULT_CENTER = {
  center: [0, 0],
  scale: 1,
  translate: [0, 0],
}

/**
 * 获取Mercator投影
 * @param {import('../types/Variable').GeoProjectionOpts} projection 投影参数
 * @returns Mercator投影
 */
export const getMercatorProjection = (projection = {}) => {
  const {
    center = PROJECTION_DEFAULT_CENTER.center,
    scale = PROJECTION_DEFAULT_CENTER.scale,
    translate = PROJECTION_DEFAULT_CENTER.translate,
  } = projection
  return geoMercator().center(center).scale(scale).translate(translate)
}

/**
 * 获取特征中心坐标 (也可以使用turf)
 * @param {*} feature
 * @param {Object} opts 配置项
 * @param {string} opts.type 模式: 'centroid'(质心), 'center'(重心), 'pointOnFeature'(确保在内部)
 * @returns 特征中心坐标
 */
export const getFeatureCenter = (feature = {}, opts = { type: 'centroid' }) => {
  const { properties, property } = feature
  const attrCenter =
    properties?.centroid ?? properties?.center ?? property?.centroid ?? property?.center
  if (Array.isArray(attrCenter)) return attrCenter
  const defaultCenter = [0, 0]
  try {
    switch (opts.type) {
      case 'centroid':
        return centroid(feature).geometry.coordinates
      case 'centerOfMass':
        return centerOfMass(feature).geometry.coordinates
      case 'pointOnFeature':
        return pointOnFeature(feature).geometry.coordinates
      default:
        return defaultCenter
    }
  } catch (error) {
    console.warn('获取特征中心坐标失败', error)
    return defaultCenter
  }
}

/**
 * 获取geoJson数据的轮廓
 * @param {*} geoJson geoJson数据
 * @param {Object} opts 配置项
 * @param {string} opts.type 模式: 'geojson'(geoJson格式), 'feature'(特征对象)
 * @returns 轮廓[默认拼装成geoJson格式, 保证格式统一]
 */
export const getUnion = (geoJson, opts = { type: 'geojson' }) => {
  if (!geoJson || geoJson?.features?.length === 0) return null
  const mergeOutline = geoJson.features.reduce((prev, cur) => {
    if (!prev) return cur
    return union(featureCollection([prev, cur]))
  }, null)
  if (opts.type === 'geojson') return { type: 'FeatureCollection', features: [mergeOutline] }
  return mergeOutline
}

/**
 * 获取特征坐标
 * @param {*} geoJson geoJson数据
 * @param {Object} opts 配置项
 * @param {import('../types').FlowLineGroupOpts['filter']} opts.filter 筛选模式: 'all'(所有线); 'max'(最大线); 'min'(最小线); number(第几条线); Array<number>(多条线)
 */
export const getFeatureCoordinates = (geoJson, opts = { filter: 'all' }) => {
  const outline = getUnion(geoJson, { type: 'feature' })
  if (!outline) return []
  const flattenOutline = flatten(outline)
  if (!flattenOutline) return []
  const { features = [] } = flattenOutline ?? {}
  const { filter } = opts
  let polygons = []
  for (let i = 0; i < features.length; i++) {
    const feature = features[i]
    const { geometry = {} } = feature ?? {}
    const { coordinates = [] } = geometry
    if (filter === i) {
      polygons = [coordinates[0]]
      break
    } else if (Array.isArray(filter)) {
      for (let j = 0; j < filter.length; j++) {
        if (filter[j] === i) {
          polygons.push(coordinates[0])
        }
        if (j === filter.length - 1) {
          break
        }
      }
    } else if (filter === 'all') {
      polygons.push(coordinates[0])
    } else if (filter === 'max') {
      if (coordinates[0].length > (polygons[0]?.length ?? 0)) {
        polygons = [coordinates[0]]
      }
    } else if (filter === 'min') {
      if ((coordinates[0].length < polygons[0]?.length ?? 0) || polygons.length === 0) {
        polygons = [coordinates[0]]
      }
    }
  }
  return polygons
}
