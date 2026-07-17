# Vanguard 玩家程序化模型调用树

## 1. 职责拆分

| 目录 | 当前职责 |
| --- | --- |
| `model` | 人体比例、骨骼枚举、SoA Schema、状态和创建参数 |
| `animation` | 根据待机相位计算当前骨骼矩阵 |
| `geometry` | 定义绑定姿态拓扑笼、蒙皮信息、三角面和真实面法线 |
| `rendering` | 材质、顶点色、包围盒、动态 Mesh 批次 |
| `population` | 对外门面，编排状态、动画、渲染和销毁 |

## 2. 模块首次加载时的拓扑构建

```text
导入 assets/player/vanguard
├─ vanguard-body-cage.ts
│  └─ createVanguardBodyCage()
│     ├─ addTorso()
│     ├─ addHead() / addNeck() / addJawRow()
│     ├─ addArm() / addHand()
│     └─ addLegPair() / addFoot()
├─ vanguard-outfit-cage.ts
│  ├─ createFaceDetailCage()
│  └─ createOutfitCage()
├─ vanguard-hair-cage.ts
├─ vanguard-scarf-cage.ts
└─ vanguard-sword-cage.ts
   ↓
VanguardCageBuilder
├─ vertex(position, boneA, boneB, weightB)
│  └─ worldToBoneLocal()
├─ triangle() / quad() / facetedQuad()
└─ build()
   ↓
vanguard-model-cage.ts
├─ mergeVanguardCages(body, outfit, hair, scarf)
│  └─ VANGUARD_MATTE_CAGE
└─ VANGUARD_SWORD_CAGE
   └─ VANGUARD_METAL_CAGE
   ↓
vanguard-topology.ts
├─ VANGUARD_MATTE_TOPOLOGY
├─ VANGUARD_METAL_TOPOLOGY
└─ 每个语义 Surface 的连续顶点范围
```

这里不是把 Box、Cylinder、Capsule 等 Primitive 互相穿插，而是显式声明人体语义顶点和面片。主体肩、臂、胯、腿共享拓扑边界；每个绑定顶点最多保存两根骨骼及其权重。

## 3. Population 初始化调用树

```text
LobbySceneRuntime.initialize()
└─ new VanguardPopulation(parent, materialTemplate, options)
   ├─ new VanguardState(options)
   │  ├─ validateVanguardOptions()
   │  ├─ new EntityTable(VANGUARD_SCHEMA, 1)
   │  ├─ table.allocate()
   │  └─ initializeVanguardData()
   │     ├─ transform: position + heading
   │     ├─ morphology: scale
   │     ├─ intent: ShrugAndTurnHead
   │     └─ animation: idlePhase
   ├─ VanguardAnimationSystem.initialize(state)
   │  └─ writeVanguardPoseMatrices()
   │     └─ 写入 20 根人体/装备骨骼的 3x4 仿射矩阵
   └─ new VanguardRenderer(parent, state, materialTemplate)
      ├─ new VanguardMaterials()
      │  ├─ Matte builtin-standard
      │  └─ Metal builtin-standard
      ├─ createVanguardBounds(state)
      ├─ new FixedTopologyBatchRenderer(Matte)
      │  └─ vanguardMatteGeometry.write()
      └─ new FixedTopologyBatchRenderer(Metal)
         └─ vanguardMetalGeometry.write()
```

`FixedTopologyBatchRenderer` 构造时的公共路径：

```text
计算 Uint16 安全批容量
└─ createSurfaceGeometry()
   └─ TriangleMeshWriter.reset(true)
      └─ GeometrySource.write()
         └─ 写入初始 Position / Normal / Index
            └─ VertexShading.update(Color)
               └─ DynamicMeshBatch.initialize()
                  ├─ MeshUtils.createDynamicMesh()
                  ├─ new Node + MeshRenderer
                  ├─ 绑定 Material
                  └─ 配置投射/接收阴影
```

## 4. 每帧动画和几何更新调用树

```text
LobbySceneRuntime.update(deltaTime)
└─ VanguardPopulation.update(deltaTime)
   ├─ 限制 deltaTime 到 1/240～0.05 秒
   ├─ VanguardAnimationSystem.update(state, deltaTime)
   │  ├─ 推进 idlePhase
   │  └─ writeVanguardPoseMatrices()
   │     ├─ Root / Pelvis / Chest / Neck / Head
   │     ├─ 双臂 / 前臂 / 手
   │     ├─ 双腿 / 小腿 / 脚
   │     ├─ 两条围巾尾部
   │     └─ Sword
   └─ VanguardRenderer.update()
      ├─ matteBatches.update()
      └─ metalBatches.update()
         ↓
      TriangleMeshWriter.reset(false)
      └─ VanguardMatteGeometrySource.write()
         或 VanguardMetalGeometrySource.write()
         └─ VanguardCageGeometryWriter.append()
            ├─ deformVertices()
            │  ├─ 读取预分配 boneMatrices
            │  ├─ 每个共享笼顶点执行最多两骨骼混合
            │  └─ 写入预分配 Float64Array
            └─ appendPatch()
               ├─ Triangle
               ├─ Quad -> 2 triangles
               └─ FacetedQuad -> 4 triangles
                  ↓
               appendVanguardTriangle()
               ├─ 计算真实单位面法线
               ├─ 每个三角形展开为 3 个独立硬分面顶点
               └─ writer.triangle()
      ↓
      VanguardVertexShading.update()
      └─ 按 Skin / NeckSkin / Hair / Tunic / Scarf / Pants / Leather / Metal 写色
      ↓
      DynamicMeshBatch.uploadVertexAttributes()
      └─ 上传 Position + Normal + Color；Index 不重传
```

## 5. 当前技术路线

- 绑定姿态由代码中的人体地标和显式顶点构成。
- 笼顶点共享，用于保证肩、肘、胯、膝等关节连续。
- 渲染缓冲为了 Flat Shading 再展开为每三角形独立顶点。
- 动画不是 Cocos `SkinnedMeshRenderer`，而是 CPU 计算骨骼矩阵和蒙皮结果，再更新 Dynamic Mesh。
- 每帧不重新分配骨骼矩阵或共享顶点缓存。
- 当前共 `564` 个三角形：Matte `524`，Metal `40`。
- 索引初始化时写一次；每帧仍会重新遍历面片并计算 Position、Normal、Color。
