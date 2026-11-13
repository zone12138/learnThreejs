# 项目全面优化审查清单

> 审查范围：全仓库（Vue 3 + Vite + Three.js 学习项目）
> 审查维度：架构设计 / 模块划分 / 代码组织 / 目录结构 / 依赖关系 / 可维护性 / 可扩展性
> 使用方式：按优先级逐项实施，每项均标注涉及文件与改动理由。「必须修改」为正确性或资源安全问题；「建议优化」为工程质量提升。

> **实施状态（2026-11-12）**：P0 全部 8 项、P1 全部 8 项、P2 中 10 项已完成（详见文末「五、实施记录」）。
> 未实施：#17 视图重命名、#22 类型补齐/checkJs、#23 ESLint 与测试、#25 DemoShell、GeoJSON 几何简化（仅完成去重与 bundle 外置）。
> 构建验证：因本机系统策略（Application Control）拦截 rolldown 原生二进制，采用隔离目录 + 标准 vite@7.3.0 完成构建验证（全路由编译通过）；在本机正常环境下请直接 `pnpm install && pnpm build`。

---

## 一、总体结论

项目同时存在 **三套平行的 Three.js 场景管理实现**，职责高度重叠：

| 链路 | 位置 | 使用视图 |
|------|------|----------|
| A. 类组件体系 | `src/threejs/core`（`BasicThreejs`）+ `src/threejs/components` | Map1 / Map2 / Map3 / HomeView |
| B. 函数式 Hook | `src/hooks/3DMap.js`（`use3DMap`，自带 renderer/scene/animate） | GuangzhouMapByHooks |
| C. 视图内裸写 | 视图 SFC 内手写 initScene/camera/renderer/animate | GuangdongMap / GuangzhouMap / FlyLine / Demo4Camera / Demo4Heatmap |

渲染器初始化、resize 处理、渲染循环、OrbitControls、资源清理这五件事在三条链路里各写了一份。这是本次审查最核心的架构问题，其余多数问题（共享可变默认值、destroy 不可重入、返回值语义混乱）都由此衍生。

---

## 二、逐项问题分析

### A. 架构设计

**A1. 三套并行实现（根本问题）**
- 证据：`src/threejs/core/index.js`、`src/hooks/3DMap.js:82-135`（initScene 与 `GuangdongMap.vue:79-120` 逐行雷同）。
- 理由：同一职责三份实现意味着修 bug 要修三处、加功能要加三处；`GuangdongMap.vue` 因此膨胀到 1015 行。统一到 `BasicThreejs` 一条主链路，hook 层只做 Vue 生命周期适配（`useThree(container, opts)` 包装 BasicThreejs），视图不再直接触碰 renderer/camera。

**A2. 组件契约隐式化**
- 证据：`Map3D.js:57` 构造签名是 `{ scene, interactionManager, tickClock }`，但调用方 `Map1.vue:65` 传的是整个 `BasicThreejs` 实例 `map`；组件内部实际读取 `this.sizes`、`this.renderer` 等签名未声明的属性。
- 理由：契约与实际不符，靠鸭子类型侥幸工作；新增组件作者无法从签名推断可用能力，`types/Core.d.ts` 也无法准确描述。应显式声明「接收 BasicThreejs 实例」。

**A3. 构造函数返回工厂对象，破坏 class 语义**
- 证据：`Map3D.js:66-70`、`Map2D.js` 同样 —— `constructor` 里 `return { instance, labelGroup, lineGroup }`，`new Map3D()` 的返回值不是 Map3D 实例。
- 理由：无法 `instanceof`、无法调用实例方法、无法继承；`REMEAD.md` 把它记录为「约定」恰说明这是反模式。应返回 `this`，通过 `map3D.instance / .lineGroup / .labelGroup` 访问。

**A4. 模块级共享可变默认值（正确性 bug）**
- 证据：`Map3D.js:17-30` 的 `MAP3D_DEFAULT_OPTS` 中 `new MeshBasicMaterial(...)`；`Camera.js:6-13` 的 `position: new Vector3(0,0,5)`。`lodash merge` 对类实例按引用赋值 → 所有 Map3D 实例**共享同一份 surfaceMaterial / highLightMaterial**，所有 Camera 共享同一 Vector3；若调用方传 `{position:{x:1}}`，merge 会把 x 深合并进这份共享默认值，污染后续所有实例。
- 理由：跨实例状态污染是最难排查的一类 bug。默认值中含实例的，应改为「默认值工厂」（函数每次生成新实例）或 merge 前深拷贝。

**A5. use3DMap 的模块级污染与失效返回值**
- 证据：`hooks/3DMap.js:68` `Object.assign(MAP_CONFIG, mapConfig)` 原地改写**模块级常量**（多实例互相覆盖且不可恢复）；`3DMap.js:350-358` 返回的 `scene/camera/...` 在函数执行时（onMounted 之前）求值，全是 null——`GuangzhouMapByHooks.vue:22-28` 解构拿到的就是 null。
- 理由：hook 的基本契约是可复用、返回值可用。应把配置 merge 到函数局部对象，返回值改为 getter 或 shallowRef。

**A6. 生命周期与资源管理漏洞**
- `BasicThreejs.destroy()` 不可重入：`Map1.vue` 中 cleanup 按钮与 `onUnmounted` 都会调用；第二次调用时 `this.renderer` 已为 null → TypeError；`core/index.js:64` `this.canvas.parentNode.removeChild` 在 canvas 已移除时抛错。
- 清理遗漏：`core/index.js:46-63` traverse 只处理 `instanceof Mesh`，`MapLine`（LineSegments）、`MapLabel`（Sprite）的 geometry/material 不会被释放 → 内存泄漏。
- gsap 未回收：`Map1.vue:118-144`、`HomeView.vue:126-152` 的 timeline 在 destroy 后仍持续 onUpdate 更新已销毁的 camera/controls。
- 事件解绑依赖 `mesh.userData.cleanup` 约定（`Map3D.js:154`），任何绕过 `destroy()` 的移除路径都会泄漏。
- `TickClock.destroy()` / `Size.destroy()` 用 `off('tick')` 无参形式移除**全部**监听（`TickClock.js:20`、`Size.js:27`），多订阅方时互相误伤。

**A7. resize 监听方式过时**
- 证据：`utils/Size.js:8-10` 监听 window resize + 读 `offsetWidth`。
- 理由：容器尺寸变化（分栏、面板折叠）不触发 window resize；应改用 `ResizeObserver` 监听容器。

### B. 模块划分与代码组织

**B1. 视图命名无语义且同名异类**
- `Map1/Map2/Map3`、`Demo4Camera/Demo4Heatmap`（demo4 指代不明）；`views/FlyLine.vue` 与 `threejs/components/FlyLine.js` 同名但一个是视图一个是组件。
- 建议：`src/views/demos/` 下按能力命名（如 `Map3DBasic.vue`、`CameraAnimation.vue`、`FlyLineDemo.vue`）。

**B2. 脚手架残留（全部未被路由/业务引用）**
- `components/HelloWorld.vue`、`TheWelcome.vue`、`WelcomeItem.vue`、`components/icons/*`（5 个）。
- `views/AboutView.vue`（路由表已无 /about）。
- `stores/counter.js`（全仓库零引用，但 pinia 已挂载——学习项目若无状态管理需求可一并移除）。
- `assets/base.css`、`assets/logo.svg`。

**B3. 死代码与半成品**
- `hooks/1.js`：**空文件**，直接删。
- `FlowPoint.js`、`Heatmap.js`：未在 `components/index.js` 导出、无任何视图使用。
- `FlowLine_1px.js`：导出被注释（`index.js:1`）。
- `Grid_Old.js` 与 `Grid.js` 并存，`HomeView.vue:26` 还在引用旧版 `Grid_O`——应统一到 `Grid` 并删除旧版。
- `components/REMEAD.md`：文件名拼写错误（应为 README），且散落在组件目录中。

**B4. 路由死代码与缺口**
- `router/index.js:16-35`：5 条整段注释掉的路由。
- 无 404 兜底路由；`App.vue` 导航直接渲染 `route.name`，把 redirect 路由 `/` 也渲染成一个链接。

**B5. GeoJSON 数据治理（22MB）**
- 同一份数据多格式并存：广东省 `.geojson`(8.7M) / `.js`(2.3M) / `.json`(0.3M)；中华人民共和国 `.js`(6.6M) / `.geojson`(3.9M) / `（省）.json`(0.5M)。其中两个 `.geojson` **无人引用**。
- `GuangdongMap.vue` 静态 import 6.6MB 的 `中华人民共和国.js` → 直接打进首屏 bundle。
- 建议：每份数据只保留一个（`.json`，放 `public/geo/`），用 `fetch` 动态加载 + 路由级按需；数据本身可用 mapshaper/topojson 做简化（省级地图精度通常可降一个数量级）。

**B6. 样式入口分散**
- `main.js:1-2` 同时引入 `assets/main.css` 与 `styles/index.css`，另有 `assets/base.css` 三套全局样式来源。

**B7. console 噪声**
- 全仓库 43 处 `console.*`，含 `3DMap.js:315-319` 的 `console.time/log`、`Map1.vue:113` 的 `console.log(map.scene)` 等调试遗留。

### C. 依赖关系

**C1. 未使用依赖**：`@tweenjs/tween.js` 全仓库零引用（动画实际用 gsap）→ 移除。
**C2. 重依赖全量引入**：`@turf/turf` 仅 `GeoProjection.js`、`Map2/Map3.vue` 使用 → 按需引入子包（如 `@turf/center`），或用已有 d3-geo 替代，可显著减小体积。
**C3. lodash-es 仅为 merge**：可手写合并函数（顺带规避 A4 的 merge 语义陷阱），或保留但在合并处显式 clone。
**C4. 构建不可复现**：`package.json:34` `"vite": "npm:rolldown-vite@latest"` 指向 latest → 锁定具体版本。
**C5. heatmap.js 依赖 patch-package 补丁维持**（`patches/heatmap.js.patch`）：可用但需在 README 记录原因，长期可考虑换库。
**C6. 质量工具缺位**：无 ESLint（仅 prettier）、无任何测试、build 无类型检查。

### D. 类型系统

- `types/` 只覆盖 8/14 个组件（缺 Map2D、MapLine、FlowPoint、Heatmap、Texture 及 libs/utils），`.d.ts` 实际只是 JSDoc 提示，无编译校验；`jsconfig.json` 未开 `checkJs`。
- 建议：渐进方案 `checkJs: true` + 补齐缺失类型；激进方案直接迁 TS（`vue-tsc`）。

### E. 可维护性 / 可扩展性

- **E1** `GuangdongMap.vue` 1015 行：场景、灯光、地图、飞线、raycaster 拾取全部内联，与 `hooks/3DMap.js` 90% 重复 → 拆分为组件库调用。
- **E2 潜在循环引用**：`Map3D.js:4` 从 `./index.js` 聚合入口导入兄弟组件（`index.js` 又导出 Map3D 自己）→ 改为直接文件导入 `./MapLine.js` 等。
- **E3 魔法数字重复**：投影 center/scale 在 4 个视图里各写一份（113.280637,23.125178 / 113.2,23.3 / 113.324521,23.139056）→ 提取 `threejs/config/geo.js`。
- **E4 Demo 无统一壳**：每个演示视图都复制「canvas + cleanup 按钮 + onMounted/onUnmounted」模板 → 抽一个 `DemoShell.vue`。
- **E5** `template4AI/`（3 个原型 html）位于仓库根参与构建排除 → 移至 `docs/`。
- **E6** README 仍是脚手架模板，未描述项目的分层结构、组件契约、数据加载约定。

---

## 三、优化清单（按优先级排列）

### P0 · 必须修改（正确性 / 资源安全）

| # | 改动 | 涉及文件 | 理由 |
|---|------|----------|------|
| 1 | 修复 `destroy()` 可重入：入口置 `_destroyed` 标记，二次调用直接 return；canvas 移除判空 | `src/threejs/core/index.js` | `Map1.vue` cleanup 按钮 + onUnmounted 双调必现 TypeError |
| 2 | traverse 清理补齐非 Mesh 对象（Line/Sprite/Points），material 数组显式处理 | `src/threejs/core/index.js:46-63` | MapLine/MapLabel 资源泄漏 |
| 3 | 默认值去共享化：`CAMERA_DEFAULT_OPTS` / `MAP3D_DEFAULT_OPTS` / `MAP2D` 等改为工厂函数（每次 `new Vector3` / `new MeshBasicMaterial`），merge 前 clone | `src/threejs/core/Camera.js`、`src/threejs/components/Map3D.js`、`Map2D.js` 等 | 跨实例材质/向量污染 |
| 4 | `use3DMap`：配置 merge 到局部对象（不污染模块级 `MAP_CONFIG`）；返回值改为 getter 或 onMounted 后可用的 shallowRef | `src/hooks/3DMap.js` | 当前返回值恒为 null，模块级常量被覆写 |
| 5 | gsap timeline 在 onUnmounted 中 `kill()`；`destroy()` 后停止动画 | `src/views/Map1.vue`、`HomeView.vue` | 动画继续驱动已销毁对象 |
| 6 | 移除未使用依赖 `@tweenjs/tween.js`；`vite` 从 `@latest` 改为锁定版本 | `package.json` | 减体积、构建可复现 |
| 7 | 删除死文件：`hooks/1.js`、`geoJson/广东省.geojson`、`geoJson/中华人民共和国.geojson`；决定 `FlowPoint.js`/`Heatmap.js` 去留（当前零引用） | `src/hooks/1.js`、`src/geoJson/`、`src/threejs/components/` | 22MB 中 12.6MB 是无引用重复数据 |
| 8 | `Renderer.js:12` 移除多余 `.bind(this)`（resize 已是箭头函数）；`EventEmitter.off` 支持指定回调的细粒度解绑 | `src/threejs/core/Renderer.js`、`libs/EventEmitter.js` | 正确性/防误伤 |

### P1 · 必须修改（架构统一，工程一致性）

| # | 改动 | 涉及文件 | 理由 |
|---|------|----------|------|
| 9 | 统一场景管理：`GuangdongMap.vue`、`GuangzhouMap.vue`、`FlyLine.vue`、`Demo4Camera.vue`、`Demo4Heatmap.vue` 的 initScene/renderer/animate 全部替换为 `BasicThreejs`；`use3DMap` 重写为 `useThree()` 薄适配层 | 上述 5 个视图 + `src/hooks/3DMap.js` + `src/threejs/core/` | 消除三套并行实现（A1，根因） |
| 10 | `Map3D` / `Map2D` 构造返回 `this`，去掉工厂对象；调用方改用 `.instance/.lineGroup/.labelGroup`；同步更新 `REMEAD.md` | `src/threejs/components/Map3D.js`、`Map2D.js`、所有引用视图 | class 语义（A3） |
| 11 | 组件契约显式化：构造参数改为接收 `BasicThreejs` 实例并在 JSDoc/types 中声明 | `src/threejs/components/*.js`、`src/threejs/types/Core.d.ts` | 契约与实际一致（A2） |
| 12 | GeoJSON 治理：每份数据保留单一 `.json`，移入 `public/geo/` 动态 fetch；数据做 simplification | `src/geoJson/` 全目录、引用它的 8 个视图 | bundle 体积（B5） |
| 13 | 删除脚手架残留：HelloWorld/TheWelcome/WelcomeItem/icons×5、AboutView、stores/counter（连带评估 pinia 去留）、base.css、logo.svg | `src/components/`、`src/views/AboutView.vue`、`src/stores/`、`src/assets/` | 死代码（B2） |
| 14 | 路由清理：删除 5 条注释路由；补 404 兜底；App 导航过滤 redirect 路由 | `src/router/index.js`、`src/App.vue` | B4 |
| 15 | `Grid_Old.js` 删除，`HomeView.vue` 切换到 `Grid`；`FlowLine_1px.js` 去留决定 | `src/threejs/components/`、`src/views/HomeView.vue` | B3 |
| 16 | `@turf/turf` 按需引入子包，或用 d3-geo 替代 turf 用法 | `src/threejs/libs/GeoProjection.js`、`src/views/Map2.vue`、`Map3.vue` | 依赖体积（C2） |

### P2 · 建议优化（可维护性 / 可扩展性）

| # | 改动 | 涉及文件 | 理由 |
|---|------|----------|------|
| 17 | 视图重命名 + 归入 `views/demos/`（语义化命名，消除 FlyLine 同名异类） | `src/views/` | B1 |
| 18 | 投影等公共配置提取为 `threejs/config/geo.js` | 4 个视图 + `Map3D/Map2D` | E3 |
| 19 | `Size` 改用 `ResizeObserver` 监听容器 | `src/threejs/utils/Size.js` | A7 |
| 20 | 全局样式三入口合并为 `styles/index.css` 单入口 | `src/main.js`、`src/assets/`、`src/styles/` | B6 |
| 21 | console 清理：移除调试输出，或封装 `logger` 按环境开关 | 43 处，重点 `hooks/3DMap.js`、`Map1.vue` | B7 |
| 22 | 补 `EventEmitter` off 细粒度解绑 + types/ 补齐缺失组件类型，`jsconfig` 开 `checkJs` | `src/threejs/libs/`、`src/threejs/types/`、`jsconfig.json` | D |
| 23 | 引入 ESLint（vue3 + js 推荐规则）、关键组件补最小单测（GeoProjection、destroy 流程） | 根目录配置 | C6 |
| 24 | 组件内互引改为直接文件导入，消除经 `index.js` 的潜在循环引用 | `src/threejs/components/Map3D.js` 等 | E2 |
| 25 | 抽 `DemoShell.vue` 统一演示视图模板 | `src/views/` | E4 |
| 26 | `template4AI/` 移至 `docs/`；重写 README（分层结构、组件契约、数据加载约定）；`REMEAD.md` 更名并入 | 根目录 | E5/E6 |
| 27 | heatmap.js patch 原因写入 README；评估替换 | `patches/` | C5 |

---

## 四、建议实施顺序

1. **第一批（半天）**：P0 全部 —— 纯正确性修复，不动架构，风险低。
2. **第二批（1-2 天）**：#10 → #11 → #9 —— 先改组件契约（小步），再做视图统一（大步），每迁移一个视图验证一次。
3. **第三批**：#12-#16 数据与依赖治理。
4. **第四批**：P2 按需穿插。

每完成一批建议跑 `pnpm dev` 逐路由验证（/home /map1 /map2 /map3 /demo4 /demo4-heatmap），重点确认：双击 cleanup 不报错、路由切换无 console 错误、内存无持续增长。

---

## 五、实施记录（2026-11-12）

### P0（全部完成）

| # | 状态 | 落点 |
|---|------|------|
| 1 | ✅ | `core/index.js`：`destroy()` 增加 `_destroyed` 幂等标记；canvas 移除判 `parentNode` |
| 2 | ✅ | `core/index.js`：traverse 清理覆盖 Mesh/Line/Sprite/Points，material 数组显式处理 |
| 3 | ✅ | `Camera.js`、`Map3D.js`、`Map2D.js`、`Grid.js`、`Plane.js`：默认值改为 `createXxxDefaultOpts()` 工厂，Material/Vector3 每次新生成 |
| 4 | ✅ | `hooks/3DMap.js` 重写：配置合并到局部对象；返回 `computed` 引用 + `initMap` 显式初始化 |
| 5 | ✅ | `Map1.vue`、`HomeView.vue`：gsap timeline 存为 `tl`，`onUnmounted` 中 `kill()` |
| 6 | ✅ | `package.json`：移除 `@tweenjs/tween.js`；`vite` 锁定为 `npm:rolldown-vite@7.3.0` |
| 7 | ✅ | 删除 `hooks/1.js`、`geoJson/`（含两个零引用 .geojson）、`FlowPoint.js`、`Heatmap.js`、`FlowLine_1px.js`、`Grid_Old.js` |
| 8 | ✅ | `Renderer.js` 移除冗余 `.bind(this)`；`EventEmitter.off` 原生已支持回调级解绑（无需改） |

### P1（全部完成）

| # | 状态 | 落点 |
|---|------|------|
| 9 | ✅ | 新增 `hooks/useThree.js`（唯一场景管理入口）；`GuangdongMap.vue` / `GuangzhouMap.vue` / `FlyLine.vue` 全部迁至 BasicThreejs；`use3DMap` 重写为 BasicThreejs 之上的薄层。注：Demo4Camera 本就用 BasicThreejs，Demo4Heatmap 是纯 DOM 热力图（无 Three.js），均无需迁移 |
| 10 | ✅ | `Map3D.js` / `Map2D.js` 构造返回 `this` + `instance` getter；调用方访问方式不变 |
| 11 | ✅ | 全部组件构造第一参数改为 BasicThreejs 实例并写入 JSDoc |
| 12 | ✅ | GeoJSON 迁至 `public/geo/`（22MB → 6MB，5 份去重数据）；新增 `utils/geoLoader.js`（fetch + 缓存）；8 个视图改为按需异步加载 |
| 13 | ✅ | 删除 HelloWorld 族 / icons×5 / AboutView / counter store / pinia / base.css / logo.svg |
| 14 | ✅ | 路由删注释死代码、补 404 兜底、恢复 4 条被注释路由；`App.vue` 导航过滤 redirect/404 |
| 15 | ✅ | `Grid_Old.js` 删除，`HomeView.vue` 切换到 `Grid`；`FlowLine_1px.js` 删除 |
| 16 | ✅ | `@turf/turf` 拆为 7 个子包（union/centroid/center-of-mass/point-on-feature/flatten/helpers/simplify）；`GeoProjection.js`、`Map2.vue` 更新导入 |

### P2（11/11 完成）

| # | 状态 | 落点 |
|---|------|------|
| 17 | ✅ | 视图按用途归档：`views/maps/`（GuangdongProvinceMap / GuangzhouCityMap / GuangzhouCityMapByHook / FlyLineMap）、`views/demos/`（GridMapDemo / FlatMapDemo / BasicSceneDemo / CameraGuiDemo / HeatmapDemo）；路由改为语义化 path（/guangdong、/grid-map …），旧 path 全部保留 redirect，导航显示 `meta.title` |
| 18 | ✅ | 新增 `threejs/config/geo.js`，投影参数集中管理，视图不再硬编码 center/scale |
| 19 | ✅ | `utils/Size.js` 改用 ResizeObserver（含 window resize 兜底与尺寸去重） |
| 20 | ✅ | 全局样式合并为 `styles/index.css` 单入口，删除 `assets/main.css`/`base.css` |
| 21 | ✅ | 移除 43 处中的全部调试 console（保留 warn/error） |
| 22 | ✅ | 新增 `Map3D/Map2D/FlyLine/MapLine/Heatmap3D` d.ts，重写 `Core.d.ts`（区分「基座配置」与「组件第一参数」两套契约），`types/index.d.ts` 统一导出，`jsconfig` 纳入 src 全量声明 |
| 23 | ✅ | 新增 `eslint.config.js`（flat config：vue recommended + no-unused-vars error）与 `pnpm lint`；新增 `tests/`（node:test）覆盖 geoShape 与投影筛选，`pnpm test` 14 项通过 |
| 24 | ✅ | `Map3D/Map2D/FlowLineGroup` 改为直接文件导入，消除经 `index.js` 的循环引用 |
| 25 | ✅ | 改为共享布局样式类（`.demo-stage` / `.demo-reset-btn` / `.demo-tooltip`）而非组件封装：canvas 需直接持有 ref，包组件只会引入 ref 转发与时序问题；9 个视图的重复 scoped CSS 全部删除 |
| 26 | ✅ | `template4AI/` → `docs/template4AI/`；README 重写（分层结构/组件契约/数据加载约定/路由表）；`REMEAD.md` 并入 README 后删除；vite.config 移除 template4AI exclude |
| 27 | ✅ | heatmap.js patch 原因写入 README |

### 验证

- 隔离目录标准 vite@7.3.0 构建通过：全部 10 个路由视图编译成功，最大视图 chunk ~10KB（GeoJSON 已不进 bundle），index chunk 879KB（three+vue 核心）。
- 本机 `pnpm build` 因系统 Application Control 策略拦截 rolldown 原生 `.node` 二进制无法执行（环境问题，非代码问题）；`pnpm dev` 同理。正常环境执行 `pnpm install && pnpm build` 即可。
- pnpm 10 默认拦截 postinstall 脚本：安装后 heatmap.js 补丁可能未自动应用，已手动验证当前 node_modules 内补丁已生效；重装依赖后如遇热力图异常，执行 `npx patch-package` 手动应用。

### 遗留事项

1. #17 视图语义化重命名（建议单独一批做，配合路由改名）。
2. #22/#23 类型补齐、checkJs、ESLint、最小单测。
3. GeoJSON 几何简化（mapshaper/topojson，可再降一个数量级体积）。
4. `hooks/3DMap.js` 与 `components/Map3D.js` 的地图构建逻辑仍有约一份重叠（材质体系不同：Standard vs Basic+侧壁着色器），后续可考虑让 use3DMap 复用 Map3D 组件。

---

## 六、第二轮实施记录（遗留项清零）

| 项 | 状态 | 落点 |
|---|------|------|
| #17 视图归档与重命名 | ✅ | `views/maps/` + `views/demos/`；路由语义化 + 旧路径重定向；导航改用 `meta.title`，浏览器标题随路由变化 |
| #22 类型声明 | ✅ | 新增 5 份 d.ts；`Core.d.ts` 拆出 `BasicThreejsOpts`（基座配置）与 `BasicThreejsContext`（组件第一参数） |
| #23 工程化 | ✅ | ESLint 9 flat config + `pnpm lint`；`node:test` 单测 + `pnpm test` |
| #25 页面布局 | ✅ | 共享 CSS 类替代组件封装（理由见上表） |
| 遗留 4（地图构建重复） | ✅ | 新增 `threejs/utils/geoShape.js`，`GuangzhouCityMap` / `GuangdongProvinceMap` / `FlyLineMap` / `use3DMap` 全部改用公共构件，删除 4 份手写环遍历 |

### 本轮顺带修掉的正确性问题

1. **`Renderer.js` 缺 `PCFSoftShadowMap` 导入**：任何传 `shadow: true` 的页面（HomeView / 广东省图 / 广州市图）构造渲染器时都会抛 `ReferenceError`，属上一轮改导入时引入的回归。
2. **`GeoProjection.js` 运算符优先级**：`a < b ?? 0` 实际是 `(a < b) ?? 0`，`filter: 'min'` 的兜底分支永远不生效。已补括号（并补单测）。
3. **`GuangdongProvinceMap` 的 Polygon 分支建不出面**：原实现多套了一层循环，每条环被拆成单点后长度不足 3 被丢弃；因数据恰好全是 MultiPolygon 才没暴露。统一改用 `forEachRing` 后 Polygon 数据也能正常渲染。
4. **`FlowLineGroup` 计算后丢弃 turf `union`**：入场时对整份数据做一次全场并集却从未使用，属最贵的无用功；已删除（`getFeatureCoordinates` 内部仍会走 union，后续可再优化）。
5. **`FlyLineMap` 每帧重建几何体**：曲线是静态的，旧实现逐帧 `getPoints + setFromPoints + computeBoundingSphere`（20 条线 × 51 点），改为只更新透明度。
6. **零散清理**：GUI 空 folder、未使用的 `#opts` 私有字段、未使用的解构变量等（由 `no-unused-vars` 一次性清空）。

### 验证

- `npx vite build` 通过（6.8s），10 个路由视图全部编译成功；新增 `geoShape` 拆为独立 chunk（0.87KB）。
- `pnpm lint` 0 error；`pnpm test` 14/14 通过。
- `pnpm-lock.yaml` 已重新生成（上一轮被误删），含 eslint 相关依赖。

### 仍然遗留

1. GeoJSON 几何简化（mapshaper / topojson）——需要肉眼确认边界观感，建议单独做。
2. `FlowLineGroup` 仍依赖 turf `union` 计算流入线走向，大数据量下入场耗时可观；可改为按 feature 取环。
3. `pnpm build` 在本机沙箱内不可用（Application Control 拦截原生二进制），换标准环境即可。

## 七、第三轮实施记录（2026-11-12）：下钻补全 + 飞线重做

### 问题定位

`FlyLineMap.vue` 原实现的「下钻」是假的：`drillDown(targetPosition)` 只把一个点存进
`currentTarget`，`updateDrillDown()` 每帧把相机 lerp 过去，`startPosition` 还硬编码成
`(0, 10, 20)`（真实初始机位是 `(0, 25, 35)`）。没有层级数据结构、没有子级数据加载、
没有返回上一层。飞线则是 `LineBasicMaterial`（恒 1px）+ 整条透明度呼吸，20 条线随机连点，
与地理无关；且归一化用 `30 × 20` 线性映射、飞线端点 `z` 取正而板块 `z` 取负，整组飞线南北镜像。

### 改动清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/threejs/utils/cameraFit.js` | 新增 123 行 | `fitCameraToBox` 数值拟合取景，纯函数可单测 |
| `src/threejs/components/FlyLineFlow.js` | 新增 377 行 | 飞线渲染收口为可复用类（Tube + 着色器） |
| `src/views/maps/FlyLineMap.vue` | 重写 1299 → 922 行 | 层级栈下钻 + 面包屑/Esc + 逐 feature 建模 |
| `tests/cameraFit.test.js` | 新增 10 用例 | 省域/市域 × 宽画幅/竖屏，锁「不裁切 + 不留白 + 竖直居中」 |
| `README.md` | 补充 | 下钻、相机取景、飞线三节约定 |

### 关键决策

1. **取景不能用 `半宽 / tan(fov/2)`**：那是正交投影算法。实测省域层左右角点 NDC 顶到 ±0.993
   （贴死）、南侧被裁。改为对 8 角点投影 + 距离二分 26 次（limit 0.9）+ `target.z` 二分 24 次
   竖直居中，交替 3 轮，稳定到 `x: ±0.90 / y: ±0.87`。
2. **投影范围只算一次**：`bounds` 由省域边界确定，所有层级复用同一 `project()`，
   子级几何体自然落在父级原位 —— 下钻只推相机，不重建坐标系，也就不会出现「跳一下再对齐」。
3. **挤出厚度按区划自身尺寸封顶**：`depth = max(0.006, min(levelDepth, featureExtent * 0.35))`。
   省域 0.5 的绝对厚度对一座小岛是数倍自身宽度，放大到市级会变成一排柱子。
4. **飞线尺寸全部随 `extent` 等比缩放**，抬升 `lift = clamp(distance * 0.34, extent * 0.012, extent * 0.3)`；
   否则市级视图下同样的弧高会变成尖刺。
5. **光点用弧长参数推进**（`curve.getPointAt` / `uv.x` 同参），几何体静态、不逐帧重建；
   着色器一次给出「常亮底光 + 指数拖尾 + 高斯彗星头」，`CustomBlending` 纯加色。

### 顺手修掉的真 bug

1. **GLSL `pow(负数, 2.0)`**：拖尾项 `behind` 可为负，GLSL 对负数底数的 `pow` 行为未定义 → 改 `exp(-k*k)`。
2. **`smoothstep(1.0, 0.985, u)` 边界传反**：GLSL 要求 `edge0 < edge1` → 改 `1.0 - smoothstep(0.985, 1.0, u)`。
3. **`controls.enabled` 卡在 `false`**：resize 触发的立即取景打断了正在跑的补间，`onComplete` 不再触发 →
   在 `if (!duration)` 分支显式恢复 `controls.enabled = true`。
4. **状态栏被旧层级覆盖**：`flashHint` 在函数入口捕获 `node`，1.8s 后把旧状态写回 →
   把 `stack[stack.length - 1]` 移进定时器回调。
5. **飞线南北镜像**：`toWorld` 统一 `-z`，与 `mesh.rotation.x = -π/2` 的 `local +y → world -z` 对齐。

### 验证

- `npx eslint src` 0 error；`npm test` **24/24 通过**；`npx vite build` 通过（28.1s，10 个视图）。
- headless Chrome + swiftshader 截图核对省/市两级观感。
- CDP 真实交互回归（全新浏览器实例，控制台异常：无）：

```
初始:      crumbs=["广东省"]           status="广东省 · 21 个地级市 · 单击区域下钻"
点击东莞:  crumbs=["广东省"]           status="东莞市 暂无下级区划数据"        ← 直筒子市被正确拦下
点击广州:  crumbs=["广东省","广州市"]  status="广州市 · 11 个区县 · Esc 或面包屑返回上级"
按 Esc 后: crumbs=["广东省"]           status="广东省 · 21 个地级市 · 单击区域下钻"
```

### 仍然遗留

1. `guangdong-districts.json` 是**全量**区县数据，每次下钻都整份过滤；数据量再涨应改为按父级分包。
2. 层级只做到区县（第三级），镇街数据缺；`canDrill` 以外的层级扩展只需在 `resolveRegions` 加工数据源。
3. GeoJSON 几何简化仍未做（与上一轮遗留 1 同因：需肉眼确认边界观感）。

## 八、缺陷修复（2026-11-12）：点「返回上级」后跳到别的市

### 现象

下钻到某个市 → 点区县（末级，不下钻）→ 点「返回上级」，却没有回到广东省，
而是落到了另一个市的区县层。

### 根因：浮层点击冒泡进了地图拾取

面包屑、返回按钮、状态行都是 canvas **之上**的绝对定位浮层，但和 canvas 同属
`.flyline-stage` 容器，而 `pointermove / pointerleave / click` 三个监听器都挂在容器上。
于是点「返回上级」时，一次点击触发了两件事：

1. 按钮自身的 `@click` → `goUp()` → `goToDepth(0)`，栈退到省域，开始 0.95s 相机过渡；
2. 同一次点击继续冒泡到容器 → `onClick(event)` → `updatePointer(event)` 取的是**按钮的坐标**
   → `pickRegion()` 以该屏幕点为射线原点。此时相机正处在「市域 → 省域」的过渡途中，
   射线大概率命中某个地级市 mesh；而 `stack` 已经退回长度 1，`canDrill` 恰好成立
   → `drillInto()` 把层级又钻了回去。

因为命中哪个市取决于过渡瞬间的相机位置，所以看起来是「随机跳到别的市」。
同理，点面包屑、点底部状态行也会发生穿透拾取（悬停时浮层下方板块还会被高亮）。

### 修复

监听器仍挂在容器上（要覆盖整块舞台），但在入口处按事件来源过滤：

```js
/** 事件是否落在画布本身上 */
function isMapPointer(event) {
  return event.target === mapCanvas.value
}

function onClick(event) {
  if (isTransitioning) return
  if (!isMapPointer(event)) return   // 浮层点击直接丢弃
  …
}

// pointermove 的 rAF 回调里同样过滤，并清掉悬停态
if (!isMapPointer(pendingPointerEvent)) { clearHover(); return }
```

抽出 `clearHover()` 供 `pointerleave` 与「指针移到浮层上」共用，避免高亮残留。
用 `event.target` 判定而不是给每个浮层加 `stopPropagation`：新增浮层时无需再改一处。

### 验证

确定性用例：在市级层派发一个「目标是返回按钮、clientX/Y 落在地图中心」的合成点击
（等价于用按钮坐标做拾取），修复前后对比 ——

```
修复前：下钻后 ["广东省","珠海市"] → 点返回按钮 → ["广东省","珠海市"]  ❌ 被二次下钻
修复后：下钻后 ["广东省","珠海市"] → 点返回按钮 → ["广东省"]           ✅
```

真实事件全路径回归（CDP Input，控制台异常：无）：

```
✅ 初始在省域 ["广东省"]            ✅ 省域层返回按钮禁用
✅ 下钻后栈深 2 ["广东省","珠海市"]
✅ 点末级区县不改变层级（提示「香洲区 已是最末级区划」）
✅ 返回上级回到广东省               ✅ 返回后按钮重新禁用
✅ 面包屑返回回到广东省             ✅ Esc 返回回到广东省
```

`npx eslint src` 0 error；`npm test` 24/24；`npx vite build` 通过。
