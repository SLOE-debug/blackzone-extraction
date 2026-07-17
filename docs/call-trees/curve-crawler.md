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
         ├─ FEATURE_MANIFEST -> BundleId.CommonMonsters
         ├─ BundleService.load()
         │  └─ assetManager.loadBundle()
         │     └─ common-monsters/entry.ts
         │        └─ featureRegistry.register(commonMonstersFeature)
         └─ featureRegistry.get(FeatureId.CommonMonsters)
            └─ feature.createCurveCrawlerDisplay()
               └─ new CurveCrawlerPopulation(
                    motionProfile = ObservationDisplay
                  )
```

大厅不静态 import 蜘蛛的具体实现，只依赖 core 的 `FeatureId`、Feature Loader 和 `MonsterObservationPopulation` 契约。

## 2. CurveCrawlerPopulation 初始化

```text
new CurveCrawlerPopulation(parent, options, ObservationDisplay)
├─ normalizeCurveCrawlerOptions()
├─ new CurveCrawlerState(normalizedOptions)
│  ├─ new EntityTable(CURVE_CRAWLER_SCHEMA, count)
│  ├─ 分配 SoA TypedArray
│  └─ initializeCurveCrawlerData()
│     ├─ 确定性出生位置和随机种子
│     ├─ 体长、体宽、腿长、腿宽、眼睛尺寸
│     ├─ 行为、观察事件、运动意图
│     ├─ 步态相位、眨眼和死亡碎块参数
│     └─ ObservationDisplay 专用朝向和尺寸范围
├─ createCurveCrawlerObservationFootprint(state)
└─ new CurveCrawlerRenderer(parent, state, materialTemplate)
   ├─ createCurveCrawlerBounds(state)
   ├─ new CurveCrawlerMaterials()
   └─ new FixedTopologyBatchRenderer()
      └─ curveCrawlerSurfaceGeometry.write()
```

## 3. 大厅观察轨迹与怪物内部动画的连接

```text
LobbyObservationSpider.update(deltaTime)
├─ LobbyObservationSpiderMotion.update()
│  ├─ Roaming
│  ├─ SidePositioning
│  ├─ TurningTowardGlass
│  ├─ Approaching
│  ├─ Watching
│  ├─ Retreating
│  └─ TurningToRoam
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
│  └─ 受击时间和红色闪烁
├─ CurveCrawlerDeathSystem.update()
│  └─ 死亡碎块、身体塌缩和液体展开/排空
├─ CurveCrawlerBehaviorSystem.update()
│  └─ 自主游荡动作与意图
├─ CurveCrawlerObservationSystem.update()
│  └─ 把大厅观察事件转换为步态、蹲伏、转身意图
├─ CurveCrawlerMovementSystem.update()
│  └─ 速度、朝向、位置和生成区域约束
├─ CurveCrawlerAnimationSystem.update()
│  └─ 步态相位、抬腿、身体脉动、挥腿和眨眼
└─ CurveCrawlerRenderer.update()
```

## 5. 蜘蛛几何每帧写入调用树

```text
CurveCrawlerRenderer.update()
├─ updateCurveCrawlerBounds()
└─ FixedTopologyBatchRenderer.update(bounds)
   ├─ TriangleMeshWriter.reset(false)
   └─ curveCrawlerSurfaceGeometry.write()
      ├─ curveCrawlerBodyGeometry.write()
      │  ├─ 对每个实体循环 8 条腿
      │  │  └─ writeCurveCrawlerLeg()
      │  │     ├─ 根据步态计算 4 个三次贝塞尔控制点
      │  │     ├─ VolumetricTessellator.appendCubicTube()
      │  │     └─ VolumetricTessellator.appendEllipsoid() 生成脚端
      │  ├─ appendEllipsoid() 生成腹部
      │  └─ appendEllipsoid() 生成胸部
      ├─ curveCrawlerEyeGeometry.write()
      │  └─ appendEllipsoid() × 2
      └─ curveCrawlerLiquidGeometry.write()
         └─ 18 射线 Triangle Fan
   ↓
   curveCrawlerVertexShading.update()
   ├─ Body Tint / Hit Tint
   ├─ Eye Tint / Hit Tint
   └─ Liquid Tint / Drained Tint
   ↓
   DynamicMeshBatch.uploadVertexAttributes()
   └─ 上传 Position + Normal + Color；Index 不重传
```

## 6. 当前技术路线

- 群体状态使用 SoA TypedArray，行为、移动、动画、死亡职责分离。
- 单实体固定 `581` 个顶点、`2526` 个索引、`842` 个三角形。
- 腿使用 6 段三次贝塞尔 Tube，每个截面 4 个径向顶点。
- 腹部、胸部、脚端和眼睛使用低段数参数化椭球。
- 生存、受击和死亡状态直接驱动几何参数与顶点色。
- Index Buffer 初始化后不上传，但 CPU 每帧仍会执行拓扑循环、贝塞尔采样、三角函数、法线和颜色计算。
- 与新玩家的显式领域拓扑相比，蜘蛛仍是较早的“通用参数化体元”路线；如果要统一美术语言和性能模型，它是后续重构重点。
