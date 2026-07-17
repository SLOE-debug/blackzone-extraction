# 程序化 Low Poly 术语、调用树与技术路线

## 1. 文档目的

本文记录项目当前三套代码生成三维内容的真实调用链：正面人类英雄 `Vanguard`、大厅壳体，以及大厅观察窗后的 `Curve Crawler`。

## 2. 推荐术语

对外可统称为：**程序化 Low Poly 网格生成**（Procedural low-poly mesh generation）。

其中 Low Poly 描述艺术与拓扑目标；procedural/programmatic 描述由 TypeScript 直接生成 Position、Normal、Color 和 Index 的方法。

## 3. 当前共享数据流

```mermaid
flowchart LR
  Domain["领域控制数据 / SoA 状态"] --> Compiler["Mesh Compiler（初始化一次）"]
  Compiler --> Plan["MeshPlan：局部 Index、映射、采样、语义"]
  Plan --> Batch["CompiledMeshBatchRenderer：复制偏移 Index"]
  Domain --> Evaluator["Mesh Evaluator（按 Dirty 求值）"]
  Plan --> Evaluator
  Evaluator --> Streams["VertexStreams：Position / Normal / Color"]
  Streams --> Adapter["DynamicMeshBatch：仅上传变化属性"]
  Adapter --> Cocos["Cocos Mesh + MeshRenderer + Material"]
```

大厅是静态场景：它仍在初始化期通过 `TriangleMeshWriter` 写入固定几何，再由 `StaticSurfaceMesh` 上传；无需为了形式统一进入动态 Plan 路径。

## 4. 核心模块

| 模块 | 职责 |
| --- | --- |
| `assets/core/mesh/mesh-plan.ts` | 单实体固定局部拓扑及索引校验 |
| `assets/core/mesh/mesh-dirty.ts` | Pose、Color、Bounds 的类型化更新位标志 |
| `assets/core/mesh/vertex-streams.ts` | 复用 `SurfaceBufferGeometry` 的零拷贝动态流视图 |
| `assets/core/mesh/mesh-evaluator.ts` | 领域状态到运行时顶点流的泛型契约 |
| `assets/core/rendering/compiled-mesh-batch-renderer.ts` | 初始化固定批索引、按 Dirty 调用 Evaluator |
| `assets/core/rendering/dynamic-mesh-batch.ts` | Cocos Dynamic Mesh 与 Position / Normal / Color 属性级上传 |

## 5. 三套技术路线对比

| 维度 | Vanguard 玩家 | 大厅墙体 | Curve Crawler 蜘蛛 |
| --- | --- | --- | --- |
| 生成类型 | 动态程序化角色 | 静态程序化场景 | 动态程序化群体 |
| 编译输入 | 显式人形控制笼 | Grid Recipe / 径向墙体配方 | Tube / Ellipsoid / Fan 采样配方 |
| 每帧输入 | SoA 骨骼矩阵 | 无 | SoA 行为、移动、动画、死亡状态 |
| 固定数据 | Index、控制点映射、语义与颜色变体 | 全部 Geometry | Index、Bezier 系数、采样方向、语义 |
| Position / Normal | `MeshDirty.Pose` | 初始化一次 | `MeshDirty.Pose` |
| Color | 初始化烘焙 | 初始化一次 | 受击 / 液化事件才更新 |
| Cocos 适配 | `CompiledMeshBatchRenderer` | `StaticSurfaceMesh` | `CompiledMeshBatchRenderer` |
| 受光 | Standard 动态法线流 | Standard / Unlit | Standard 动态法线流 |

## 6. 调用树入口

- [玩家 Vanguard：编译控制笼、CPU 骨骼变形与动态流](call-trees/vanguard.md)
- [大厅墙壁：参数化 Grid Recipe、洞穴形变与静态 Mesh](call-trees/lobby-walls.md)
- [Curve Crawler：Bundle 加载、预编译采样与事件颜色流](call-trees/curve-crawler.md)

## 7. 当前约束

- `MeshPlan` 只在初始化期构建；运行期不得重写固定 Index。
- `MeshDirty.Pose` 是 Position 与 Normal 的原子对，避免新法线与旧位置混用。
- `Color` 是独立事件流；普通姿态更新不得重传 Color。
- Geometry 不创建 Cocos Node、Material 或 MeshRenderer；Rendering 不理解骨骼、腿部步态或领域拓扑。
- Cocos Standard 动态网格必须创建并更新 Normal 顶点流。
