/**
 * 各区域投影参数（墨卡托 center/scale）统一配置。
 * 此前各视图重复硬编码 center/scale，改数据或调比例时容易漏改，故集中管理。
 */
export const PROJECTION = {
  /** 广东全省（市级数据，21 市） */
  guangdong: { center: [113.280637, 23.125178], scale: 85, translate: [0, 0] },
  /** 广东全省（市级数据，Map2D 大比例） */
  guangdongLarge: { center: [113.280637, 23.125178], scale: 150, translate: [0, 0] },
  /** 广东全省（区级数据，细粒度） */
  guangdongDistricts: { center: [113.280637, 23.125178], scale: 85, translate: [0, 0] },
  /** 广州（区级数据） */
  guangzhou: { center: [113.324521, 23.139056], scale: 1000, translate: [0, 0] },
  /** 广州为中心的广域视角（广东区级底图 + 中国底图） */
  guangdongWide: { center: [113.2, 23.3], scale: 1000, translate: [0, 0] },
}
