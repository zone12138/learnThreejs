### 组件[component]返回值

- 流光线段[FlowLine]组件: Mesh [update动画方法在userData中]
- 流光线段组[FlowLineGroup]组件: Group [update动画方法在userData中]
- 网格[Grid]组件: Group [update动画方法在userData中]
- 地图标签[MapLabel]组件: Sprite
- 地图线[MapLine]组件: LineSegments
- 平面[Plane]组件: Mesh [update动画方法在userData中]
- 反射纹理[ReflectTexture]组件: Mesh
- 地图3D组件[Map3D]组件: { instance: Group, labelGroup: Group | null, lineGroup: Group | null, flowLineGroup: FlowLineGroup | null }
- 地图2D组件[Map2D]组件: { instance: Group, labelGroup: Group | null, lineGroup: Group | null, flowLineGroup: FlowLineGroup | null }
