# three-vite · Three.js 学习项目

基于 Vue 3 + Vite + Three.js 的 3D 地图可视化学习/演示项目。

## 项目结构

```
src/
├── threejs/               # Three.js 核心库（与视图框架解耦，可独立复用）
│   ├── core/              # BasicThreejs 场景管理基座（scene/camera/renderer/controls/渲染循环/统一销毁）
│   ├── components/        # 可视化组件（Map3D/Map2D/Grid/FlowLine/FlyLine/FlyLineFlow/MapLabel/...）
│   ├── libs/              # 基础设施（EventEmitter/事件绑定/Geo 投影与 turf 封装/raf 工具）
│   ├── utils/             # 材质/坐标/尺寸/时钟/geoShape/相机取景拟合 等工具
│   ├── config/geo.js      # 各区域投影参数（center/scale）集中配置
│   └── types/             # 组件与配置项的 .d.ts 类型声明
├── hooks/                 # Vue 适配层
│   ├── useThree.js        # BasicThreejs 的生命周期适配（唯一场景管理入口）
│   ├── 3DMap.js           # use3DMap：在 useThree 之上构建 3D 挤出地图（光照/投影/地面）
│   └── GUI.js             # lil-gui 调试面板
├── views/
│   ├── maps/              # 真实地理数据页面（省/市地图、飞线下钻）
│   └── demos/             # 组件能力演示（网格、平面地图、基础场景、热力图）
├── utils/geoLoader.js     # GeoJSON 按需加载（public/geo + fetch 缓存）
├── router/                # 路由（含旧路径重定向与 404 兜底）
└── styles/index.css       # 全局样式唯一入口（含 demo 页面共享布局类）
public/geo/                # GeoJSON 数据（不进 bundle，路由级按需 fetch）
tests/                     # node:test 单测（纯函数：geoShape / 投影筛选）
```

## 核心约定

### 场景管理只有一条链路

所有视图通过 `BasicThreejs`（直接 `new` 或经 `useThree` / `use3DMap` hook）创建场景。
**不要**在视图里手写 renderer / 渲染循环 / resize / OrbitControls —— 这些都由基座负责：

```js
// 视图内直接使用
import { BasicThreejs } from '@/threejs/core'
const map = new BasicThreejs(canvas, { cameraOpts, rendererOpts, controlsOpts })

// 或经 hook（自动绑定 Vue 生命周期）
import { useThree } from '@/hooks/useThree'
const three = useThree(canvasRef, opts) // onMounted 创建、onUnmounted 自动销毁
```

### 组件契约

组件第一个参数统一传 **BasicThreejs 实例**，第二参数是配置对象：

```js
const map3D = new Map3D(map, { projection: PROJECTION.guangdong, data })
map3D.instance     // 主 Group
map3D.lineGroup    // 边线组
map3D.labelGroup   // 标签组
```

- 配置默认值一律走「工厂函数」（每次生成新 Material/Vector3），避免跨实例共享污染。
- `destroy()` 幂等，可安全重复调用；遍历会释放 Mesh/Line/Sprite/Points 的 geometry 与 material。

### GeoJSON → 几何体

`threejs/utils/geoShape.js` 是唯一的转换入口（`forEachRing` / `projectRing` / `createShape` /
`createRingGeometry`）。它统一处理了 Polygon / MultiPolygon 的展平、y 轴取负、无效点丢弃、
退化几何体的包围体兜底。新增地图视图时请复用它，不要另写一份环遍历。

### 页面布局

三维页面都是「铺满的舞台 + canvas」，样式用 `styles/index.css` 里的共享类，
不要在视图里重复写 scoped CSS：

```html
<div class="demo-stage demo-stage--viewport">
  <canvas ref="mapCanvas"></canvas>
  <button class="demo-reset-btn" @click="cleanup">cleanup</button>
</div>
```

### 数据加载

GeoJSON 放 `public/geo/`（guangdong / guangdong-districts / guangzhou / china-districts / china-provinces），
通过 `loadGeoJson(name)` 按需 fetch（带缓存），不进 bundle：

```js
const data = await loadGeoJson('guangdong')
```

## 层级下钻（`views/maps/FlyLineMap.vue`）

省 → 市 → 区县三级，靠**层级栈**而不是「相机飞过去」：

```js
stack = [{ adcode: 440000, name: '广东省', depth: 0, regions: [...] },
         { adcode: 440100, name: '广州市', depth: 1, regions: [...] }]
```

- **触发条件**：`canDrill(feature)` = 当前只在省域层（`stack.length === 1`）且
  `properties.childrenNum > 0`。东莞/中山这类「直筒子市」`childrenNum` 为 0，点击给出
  「暂无下级区划数据」提示而不是静默失败。
- **子级解析**：`resolveRegions(node)` 用 `loadGeoJson('guangdong-districts')` 后按
  `properties.parent.adcode === node.adcode` 过滤，节点自带 `regions`，回跳不重新请求。
- **坐标一致**：投影范围只按省域边界算一次（`bounds`），所有层级复用同一 `project()`，
  所以子级几何体落在父级原位，下钻只推相机、不重建坐标系。
- **返回**：面包屑（点任意一级）、`返回上级` 按钮、`Esc` 三个入口，都走 `goToDepth(index)`
  → `stack = stack.slice(0, index + 1)`。

## 相机取景（`threejs/utils/cameraFit.js`）

`fitCameraToBox(box, { fov, aspect })` 用**数值拟合**而不是 `半宽 / tan(fov/2)`（那是正交算法，
透视下必然裁切）：先把包围盒 8 个角点投影到 NDC，对距离二分 26 次直到最大 extent ≤ 0.9，
再对 `target.z` 二分 24 次把画面竖直居中，两者交替 3 轮。返回 `{ position, target, distance }`。

下钻 5~8 倍缩放、宽画幅/竖屏都保证「完整可见 + 不过度留白」，由 `tests/cameraFit.test.js` 锁定。

## 飞线渲染（`threejs/components/FlyLineFlow.js`）

```js
const flow = new FlyLineFlow({ scene })
flow.setNodes([{ position: new Vector3(...) }], { extent, fadeIn: true })
flow.update(delta, elapsed)   // 挂 tickClock.onTick
flow.dispose()
```

- 几何体用 `TubeGeometry`（`uv.x` 沿弧长均匀，与 `curve.getPointAt(t)` 参数一致），
  着色器一次给出三层：常亮底光 + 指数拖尾 + 高斯彗星头，用 `CustomBlending` 纯加色。
- 光点位置用**弧长参数**推进，保证不脱离光带；回卷时两端淡出，避免瞬移。
- 管径 / 头部尺寸 / 抬升高度全部按 `extent` 等比缩放，下钻后不会变成粗管子或尖刺。
- 各线起点在枢纽周围按 `extent * 0.014` 环形错开，避免叠成一团白光。

## 组件返回值速查

- FlowLine / FlowLineGroup / Grid / MapLabel / MapLine / Plane / ReflectTexture：three 原生对象（Mesh/Group/Sprite/LineSegments），动画更新挂在 `userData.update`
- Map3D / Map2D：组件实例，经 `.instance` / `.lineGroup` / `.labelGroup` / `.flowLineGroup` 访问内部对象

## 已知补丁

`heatmap.js` 通过 patch-package 打补丁（`patches/heatmap.js.patch`）：修复
`img.data = imgData` 在部分浏览器对只读 typed array 赋值失效的问题，改为 `img.data.set(imgData)` 兜底。

> pnpm 10 默认不执行依赖的 postinstall，重装依赖后若热力图异常，手动执行 `npx patch-package`。

## 开发

```sh
pnpm install
pnpm dev      # http://localhost:5173
pnpm build
pnpm lint     # ESLint（no-unused-vars 等为 error）
pnpm test     # node:test，纯函数单测
pnpm format   # prettier
```

## 路由一览

| 路径 | 说明 |
|------|------|
| /home | Grid + Plane + Map3D（广东）+ Map2D（中国省级底图） |
| /guangdong | 广东 3D 地图 + 中国底图 + 区域高亮 + 飞线 |
| /guangzhou | 广州地图 + 地面底图 |
| /guangzhou-hook | use3DMap hook 用法演示 |
| /flyline | 三级下钻飞线图（省 21 市 → 124 区县，面包屑/Esc 返回，着色器飞线） |
| /grid-map | 基础 3D 地图 + gsap 入场动画 |
| /flat-map | Map2D + FlyLine + ReflectTexture + Heatmap3D |
| /basic-scene | 相机与 AxesHelper 基础演示 |
| /camera-gui | lil-gui 调试面板 + 相机控制 |
| /heatmap | 纯 DOM 热力图（heatmap.js） |

旧路径（`/map1` `/map2` `/map3` `/demo4` `/demo4-heatmap` `/guangdong-map` `/guangzhou-map`
`/guangzhou-map-by-hooks`）保留重定向，不会 404。
