# Vanguard 玩家程序化模型调用树

## 1. 职责拆分

| 目录 | 当前职责 |
| --- | --- |
| `model` | 人体比例、连续纵深轮廓、骨骼枚举、SoA Schema、状态和创建参数 |
| `animation` | 根据待机相位计算当前骨骼矩阵 |
| `geometry` | 定义控制笼、编译固定 MeshPlan，并按姿态求值 Position / Normal |
| `simulation` | 推进固定粒子披风、距离约束和解析碰撞 |
| `rendering` | 材质、语义调色板、包围盒和 Cocos 动态 Mesh 上传 |
| `population` | 对外门面，编排移动、动画、披风、渲染和销毁 |

## 2. 模块首次加载时的拓扑编译

```text
导入 assets/player/vanguard
├─ vanguard-body-cage.ts
├─ vanguard-outfit-cage.ts
├─ vanguard-hair-cage.ts
├─ vanguard-headwear-cage.ts
└─ vanguard-mantle-cage.ts
   ↓
VanguardCageBuilder
├─ vertex(position, boneA, boneB, weightB)
│  └─ 按局部高度把美术基准 Z 转换为非均匀前后纵深
├─ resolvedVertex()
│  └─ 接收已经应用纵深轮廓的动态披风控制点
├─ triangle() / quad() / facetedQuad()
└─ build()
   ↓
vanguard-model-cage.ts
└─ VANGUARD_MATTE_CAGE
   ↓
compileVanguardMeshPlan()
├─ 压缩双骨骼控制点数据
├─ 编译披风粒子到正反厚度控制点的覆盖关系
├─ 展开 Triangle / Quad / FacetedQuad 的固定三角形
├─ 编译直接控制点与派生中心点指令
├─ 生成固定局部 Index、semanticIds、colorVariantIds
└─ 生成连续 semanticSpans
   ↓
VANGUARD_MATTE_MESH_PLAN
```

这里不是把 Box、Cylinder、Capsule 等 Primitive 互相穿插，而是显式声明人体语义顶点和面片。主角控制笼仍在绑定阶段保持共享边界；渲染计划只在初始化期把它展开为硬分面顶点。

## 3. Population 初始化调用树

```text
LobbySceneRuntime.initialize()
└─ new VanguardPopulation(parent, materialTemplate, options)
   ├─ new VanguardState(options)
   ├─ VanguardAnimationSystem.initialize(state)
   │  └─ writeVanguardPoseMatrices()
   ├─ VanguardMantleSimulationSystem.initialize(state)
   │  ├─ 写入 13 粒子绑定形态
   │  ├─ 固定胸肩锚点
   │  └─ 投影到躯干与手臂碰撞壳之外
   └─ new VanguardRenderer(parent, state, materialTemplate)
      ├─ new VanguardMaterials()
      ├─ createVanguardBounds(state)
      ├─ new VanguardMeshEvaluator(MattePlan, MattePalette)
      └─ new CompiledMeshBatchRenderer(Character)
         ├─ 一次性复制并偏移局部 Index
         ├─ createVertexStreams() 复用 SurfaceBufferGeometry
         ├─ evaluator.evaluate(MeshDirty.All)
         │  └─ 初始化 Position / Normal / Color
         └─ DynamicMeshBatch.initialize()
            ├─ MeshUtils.createDynamicMesh()
            ├─ new Node + MeshRenderer
            └─ 绑定 Material 与阴影配置
```

## 4. 每帧动画和姿态更新调用树

```text
LobbySceneRuntime.update(deltaTime)
└─ VanguardPopulation.update(deltaTime)
   ├─ VanguardMovementSystem.update(state, deltaTime)
   ├─ VanguardAnimationSystem.update(state, deltaTime)
   │  ├─ 校验 VanguardAction.Idle
   │  └─ writeVanguardPoseMatrices()
   ├─ VanguardMantleSimulationSystem.update(state, deltaTime)
   │  ├─ 把历史粒子重基到当前角色本地坐标
   │  ├─ 以 60Hz 固定步长执行 Verlet 积分
   │  ├─ 迭代结构、剪切与弯曲约束
   │  └─ 投影躯干椭球、双臂椭圆胶囊和逐粒子背挡
   └─ VanguardRenderer.update()
      └─ batches.update(MeshDirty.Geometry)
         ↓
      VanguardMeshEvaluator.evaluate()
      ├─ skinControlVertices()
      │  └─ 每个共享控制点执行最多两骨骼混合
      ├─ applyMantleControls()
      │  ├─ 从固定披风拓扑重建中面粒子法线
      │  └─ 用中面粒子位置和法线恢复正反厚度控制点
      ├─ evaluateFacetedCenters()
      │  └─ 四角平均值 + 当前面法线 × ridge
      ├─ expandRenderPositions()
      └─ Core writeSequentialFlatNormals()
         ↓
      DynamicMeshBatch.uploadVertexAttributes(MeshDirty.Pose)
      └─ 只上传 Position + Normal；Color 与 Index 不重传
```

`Position` 和 `Normal` 构成原子 `MeshDirty.Pose`：不允许只更新其中一条流，避免新法线与旧姿态位置不一致。

## 5. 当前技术路线

- 领域控制笼与最终渲染网格之间由类型化 `VanguardMeshPlan` 衔接。
- `FacetedQuad` 的中心点是每帧从四个蒙皮控制点派生的数据，而非伪装成普通共享顶点。
- 固定 Index、语义 ID、颜色变体和面片展开全部只在编译期执行一次。
- 全部可见控制笼共享按高度连续插值的前后纵深轮廓：胸背最厚，头部适中，腿脚向地面收窄。
- 从统一发际线到双侧头皮、头顶与整个后脑直接使用连续头发语义，不再叠加零碎外层发片，也不存在皮肤色兜底面。
- 自由披片只使用 `13` 个粒子和 `32` 条共享约束，热路径仅操作预分配 TypedArray。
- 披风躯干椭球与双臂椭圆胶囊使用同一纵深配置，侧面增厚后不牺牲防穿模边界。
- 披风在角色本地坐标中模拟，移动和转向通过重基产生惯性，传送时直接清空历史速度。
- 当前共 `695` 个三角形，封闭耳廓、头部本体连续短发、帽子、披肩、柔性披片和人体统一进入单一 `Character` 渲染层。
- Cocos Standard 材质持续接收动态 Normal 流，因此真实灯光与阴影仍随当前姿态变化。
