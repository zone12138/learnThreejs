const geoCache = new Map()

/**
 * 动态加载 GeoJSON 数据（public/geo 目录，带缓存）。
 * 数据不进 bundle，仅在对应路由挂载时按需 fetch。
 * @param {string} name 数据文件名（不含 .json 扩展名），如 'guangdong'
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export function loadGeoJson(name) {
  if (geoCache.has(name)) return geoCache.get(name)
  const promise = fetch(`${import.meta.env.BASE_URL}geo/${name}.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`加载 GeoJSON 失败: ${name} (HTTP ${res.status})`)
      return res.json()
    })
    .catch((err) => {
      // 失败不缓存，允许重试
      geoCache.delete(name)
      throw err
    })
  geoCache.set(name, promise)
  return promise
}
