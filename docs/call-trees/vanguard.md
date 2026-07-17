# Vanguard 玩家程序化模型调用树

## 1. 职责拆分

| 目录 | 当前职责 |
| --- | --- |
| `model` | 人体比例、骨骼枚举、SoA Schema、状态和创建参数 |
| `animation` | 根据待机相位计算当前骨骼矩阵 |
| `geometry` | 定义控制笼、编译固定 MeshPlan，并按姿态求值 Position / Normal |
| `rendering` | 材质、语义调色板、包围盒和 Cocos 动态 Mesh 上传 |
| `population` | 对外门面，编排状态、动画、渲染和销毁 |

## 2. 模块首次加载时的拓扑编译

```text
导入 assets/player/vanguard
├─ vanguard-body-cage.ts
├─ vanguard-outfit-cage.ts
├─ vanguard-hair-cage.ts
├─ vanguard-scarf-cage.ts
└─ vanguard-sword-cage.ts
   ↓
VanguardCageBuilder
├─ vertex(position, boneA, boneB, weightB)
├─ triangle() / quad() / facetedQuad()
└─ build()
   ↓
vanguard-model-cage.ts
├─ VANGUARD_MATTE_CAGE
└─ VANGUARD_METAL_CAGE
   ↓
compileVanguardMeshPlan()
├─ 压缩双骨骼控制点数据
├─ 展开 Triangle / Quad / FacetedQuad 的固定三角形
├─ 编译直接控制点与派生中心点指令
├─ 生成固定局部 Index、semanticIds、colorVariantIds
└─ 生成连续 semanticSpans
   ↓
VANGUARD_MATTE_MESH_PLAN / VANGUARD_METAL_MESH_PLAN
```

这里不是把 Box、Cylinder、Capsule 等 Primitive 互相穿插，而是显式声明人体语义顶点和面片。主角控制笼仍在绑定阶段保持共享边界；渲染计划只在初始化期把它展开为硬分面顶点。

## 3. Population 初始化调用树

```text
LobbySceneRuntime.initialize()
└─ new VanguardPopulation(parent, materialTemplate, options)
   ├─ new VanguardState(options)
   ├─ VanguardAnimationSystem.initialize(state)
   │  └─ writeVanguardPoseMatrices()
   └─ new VanguardRenderer(parent, state, materialTemplate)
      ├─ new VanguardMaterials()
      ├─ createVanguardBounds(state)
      ├─ new VanguardMeshEvaluator(MattePlan, MattePalette)
      ├─ new VanguardMeshEvaluator(MetalPlan, MetalPalette)
      └─ new CompiledMeshBatchRenderer(Matte / Metal)
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
   ├─ VanguardAnimationSystem.update(state, deltaTime)
   │  └─ writeVanguardPoseMatrices()
   └─ VanguardRenderer.update()
      ├─ matteBatches.update(MeshDirty.Pose)
      └─ metalBatches.update(MeshDirty.Pose)
         ↓
      VanguardMeshEvaluator.evaluate()
      ├─ skinControlVertices()
      │  └─ 每个共享控制点执行最多两骨骼混合
      ├─ evaluateFacetedCenters()
      │  └─ 四角平均值 + 当前面法线 × ridge
      ├─ expandRenderPositions()
      └─ computeFlatNormals()
         ↓
      DynamicMeshBatch.uploadVertexAttributes(MeshDirty.Pose)
      └─ 只上传 Position + Normal；Color 与 Index 不重传
```

`Position` 和 `Normal` 构成原子 `MeshDirty.Pose`：不允许只更新其中一条流，避免新法线与旧姿态位置不一致。

## 5. 当前技术路线

- 领域控制笼与最终渲染网格之间由类型化 `VanguardMeshPlan` 衔接。
- `FacetedQuad` 的中心点是每帧从四个蒙皮控制点派生的数据，而非伪装成普通共享顶点。
- 固定 Index、语义 ID、颜色变体和面片展开全部只在编译期执行一次。
- 普通待机动画只评估与上传 Position / Normal；语义顶点色仅在初始化或未来颜色事件中写入。
- 当前共 `564` 个三角形：Matte `524`，Metal `40`。
- Cocos Standard 材质持续接收动态 Normal 流，因此真实灯光与阴影仍随当前姿态变化。
