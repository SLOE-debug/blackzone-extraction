# Curve Crawler 蜘蛛调用树

## 1. 从大厅到 Common Monsters Bundle 的异步加载

```text
LobbySceneRuntime.initialize()
└─ new LobbyObservationSpider(parent, materialTemplate)
   ├─ new Node("LobbyObservationSpider")
   ├─ new Node("LobbyObservationSpiderModel")
   ├─ modelRoot.rotateX(-90°)
   │  └─ 把怪物原生 XY 地面 / Z-up 对齐到大厅 XZ 地面 / Y-up
   └─ void observationSpider.initialize()
      └─ FeatureLoader.load(FeatureId.CommonMonsters)
         └─ feature.createCurveCrawlerDisplay()
            └─ new CurveCrawlerPopulation(
                 motionProfile = ObservationDisplay
               )
```

大厅不静态 import 蜘蛛的具体实现，只依赖 core 的 `FeatureId`、Feature Loader 和 `MonsterObservationPopulation` 契约。

## 2. CurveCrawlerPopulation 初始化与网格编译

```text
new CurveCrawlerPopulation(parent, options, ObservationDisplay)
├─ normalizeCurveCrawlerOptions()
├─ new CurveCrawlerState(normalizedOptions)
│  └─ 分配 SoA TypedArray 与确定性形态、步态、死亡参数
├─ createCurveCrawlerObservationFootprint(state)
└─ new CurveCrawlerRenderer(parent, state, materialTemplate)
   ├─ createCurveCrawlerBounds(state)
   ├─ new CurveCrawlerMaterials()
   └─ new CompiledMeshBatchRenderer()
      ├─ curveCrawlerMeshPlan
      │  ├─ compileCubicTubeSamplePlan()
      │  │  ├─ 贝塞尔位置 / 切线系数
      │  │  ├─ 径向 sin / cos
      │  │  └─ 固定局部 Index
      │  ├─ compileEllipsoidSamplePlan()
      │  │  ├─ 单位方向采样
      │  │  └─ 固定局部 Index
      │  ├─ compileFanSamplePlan()
      │  └─ 合并 Body → Eye → Liquid 的局部 Plan 与 semanticIds
      ├─ 一次性复制并偏移每个实体的局部 Index
      ├─ curveCrawlerMeshEvaluator.evaluate(MeshDirty.All)
      └─ DynamicMeshBatch.initialize()
```

单实体仍固定为 `581` 个顶点、`2526` 个索引、`842` 个三角形；差别在于拓扑、采样参数和 Index 不再出现在每帧路径。

## 3. 大厅观察轨迹与怪物内部动画的连接

```text
LobbyObservationSpider.update(deltaTime)
├─ LobbyObservationSpiderMotion.update()
├─ 根据真实 footprint 限制蜘蛛始终位于玻璃后方
├─ 把世界位移投影为怪物局部 forward/lateral speed 和 turn rate
├─ root.setPosition() / root.setRotation()
├─ population.enterObservationEvent(event)
├─ population.synchronizeObservationMotion(speed, lateral, turnRate)
└─ population.update(deltaTime)
```

大厅拥有“蜘蛛在场景里走到哪里”；Curve Crawler Feature 拥有“腿如何迈、身体如何蹲伏和转向”。两者通过通用观察事件和真实局部速度解耦。

## 4. Population 每帧系统顺序

```text
CurveCrawlerPopulation.update(deltaTime)
├─ CurveCrawlerHitSystem.update()
├─ CurveCrawlerDeathSystem.update()
├─ CurveCrawlerBehaviorSystem.update()
├─ CurveCrawlerObservationSystem.update()
├─ CurveCrawlerMovementSystem.update()
├─ CurveCrawlerAnimationSystem.update()
└─ CurveCrawlerRenderer.update()
```

## 5. 编译式运行时几何调用树

```text
CurveCrawlerRenderer.update()
├─ updateCurveCrawlerBounds()
├─ 比较六个本地 Bounds 分量的前帧值
├─ 比较 hitFlash / liquidDrain 的前帧值
└─ CompiledMeshBatchRenderer.update(dirty, bounds?)
   ├─ MeshDirty.Pose
   │  └─ CurveCrawlerMeshEvaluator.evaluate()
   │     ├─ 计算 8 条腿的贝塞尔控制点
   │     ├─ evaluateCubicTube() × 8
   │     ├─ evaluateEllipsoid()：脚端、腹部、胸部、双眼
   │     ├─ evaluateLiquidFan()
   │     └─ 坍缩时只退化 Position / Normal，不改 Index
   ├─ MeshDirty.Color（仅受击或液化颜色改变时）
   │  └─ semanticIds → Body / Eye / Liquid 顶点色
   ├─ MeshDirty.Bounds（仅本地裁剪边界真实变化时）
   │  └─ DynamicMeshBatch.updateBounds()
   └─ DynamicMeshBatch.uploadVertexAttributes(changed)
      ├─ Pose：上传 Position + Normal
      └─ Color：上传 Color
```

`Position` 和 `Normal` 使用原子 `MeshDirty.Pose` 同步更新，避免当前法线和旧位置流混用。

## 6. 当前技术路线

- 群体状态继续使用 SoA TypedArray，行为、移动、动画和死亡职责保持分离。
- Tube、椭球和扇面保留领域化低段数体元，但它们的固定采样和连接关系只编译一次。
- 存活、步态、眨眼、爆裂、坍缩和液化仍直接驱动参数求值；坍缩不删除三角形，只退化固定顶点流。
- 受击闪烁与液体排空是事件颜色流，普通步态不会重写或上传 Color。
- 静止展示实体的本地 Bounds 不变时不会重复触发 Cocos `onGeometryChanged()`。
- Cocos Standard 材质持续接收动态 Normal 流，真实灯光与阴影仍跟随当前实体姿态。
