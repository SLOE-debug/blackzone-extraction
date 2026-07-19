# 程序化 Low Poly 模型复用架构评审

> 审计基线：`main@0dc4d06`，2026-07-19。大厅、战场地面、环境原型、树木、蘑菇、Vanguard 与 Curve Crawler 的逐层调用链见[当前 Call Tree](low-poly-model-creation-current.md)。

> 专家裁决见[程序化 Low Poly Geometry 架构裁决](../call_tree模块化方案.md)。当前工作树已完成 P0–P3；本文件保留迁移前审计事实，并在实施状态与迁移章节记录实际结果。

## 1. 结论摘要

当前项目已经解决了上一阶段最关键的问题：Vanguard 和 Curve Crawler 不再每帧重走拓扑，而是采用 `Recipe/Cage -> MeshPlan -> Evaluator -> VertexStreams -> GPU`。大厅也已形成 `SurfaceFrame + FlatGridPatch + Deformer + StaticSurfaceMesh`。

P0–P3 前的主要重复不在运行时渲染层，而在“模型作者层”：

1. Lobby 与 Battlefield Ground 各自实现共享格点采样、交替对角线、独立三角形和面法线。
2. Lobby 祭台/灯具/观察窗与 Battlefield 树木/蘑菇/岩体各自实现多圈轮廓、环间连接和端盖。
3. Core Faceted Builder、Environment Builder、Lobby/Ground triangle helper 重复计算面法线和绕序；该项已由 P0 消除。
4. Lobby Section、Environment Mega Mesh Section、Crawler 子计划重复维护顶点/索引游标和连续区段。
5. Environment 原型枚举、稳定顺序、配置和 MeshPlan 映射曾分散在平行清单中；P3 已收敛到单一 Catalog。
6. 顶点流类型曾偏粗：Environment 使用 Unlit，却为统一大网格分配约 `5.2 MiB` 的 CPU Normal 缓冲；P3 已通过精确 Layout 移除。

建议抽象，但抽的是稳定机制，不是包办所有造型的万能 DSL：

```text
Feature Recipe / Cage / State
├─ Feature Deformer / Evaluator          继续留在 Feature
└─ Core Primitive / Plan Infrastructure  提取已有第二消费者的机制
   ├─ Faceted Triangle Emitter
   ├─ Parametric Flat Grid
   ├─ Radial Profile / Shell
   ├─ Typed Section / MeshPlan Composer
   └─ Typed Vertex Layout
```

此前 `docs/low_poly框架.md` 约定“第二个真实消费者出现后再晋升 core”。现在 Battlefield Ground 已成为 Grid 的第二消费者；Battlefield Environment 与 Lobby 径向道具、Core Faceted Builder 的武器/宝箱消费者共同验证了 Radial/Faceted 机制。Grid、Radial 与 Faceted 的晋升条件已经满足；异构静态原型 Plan Composer 仍只有 Environment 一个完整消费者，所以放在较后的 P3 单独决策。

### 1.1 当前实施状态

| 阶段 | 状态 | 当前结果 |
| --- | --- | --- |
| P0 Faceted + Section | 已完成 | Core Emitter/Sink、Orientation、Sequential Flat Normal 与通用 Section Composer 已落地；Lobby、Ground、Environment、武器/宝箱、Vanguard 已接入 |
| P1 Grid | 已完成 | Core FlatGridPlan/Workspace/Sampler/Emitter 已落地；Lobby 使用 Float64 洞穴 Sampler，Ground 使用可复用 Float32 Workspace 与绝对世界格点 Sampler |
| P2 Radial | 已完成 | Core Radial Plan/Workspace/RingSource/Emitter 已落地；大厅灯具/祭台/观察墙与全部 Environment Tube/Shell 已接入，领域扰动仍在 Feature |
| P3 Layout/Catalog/Composition | 已完成 | 精确 Lit/Unlit SoA Layout、唯一 Environment Catalog、Core repeated-plan composer 与 Feature 显式 Prepare 已落地；Mega Mesh 策略仍留在 Battlefield |
| P4 Character Authoring | 推迟 | 等第二个固定拓扑骨骼 Cage 角色出现后再裁决 |

P0–P3 迁移没有改动任何领域形变公式。黄金测试逐字节锁定 Lobby Opaque/Emissive、Ground 与全部八种 Environment 原型；现有 `50` 个测试文件、`161` 项测试继续覆盖 Ground seam、Section range、Catalog/Composer、三角形计数和环境局部 Bounds 生成路径。

## 2. 代码量判断

Feature 侧 Lobby、Ground、Environment、Vanguard 的 Geometry/Rendering 合计约 `6,958` 个物理 TypeScript 行。安全抽取不会删除领域造型数据，首先减少的是拓扑控制流、游标管理、重复类型和渲染装配。

几个决定性事实：

- Lobby Opaque/Emissive/Glass 分别为 `1,528/88/32` triangles。
- Battlefield Ground 为 `20,000` triangles，和 Lobby Grid 使用相同的 Flat 拓扑阶段。
- DeadTree 与 LuminousMushroom 分别为 `276/156` triangles，都由多圈 Tube/Shell 组合。
- Environment Mega Mesh 为 `150,736` triangles / `452,208` 顶点，单 MeshRenderer、Uint32 Index。
- Vanguard 为 `695` triangles；其运行时 Plan/Evaluator/Dirty Stream 已经完成合理抽象。
- Curve Crawler 为 `984` triangles；它验证了动态参数体元不应与静态硬分面原语强行统一。

## 3. 重复模式与建议归属

| 重复家族 | 当前位置 | 建议 |
| --- | --- | --- |
| Face Normal、Triangle/Quad、朝外绕序 | P0 前分散于 Lobby/Ground helper、两个 Builder 与 Vanguard；现统一到 `core/geometry/faceted` | 已提取 Faceted Emitter、Orientation 与 Sequential Flat Normal kernel |
| Flat Grid | 原两套循环已由 `core/geometry/grid` 的 Plan/Workspace/Emitter 取代 | P1 已完成；Sampler/Deformer 继续由 Feature 注入 |
| SurfaceFrame | 已从 Lobby 晋升 `core/geometry/grid` | Lobby 使用 U/V/N Frame；Ground 直接使用绝对世界格点上下文，不伪装成局部 Frame |
| Ring/Tube/Shell/Fan | Lobby altar/lights/window、Environment recipes、Vanguard headwear | 提取轮廓连接和端盖机制，不提取领域形变公式 |
| Section/offset/index composition | Lobby Geometry Section 与 Core repeated MeshPlan Composer 已按职责分层 | P3 已让 Environment Mega Layout 使用通用计数、偏移、重复 Index 与 Section 组合 |
| Static faceted builder | 原两个 Builder 已删除；现由 Core Emitter 配合 Static/Environment 窄 Sink | 已采用组合式 Attribute Sink，未引入继承式万能 Builder |
| Semantic palette/facet variation | Lobby Section shading、Environment variants、Vanguard/Crawler semantic IDs | 提取小型 palette/variant kernel，保留 Feature 调色和事件公式 |
| Prototype registry | 唯一只读 Catalog 同时拥有稳定 ID、具名类型化键、顺序、容量、碰撞、缩放与编译入口 | ID 联合、`BattlefieldEnvironmentPrototype.*` 键、Prepared Catalog、世界 Archetype 和 Mega Section 均自动派生 |
| Vertex stream layout | `LIT_COLOR_LAYOUT` 与 `UNLIT_COLOR_LAYOUT` 贯穿计划、流、Geometry、Evaluator 和 DynamicMeshBatch | Environment/Projectile 不再拥有占位 Normal；布局缺失流时上传直接失败 |

## 4. 推荐抽象边界

### 4.1 Faceted Emitter

应统一以下纯机械能力：

- 叉乘、退化检查、单位 Face Normal；
- Triangle、Quad、Oriented Triangle/Quad、Double-sided Quad；
- Sequential Flat Normal 的动态重算；
- 向 `TriangleMeshWriter` 或编译期数组 Sink 写入。

不应统一颜色规则、领域语义和点的生成方式。相比继承一个大 Builder，更建议“Emitter + Attribute Sink”组合：Core 只认识点、法线和写入目标，Environment 的 `facetVariants` 由自己的 Sink/Policy 附加。

### 4.2 Parametric Flat Grid

Lobby 与 Ground 应共享：

- Grid metrics 与固定对角线计划；
- 共享采样缓存；
- U/V/N Frame 映射；
- Flat triangle emission；
- 可复用 workspace，避免 Ground 每次 Chunk 更新分配。

Feature 继续拥有：

- Lobby Cave Relief、边缘衰减与 seed；
- Ground 世界格点、Chunk 连续噪声和 biome 色域；
- 各自的 winding、尺寸与采样上下文。

### 4.3 Radial Profile / Shell

P2 落地后 Core 只负责：

- 闭合轮廓的稳定 segment；
- 相邻圈连接；
- Fan 中心连接；
- SideBands、Fan 与逐 Segment 交错 Pass 的稳定输出顺序；
- 显式 winding、triangle order 与退化策略；
- Ring/Center 采样槽和双精度 Workspace。

Feature 继续负责轮廓如何变形。Environment 正弦半径变化、seed、截面 basis 和弯曲中心位于自己的 `RadialRingSource`；Lobby Observation Wall 的矩形边界求交仍留在 Lobby。当前没有双面 Radial Cap 的真实消费者，因此 P2 没有预造该策略；已有双面叶片继续使用 Faceted Quad。

Vanguard Headwear 已完成边界评估但未接入：它生成共享控制点 Cage、带 ridge 的 Quad 和骨骼绑定，不是独立三角形 Faceted Sink。仅为复用 segment 循环而改写会破坏角色作者契约，因此继续遵守 P4 的第二角色触发条件。

### 4.4 Typed Section 与 MeshPlan Composer

建议让同一套游标/偏移基础服务四种场景：

1. Lobby 写入时记录语义 Section；
2. Lobby Emissive 合批记录连续范围；
3. Crawler 编译多个子计划并平移局部 Index；
4. Environment 按 Prototype × Capacity 组合异构 Mega Mesh。

Composer 负责计数、偏移、Index 平移和完整性校验；Feature 仍定义 Section ID、稳定顺序和语义。

### 4.5 Typed Vertex Layout

当前 `BufferGeometry` 已是泛型，但 `createSurfaceGeometry()` 和 `DynamicMeshBatch` 实际固定围绕 Position/Normal/Color。建议显式区分：

```text
LitSurfaceLayout   = Position + Normal + Color
UnlitColorLayout   = Position + Color
StaticUvLayout     = Position + Normal + Color + UV
```

Environment 直接对齐 `UnlitColorLayout`，不保留无用 Normal 分配或旧契约兼容分支。未来若切换 Standard，应明确改用 Lit Layout 并在实例 Evaluator 中旋转/写入法线。

### 4.6 角色 Cage 的边界

Vanguard 的 Triangle/Quad/FacetedQuad 编译、Ring/Band 连接、双权重 Skinning 和 Flat Normal 有复用潜力；人体比例、骨骼、纵深轮廓、披风绑定必须留在角色模块。

当前只有一个骨骼 Cage 角色。建议等第二个人形或骨骼 Cage 消费者出现后，再泛化 Semantic Cage 和 Skinning Plan，避免把 Vanguard 偶然需求固化到 core。

## 5. 推荐目标模块

```text
assets/core/geometry/
├─ faceted/
│  ├─ faceted-emitter.ts
│  ├─ facet-orientation.ts
│  ├─ sequential-flat-normal.ts
│  └─ static-faceted-mesh-sink.ts
├─ grid/
│  ├─ surface-frame.ts
│  ├─ flat-grid-plan.ts
│  ├─ flat-grid-workspace.ts
│  └─ flat-grid-emitter.ts
├─ radial/
│  ├─ radial-topology-plan.ts
│  ├─ radial-ring-source.ts
│  ├─ radial-workspace.ts
│  └─ radial-emitter.ts
└─ sections/
   └─ geometry-section-composer.ts

assets/core/mesh/
├─ mesh-plan-composer.ts
├─ static-prototype-mesh-plan.ts
├─ semantic-palette.ts
└─ vertex-layout.ts
```

Feature 侧保留领域配方：

```text
Lobby
├─ shell recipe + cave deformer
├─ observation boundary sampler
├─ altar/lamp/window radial recipes
└─ section palette

Battlefield
├─ world ground sampler + biome sampler
├─ environment prototype catalog
├─ organic/mineral/ruin recipes
└─ heterogeneous instance evaluator

Vanguard
├─ anatomy/bones/depth profile
├─ body/outfit/headwear/mantle cages
├─ skin/mantle evaluator
└─ character palette
```

## 6. 目标调用树

### 6.1 静态或低频程序几何

```text
Feature Recipe
└─ Primitive Plan / Emitter
   ├─ FlatGrid / RadialProfile / Ribbon
   └─ Feature Special Case
      ↓
   MeshSectionComposer
      ↓
   Geometry / StaticPrototypeMeshPlan
      ↓
   Feature Shading / Instance Evaluator
      ↓
   StaticSurfaceMesh 或 DynamicMeshBatch
```

### 6.2 动态角色

```text
Feature Cage / Parametric Recipe
└─ Feature Mesh Compiler
   └─ Core MeshPlan + Feature Extension
      ↓
Feature State -> Feature MeshEvaluator
      ↓
Core VertexStreams + MeshDirty
      ↓
CompiledMeshBatchRenderer -> DynamicMeshBatch
```

### 6.3 异构环境原型

```text
ENVIRONMENT_PROTOTYPE_CATALOG
├─ config / capacity / collision
├─ recipe / planFactory
└─ stable order
   ↓
StaticPrototypeMeshPlan[]
   ↓
Heterogeneous MeshPlanComposer
├─ section offsets
├─ repeated fixed indices
└─ typed stream layout
   ↓
Instance Transform Evaluator
   ↓
Single DynamicMeshBatch
```

## 7. 不建议的抽象

1. 不做 `geometry.model().tube().grid().material().render()` 式万能 DSL。
2. 不把 Lobby Cave Relief、Battlefield World Noise、角色骨骼规则塞进 core。
3. 不用一个充满 `flat/smooth/static/dynamic/lit/unlit` 布尔参数的统一 Renderer。
4. 不把 Crawler 动态平滑 Tube 与 Environment 静态硬分面 Tube 强行合并。
5. 不自动镜像 Vanguard 全部造型；当前左右差异是美术轮廓的一部分。
6. 不把 Observation Wall 的矩形边界求交伪装成通用 Grid。
7. 第二个骨骼 Cage 角色出现前，不做庞大的通用角色建模框架。

## 8. 推荐迁移顺序

### P0：无视觉变化的基础提取

1. **已完成**：提取 Faceted Triangle/Quad/Orientation kernel 与窄 Sink 契约。
2. **已完成**：将 `GeometrySectionComposer` 从 Lobby 晋升 core，并收窄为游标契约。
3. **已完成**：提取 Vanguard 使用的 Sequential Flat Normal kernel。
4. **已完成**：用黄金测试锁定 Lobby、Ground、八种 Environment 原型的完整 TypedArray 输出。
5. **已验证**：保持原拓扑计数、Ground seam、Section range 与现有视觉配方不变。

### P1：Grid 的第二消费者收敛

1. **已完成**：将 `SurfaceFrame`、`FlatGridPlan`、Workspace 与 Emitter 迁入 core。
2. **已完成**：Lobby 使用独立 `LobbyGridSampler`，Cave/Jitter 与 seed 继续留在 Feature。
3. **已完成**：Ground 使用绝对世界格点 sampler adapter，并长期复用 Float32 Workspace 与 PatchFrame。
4. **已完成**：用类型化策略锁定两种对角线各自的三角形顺序，不使用业务布尔参数。
5. **已验证**：完整黄金哈希、相邻 Chunk 高度/颜色 seam 与初始化后固定 Index 契约保持不变。

### P2：Radial Profile 收敛

1. **已完成**：提取 Ring Sample、相邻环连接、Fan、绕序、三角形顺序和拓扑 Pass。
2. **已完成**：Lobby 顶灯、吊线、仪式灯、双层祭台接入 Core Radial，领域 Ring 清单与扰动保留。
3. **已完成**：Tree、Mushroom、Rock、Pool、Crystal、GlowPlant、Wreck Wheel 与 Environment Altar 的 Tube/Shell 接入同一 Kernel。
4. **已完成**：Observation Wall 复用 SegmentSequence 环连接，矩形边界求交仍留在 Lobby；厚框专属拓扑不强行泛化。
5. **已验证**：Lobby Opaque/Emissive 和八种环境原型完整哈希、三角形计数、法线与 facetVariants 不变。
6. **已裁决**：当前无双面 Radial Cap 消费者，不制造空策略；Vanguard Headwear 因 Cage/ridge 契约不同留在角色模块。

### P3：Environment Catalog 与异构 Plan Composer

1. **已完成**：以唯一有序 Catalog 合并稳定 ID/键、容量、碰撞、缩放、顺序和 `compilePlan`，删除 enum/ordered/config/plan 四套平行表。
2. **已完成**：提取 Core `composeRepeatedMeshPlans()`，统一计数、Section 偏移、重复局部 Index 和 Uint16/Uint32 容量校验。
3. **已完成**：Environment Mega Mesh 绑定 `UNLIT_COLOR_LAYOUT`，Evaluator、Geometry 与 Cocos 属性只包含 Position/Color，移除约 `5.2 MiB` CPU Normal。
4. **已完成**：Environment Population 显式调用 `prepareBattlefieldEnvironment()` 一次并复用结果，模块顶层不再编译原型或 Mega Index。
5. **已验证**：仍为一个 MeshRenderer 策略、一个 Uint32 Index 批次，Section 连续不重叠，八种原型黄金哈希保持不变。

### P4：角色作者工具按需求扩展

第二个骨骼 Cage 消费者出现后，再提取 Semantic Cage、Ring/Band Cage Adapter 与通用双权重 Skinning。迁移直接对齐目标契约，不保留新旧双路径、回退映射或兼容分支。

## 9. 预估收益

| 范围 | 预估净减少 | 主要收益 | 风险 |
| --- | ---: | --- | --- |
| P0 Faceted + Section | 180–280 行 | 消除 4 套法线/绕序与区段游标 | 低 |
| P1 Grid | 90–160 行 | Lobby/Ground 共享拓扑，测试集中 | 低至中 |
| P2 Radial Profile | 160–260 行 | Tree/Mushroom/Lamp/Altar 配方化 | 中 |
| P3 Catalog/Layout/Vertex Layout | 100–180 行 | 新原型接入点减少，去掉无用流 | 中 |
| P4 Character Authoring | 150–300 行 | 第二角色出现后复用 Cage Band/Ring | 当前不建议立即做 |

P0–P3 预估净减少约 `530–880` 行，即当前 Feature 建模/渲染代码的约 `8%–13%`。更大的收益是后续增长速度：新增树种、蘑菇、祭台、灯具或地表 Patch 时，主要增加 Recipe 数据，不再复制拓扑循环。

如果目标是一次删除 30% 以上代码，只能把大量显式艺术数据塞进高度参数化 DSL；这会降低造型可读性、调试定位和受控不对称能力，不建议以代码行数为唯一目标。

## 10. 验收门槛

1. 固定 seed 下 Position、Normal、Color 和 Index 哈希一致。
2. Lobby `1,528/88/32`、Ground `20,000`、Tree `276`、Mushroom `156`、Vanguard `695` 三角形计数不变。
3. Ground 跨相邻 Chunk 的重叠世界格点与颜色连续。
4. 普通 Flat Emitter 拒绝退化面；明确依赖稳定顶点计数的固定拓扑入口保留原 epsilon 钳制策略。
5. Environment Mega Mesh 仍为一个 Uint32 批次，Index 不越界。
6. 动态姿态只上传 Position/Normal，事件颜色才上传 Color。
7. Geometry 不创建 Cocos 资源，Rendering 不承载领域造型算法。
8. 没有逐帧临时对象、数组或 Cocos Vec 分配。

## 11. 已请专家裁决的问题（历史）

以下问题均已在[专家裁决](../call_tree模块化方案.md)中得到答复，保留在这里用于追溯决策输入。

1. Battlefield 已成为第二个消费者后，是否同意把 `SurfaceFrame`、Flat Grid 和 Section Composer 晋升 `assets/core`？
2. Faceted 能力应采用“Emitter + Attribute Sink”，还是带泛型 metadata 的统一 Builder？
3. Radial Profile 应只包含轮廓采样、环连接、端盖，还是也包含确定性扰动策略？
4. Environment Mega Mesh 是否值得抽为通用 Heterogeneous MeshPlan Composer，还是保持 Battlefield 专用？
5. Environment Prototype 是否应改为单一类型化 Catalog，并由它派生稳定顺序、配置和 Plan？
6. 是否应引入精确 Vertex Layout，解决 Unlit 大网格仍分配 Normal 的问题？
7. 模块顶层立即编译 MeshPlan 是否继续作为约定，还是在 Feature prepare 阶段显式编译和缓存？
8. Crawler Tube 与 Environment Radial Shell 应只共享采样/索引基础，还是存在更高层共同契约？
9. Vanguard 是否应等第二个骨骼角色出现后再泛化？
10. 本次重构优先级如何排序：减少代码、降低新增模型成本、减少 CPU/内存，还是保持艺术代码直观？

## 12. 最终建议

建议批准“中层原语库 + 类型化计划组合器”，暂缓“统一模型 DSL”。

```text
领域配方决定长什么样
Core Primitive 决定如何稳定地产生拓扑
MeshPlan 决定哪些数据固定
Evaluator 决定哪些流何时变化
Renderer Adapter 决定如何提交 Cocos
```

这个边界能明显减少大厅、战场、树木、蘑菇和后续道具的机械代码，同时保留项目最重要的 Low Poly 领域轮廓、确定性不规则性和可读的美术意图。
