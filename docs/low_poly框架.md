## 结论先拍死：**完全可以，而且现在正是该模块化的时候**

但我会区分两个词：

* **现在应该立刻模块化**：消灭大厅里四面墙、地板、天花板重复的网格遍历和三角形写入。
* **可以逐步框架化**：把已经被 Lobby 和怪物共同验证过的拓扑模板、原语、Section、渲染适配器提进 `core`。
* **暂时不要做万能建模 DSL**：不要搞成 `geometry.wall().noise().cave().material().render()` 这种包办所有业务的大 Builder。

你现在的核心问题不是“代码不会复用”，而是：

> **建模算法、场景数据、艺术形变公式和渲染装配，混在同一批函数里了。**

从你给的评审看，大厅四面墙本质上都是“带扰动的参数化 Grid”，差异只是朝向、尺寸、细分数量、形变参数和绕序；地面与天花板其实也是同一类参数化曲面。Lobby 又是初始化时只生成一次，严格 Flat Shading，每个三角形独占三个顶点。

所以，最适合你的第一刀不是抽 `WallBuilder`，而是抽：

# 一、真正该抽的是 `ParametricGridPatch`

你现在大概率存在类似结构：

```text
createBackWall()
  ├─ 建网格点
  ├─ 算洞穴扰动
  ├─ 遍历格子
  ├─ 交替对角线
  └─ appendLobbyTriangle()

createFrontWall()
  ├─ 建网格点
  ├─ 算洞穴扰动
  ├─ 遍历格子
  ├─ 交替对角线
  └─ appendLobbyTriangle()

createLeftWall()
createRightWall()
```

这些函数真正不同的只有：

```text
局部 U 轴
局部 V 轴
表面法线 N
原点
宽高
细分
扰动函数参数
三角形绕序
```

正确结构应该变成：

```text
一个 GridPatch 发射算法
+
四份 WallSpec 数据
+
一个或几个 Lobby 专属形变函数
```

也就是：

专属```text
算法只写一次
内容用数据描述
艺术公式继续留在 Lobby

````

---

# 二、先建立局部曲面坐标系，而不是写“前墙、后墙、左墙”

这是消灭墙面分支的关键。

```ts
export interface SurfaceFrame {
  readonly originX: number;
  readonly originY: number;
  readonly originZ: number;

  // 曲面横向
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;

  // 曲面纵向
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;

  // 曲面向外或向内的法线方向
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}
````

任何墙面上的点都用同一个公式：

```ts
P = Origin + U * localU + V * localV + N * displacement;
```

这样：

| 表面  | U      | V | N  |
| --- | ------ | - | -- |
| 后墙  | X      | Y | Z  |
| 前墙  | -X 或 X | Y | -Z |
| 左墙  | Z      | Y | X  |
| 右墙  | -Z 或 Z | Y | -X |
| 地面  | X      | Z | Y  |
| 天花板 | X      | Z | -Y |

你不需要在通用 Grid 算法里判断：

```ts
if (wall === 'back') ...
else if (wall === 'left') ...
```

只要传入不同 `SurfaceFrame`。

这也解决了你文档里 Lobby 使用 Y-up、Crawler 使用 Z-up 的冲突：**原语本身不认识世界轴，只认识局部 U/V/N。**

---

# 三、建议的第一阶段接口

不要一开始就把接口设计得巨复杂。Lobby 是静态生成，回调开销完全不重要，先把可读性做好。

```ts
export interface LocalSurfacePoint {
  u: number;
  v: number;
  n: number;
}

export interface GridPatchSpec<TContext> {
  readonly section: string;

  readonly columns: number;
  readonly rows: number;

  readonly width: number;
  readonly height: number;

  readonly frame: SurfaceFrame;

  /**
   * 输入归一化参数 u01、v01，
   * 输出局部曲面坐标 u、v、n。
   *
   * 允许同时修改切向位置和法向位移，
   * 因此不局限于普通 Height Field。
   */
  readonly sampleLocal: (
    out: LocalSurfacePoint,
    u01: number,
    v01: number,
    context: Readonly<TContext>,
  ) => void;

  readonly diagonal?: 'forward' | 'backward' | 'alternating';

  /**
   * 控制三角形朝向。
   */
  readonly flipWinding?: boolean;
}
```

然后只有一个网格生成器：

```ts
export function appendFlatGridPatch<TContext>(
  writer: TriangleMeshWriter,
  spec: Readonly<GridPatchSpec<TContext>>,
  context: Readonly<TContext>,
): void {
  const vertexColumns = spec.columns + 1;
  const vertexRows = spec.rows + 1;

  const pointCount = vertexColumns * vertexRows;
  const positions = new Float32Array(pointCount * 3);

  const local: LocalSurfacePoint = { u: 0, v: 0, n: 0 };

  for (let row = 0; row < vertexRows; row++) {
    const v01 = row / spec.rows;

    for (let column = 0; column < vertexColumns; column++) {
      const u01 = column / spec.columns;

      spec.sampleLocal(local, u01, v01, context);

      const index = (row * vertexColumns + column) * 3;
      const frame = spec.frame;

      positions[index] =
        frame.originX +
        frame.ux * local.u +
        frame.vx * local.v +
        frame.nx * local.n;

      positions[index + 1] =
        frame.originY +
        frame.uy * local.u +
        frame.vy * local.v +
        frame.ny * local.n;

      positions[index + 2] =
        frame.originZ +
        frame.uz * local.u +
        frame.vz * local.v +
        frame.nz * local.n;
    }
  }

  for (let row = 0; row < spec.rows; row++) {
    for (let column = 0; column < spec.columns; column++) {
      const a = row * vertexColumns + column;
      const b = a + 1;
      const c = a + vertexColumns;
      const d = c + 1;

      const backward =
        spec.diagonal === 'backward' ||
        (spec.diagonal === 'alternating' &&
          ((row + column) & 1) !== 0);

      if (backward) {
        appendIndexedFlatTriangle(
          writer,
          positions,
          spec.flipWinding ? a : a,
          spec.flipWinding ? d : c,
          spec.flipWinding ? c : d,
        );

        appendIndexedFlatTriangle(
          writer,
          positions,
          spec.flipWinding ? a : a,
          spec.flipWinding ? b : d,
          spec.flipWinding ? d : b,
        );
      } else {
        appendIndexedFlatTriangle(
          writer,
          positions,
          spec.flipWinding ? a : a,
          spec.flipWinding ? b : c,
          spec.flipWinding ? c : b,
        );

        appendIndexedFlatTriangle(
          writer,
          positions,
          spec.flipWinding ? b : b,
          spec.flipWinding ? d : c,
          spec.flipWinding ? c : d,
        );
      }
    }
  }
}
```

上面绕序部分可以进一步整理成 `appendFlatQuad()`，这里只是展示职责分离。

需要注意：你的 Lobby 是严格 Flat Shading，所以这个生成器虽然先缓存共享的网格采样点，最终依然应该通过 `appendLobbyTriangle()` 展开成每三角形三个独立顶点。

**Flat/Smooth 不是简单的法线后处理选项。它会影响顶点是否共享，因此属于拓扑契约。**

---

# 四、四面墙最终应该只是四条数据

例如：

```ts
interface CaveWallContext {
  readonly seed: number;
  readonly roughness: number;
  readonly bulge: number;
  readonly ridgeStrength: number;
}

function createCaveWallSpec(
  section: string,
  frame: SurfaceFrame,
  width: number,
  height: number,
  columns: number,
  rows: number,
): GridPatchSpec<CaveWallContext> {
  return {
    section,
    frame,
    width,
    height,
    columns,
    rows,
    diagonal: 'alternating',

    sampleLocal(out, u01, v01, context): void {
      const centeredU = u01 - 0.5;
      const centeredV = v01 - 0.5;

      out.u = centeredU * width;
      out.v = centeredV * height;

      const edgeFade =
        Math.sin(Math.PI * u01) *
        Math.sin(Math.PI * v01);

      const irregularity =
        Math.sin(
          u01 * 13.71 +
          v01 * 7.31 +
          context.seed * 1.17,
        ) *
        context.roughness;

      const bulge =
        (1 - centeredU * centeredU * 4) *
        edgeFade *
        context.bulge;

      const ridge =
        Math.sin(v01 * Math.PI * 3 + context.seed) *
        edgeFade *
        context.ridgeStrength;

      out.n = irregularity + bulge + ridge;
    },
  };
}
```

大厅壳体就变成：

```ts
const lobbyShellSpecs = [
  createCaveWallSpec(
    'back-wall',
    BACK_WALL_FRAME,
    roomWidth,
    roomHeight,
    10,
    7,
  ),

  createCaveWallSpec(
    'front-wall',
    FRONT_WALL_FRAME,
    roomWidth,
    roomHeight,
    10,
    7,
  ),

  createCaveWallSpec(
    'left-wall',
    LEFT_WALL_FRAME,
    roomDepth,
    roomHeight,
    12,
    7,
  ),

  createCaveWallSpec(
    'right-wall',
    RIGHT_WALL_FRAME,
    roomDepth,
    roomHeight,
    12,
    7,
  ),
] satisfies readonly GridPatchSpec<CaveWallContext>[];

for (const spec of lobbyShellSpecs) {
  sections.write(spec.section, () => {
    appendFlatGridPatch(writer, spec, {
      seed: seedForSection(spec.section),
      roughness: 0.14,
      bulge: 0.32,
      ridgeStrength: 0.12,
    });
  });
}
```

至此，原来的：

```text
四份墙面循环
四份点位计算
四份格子拆分
四份三角形写入
四份绕序处理
```

会变成：

```text
一份 Grid 算法
一份 Cave Wall 形变
四份数据描述
```

新增第五面特殊墙时，也只是新增一条 Spec，或者换一个 `sampleLocal()`。

---

# 五、再进一步：地板、天花板、墙都可以统一成 `SurfacePatch`

墙面只是一个平面参数化曲面。

你可以得到：

```text
SurfacePatch
├─ CaveWallPatch
├─ CaveFloorPatch
├─ CaveCeilingPatch
├─ CurvedPanelPatch
└─ TerrainPatch
```

它们共用：

* 网格采样；
* 局部坐标到世界坐标的映射；
* 格子三角剖分；
* Flat Normal 写入；
* Metrics 计算；
* Section 范围记录。

它们只替换：

* `SurfaceFrame`；
* `sampleLocal()`；
* 分段数量；
* 对角线策略。

这才是正确的框架化：**统一生成机制，不统一艺术公式。**

洞穴隆起、边缘衰减、祭台尺寸仍然属于 Lobby，不应该进入 `core`。

---

# 六、我建议的目录边界

第一阶段不要急着全部扔进 `assets/core`。

```text
assets/lobby/geometry/
├─ infrastructure/
│  ├─ surface-frame.ts
│  ├─ grid-patch.ts
│  └─ lobby-section-composer.ts
│
├─ deformers/
│  ├─ cave-wall-deformer.ts
│  ├─ cave-floor-deformer.ts
│  └─ cave-ceiling-deformer.ts
│
├─ recipes/
│  ├─ lobby-shell-recipe.ts
│  ├─ lobby-altar-recipe.ts
│  └─ lobby-lighting-geometry-recipe.ts
│
├─ lobby-hall-geometry.ts
└─ lobby-opaque-geometry.ts
```

等第二个场景也开始使用 `SurfaceFrame` 和 `GridPatch`，再提升：

```text
assets/core/geometry/surfaces/
├─ surface-frame.ts
├─ parametric-grid-template.ts
├─ flat-grid-emitter.ts
└─ smooth-grid-evaluator.ts
```

一个很好用的晋升规则是：

> **只有存在两个真实消费者，并且两边没有为了复用而增加业务分支时，才把东西提进 core。**

否则先留在 `lobby/geometry/infrastructure`。

---

# 七、你的整体框架可以分成五层

```text
┌──────────────────────────────────────────────┐
│ Feature Recipe                               │
│ Lobby 布局、祭台结构、洞穴参数、墙面清单       │
├──────────────────────────────────────────────┤
│ Feature Evaluator / Deformer                 │
│ caveWall、floorCrack、crawlerLegPose          │
├──────────────────────────────────────────────┤
│ Primitive Template                           │
│ Grid、Fan、Ribbon、RadialShell、Tube、Ellipsoid│
├──────────────────────────────────────────────┤
│ Geometry Kernel                              │
│ BufferGeometry、Writer、Metrics、Section      │
├──────────────────────────────────────────────┤
│ Renderer Adapter                             │
│ StaticSurface / FixedTopologyDynamicBatch     │
└──────────────────────────────────────────────┘
```

## 1. Geometry Kernel

保留当前已有的：

* `BufferGeometry`
* `TriangleMeshWriter`
* `FixedTopologyMetrics`
* TypedArray
* Bounds
* Section Range

这是最底层，不认识 Lobby，也不认识怪物。

## 2. Primitive Template

负责：

* 固定采样参数；
* 固定索引；
* 精确 Metrics；
* 顶点布局规则。

例如：

```ts
interface PrimitiveTopologyTemplate {
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;

  writeIndices(
    indices: Uint16Array | Uint32Array,
    indexOffset: number,
    baseVertex: number,
  ): void;
}
```

## 3. Evaluator

负责根据业务参数写顶点：

```ts
interface PrimitiveVertexEvaluator<TParams> {
  evaluate(
    positions: Float32Array,
    normals: Float32Array | undefined,
    vertexOffset: number,
    params: Readonly<TParams>,
  ): void;
}
```

## 4. Recipe

负责组合多个原语：

```text
Lobby Recipe
├─ Room Shell
│  ├─ Floor Grid
│  ├─ Ceiling Grid
│  └─ Four Wall Grids
├─ Altar Radial Shell
├─ Circular Panel
├─ Character Placeholder
└─ Lights
```

## 5. Renderer Adapter

静态和动态不要强行合并。

```text
Static Adapter
├─ 初始化时 evaluate 一次
├─ 上传 Position/Normal/Color/UV/Index
├─ 精确 Bounds
└─ 后续不更新

Dynamic Adapter
├─ Index 初始化一次
├─ 每帧 evaluate Position/Normal/Color
├─ 只上传脏流
└─ 更新保守 Bounds
```

它们可以共享模板，但不应共享一个充满布尔参数的万能 Renderer。

---

# 八、`Semantic Section` 非常值得正式抽出来

Lobby 有：

```text
Floor
FloorCracks
Ceiling
Walls
Altar
Character
Lamp
```

Crawler 有：

```text
Body
Eyes
Liquid
```

这些不是材质 Layer，而是**语义范围**。

建议：

```ts
export interface GeometrySection {
  readonly name: string;

  readonly firstVertex: number;
  readonly vertexCount: number;

  readonly firstIndex: number;
  readonly indexCount: number;
}
```

配一个 Composer：

```ts
const sections = new GeometrySectionComposer(writer);

sections.write('floor', () => {
  appendFlatGridPatch(writer, floorSpec, context);
});

sections.write('walls', () => {
  for (const wall of walls) {
    appendFlatGridPatch(writer, wall, context);
  }
});

sections.write('altar', () => {
  appendAltar(writer, altarSpec);
});
```

最后：

```ts
const floorRange = sections.get('floor');
const wallRange = sections.get('walls');
```

这样顶点着色不再手算偏移：

```ts
colorVertices(geometry.colors, sections.get('walls'), wallPalette);
```

你文档里提到的 Section-major 偏移公式，就是非常适合被这个组件消灭的冗余。

但需要注意：

* `Semantic Section` 是内容语义；
* `Render Layer` 是 Draw Call / Material；
* 两者不是一回事。

多个 Section 可以进入同一 Layer：

```text
Floor + Walls + Altar
        ↓
LobbyOpaqueSurface
```

Body、Eyes、Liquid 也可以进入同一个 Unlit Layer。

---

# 九、Lobby Renderer 里另一类冗余也应该去掉

你现在三个静态 Mesh 很可能都在重复：

```text
分配 Geometry
创建 Writer
调用 Source
提交 Writer
计算颜色
创建 Material
初始化 StaticSurfaceMesh
设置阴影
异常时销毁
```

可以抽一个静态 Layer 定义：

```ts
interface StaticGeometryLayerDefinition<TContext> {
  readonly name: string;
  readonly profile:
    | 'static-lit'
    | 'static-unlit';

  readonly createGeometry: (
    context: Readonly<TContext>,
  ) => StaticGeometryBuildResult;

  readonly createMaterial: () => Material;

  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
}
```

LobbyRenderer 只保留：

```ts
const layers = [
  lobbyOpaqueLayer,
  lobbyLampGlowLayer,
  lobbyRitualGlowLayer,
];

this.geometrySet = new StaticGeometrySetRenderer(
  node,
  layers,
  context,
);
```

这属于非常安全的抽象，因为它不改变几何生成和视觉，只统一生命周期与异常回滚。

---

# 十、Crawler 也应该框架化，但和 Lobby 不是同一个优先级

大厅的冗余是**工程可维护性问题**。

Crawler 当前的问题则是**每帧重复工作问题**。

你现在虽然固定 Index Buffer 没上传，但每帧仍可能执行：

```ts
for each entity
  for each primitive
    for each segment
      sin/cos
      evaluate vertex
      writer.triangle(...)
```

这里应该变成：

```text
初始化：
├─ 创建 TubeTemplate
├─ 缓存 t 参数
├─ 缓存圆环 sin/cos
├─ 写一次 Index
└─ 固定 Section Layout

每帧：
├─ 计算 Curve 控制点
├─ 根据缓存采样评估 Position
├─ 计算 Normal
├─ 必要时计算 Color
└─ 上传动态流
```

核心接口可以是：

```ts
interface LowPolyPrimitiveTemplate<TParams> {
  readonly metrics: FixedTopologyMetrics;

  writeIndices(
    target: Uint16Array | Uint32Array,
    indexOffset: number,
    baseVertex: number,
  ): void;

  evaluateVertices(
    target: DynamicVertexStreams,
    vertexOffset: number,
    params: Readonly<TParams>,
  ): void;
}
```

重点不是接口名字，而是：

> `writeIndices()` 和 `evaluateVertices()` 必须成为两条真正独立的路径。

`writer.reset(false)` 只是“不覆盖 Index 数据”，并不代表 CPU 没有再次执行拓扑连接循环。

---

# 十一、Flat 与 Smooth 必须在模板层区分

这个问题非常重要。

## Flat

两个相邻三角形即使空间位置相同，也不能共享同一个顶点，因为它们的法线不同：

```text
Triangle A vertex: position P, normal NA
Triangle B vertex: position P, normal NB
```

因此 Grid 的 Flat Metrics 是：

```text
triangleCount = columns × rows × 2
vertexCount   = triangleCount × 3
indexCount    = triangleCount × 3
```

## Smooth

共享网格点：

```text
vertexCount = (columns + 1) × (rows + 1)
```

所以不要设计成：

```ts
buildGrid();
applyFlatNormals();
```

然后以为拓扑不用变。

更合理的是：

```ts
type NormalMode =
  | { readonly kind: 'flat' }
  | { readonly kind: 'analytic-smooth' }
  | { readonly kind: 'custom' };
```

模板创建时就确定模式：

```ts
createGridTemplate({
  columns: 10,
  rows: 7,
  normalMode: { kind: 'flat' },
});
```

---

# 十二、坐标系：不要强制所有业务统一到 Cocos Y-up

我的建议是：

```text
世界仍然使用 Cocos Y-up
原语模板使用无轴参数空间
实例化时提供 SurfaceFrame / CoordinateBasis
业务状态继续使用最适合自己的坐标表达
```

也就是说：

* Lobby 世界空间按 Y-up；
* Crawler 状态继续用 XY 运动平面、Z 高度也没关系；
* Crawler 的 Evaluator 最终通过 Basis 映射到渲染世界；
* Core 不硬编码“Z 一定是高度”。

统一所有领域数据到 Y-up，往往只会导致怪物行为代码变得别扭，并不会真正减少复杂度。

---

# 十三、CPU 顶点色暂时不用急着推翻

100 个 Crawler：

```text
58,100 个顶点
84,200 个三角形
每帧上传约 1.55 MiB
```

单看 GPU 三角形数量并不夸张。

更可能先成为瓶颈的是：

* Tube 局部坐标基计算；
* 每段三角函数；
* 每帧拓扑循环；
* Normal 计算；
* CPU 顶点色；
* JavaScript/TypeScript 函数调用；
* Cocos Buffer 更新路径。

合理顺序应该是：

```text
1. 固定 Index 真正模板化
2. 缓存 sin/cos 和采样参数
3. 基准测试
4. 支持 Position/Color 独立 Dirty
5. 再决定是否把光照迁移到 Shader
```

Color 通常不需要每帧全部更新。

例如：

```ts
enum VertexStreamDirty {
  None = 0,
  Position = 1 << 0,
  Normal = 1 << 1,
  Color = 1 << 2,
}
```

普通移动时：

```ts
dirty = Position | Normal;
```

受击、死亡、液体颜色变化时：

```ts
dirty |= Color;
```

不过如果当前 Shader 只上传 Position 和 Color，Normal 只用于 CPU shading，那么位置一变化，CPU Color 也会因为光照方向变化而变化。此时可以考虑：

1. 保留 CPU 光照：Position 与 Color 一起更新；
2. GPU 上传 Normal：状态 Tint 低频更新，光照进 Shader。

哪种更好必须以目标设备基准为准，不宜凭设计直觉直接重写。

以未经实测的工程判断：

|    实体规模 | 当前路线判断                           |
| ------: | -------------------------------- |
|    1–50 | 大概率完全合理                          |
|  50–100 | 应做模板缓存并基准测试                      |
| 100–300 | 需要 Dirty Stream、分批和 CPU/GPU 光照对比 |
|    300+ | 应考虑 LOD、实例化替代、Shader 动画或简化远处拓扑   |

这不是性能承诺，只是决定何时升级架构的分界线。

---

# 十四、Section-major 可以支持，但不要定为唯一布局

当前 Crawler：

```text
所有 Body
所有 Eyes
所有 Liquid
```

这是 Section-major。

优点：

* 同类区段连续；
* 着色和状态操作方便；
* 一个 Layer 合并容易。

缺点：

* 单实体数据不连续；
* 按实体 Dirty Range 更新困难；
* 删除或重排实体复杂；
* 未来按实体剔除不方便。

建议 Core 支持显式布局：

```ts
type GeometryLayout =
  | 'entity-major'
  | 'section-major';
```

甚至动态实体更推荐：

```text
Chunk-major
└─ Entity-major
   ├─ Body
   ├─ Eyes
   └─ Liquid
```

例如每批 64 个实体。这样：

* 批次级剔除和 Bounds 更合理；
* Uint16 更容易使用；
* 某一批实体活跃时只更新该批；
* 不需要一个无限大的 Uint32 Mesh。

Section-major 可以成为正式能力，但不应该成为整个 Core 的默认事实。

---

# 十五、Degenerate Geometry 可以保留，但要有使用边界

固定拓扑下，把隐藏表面退化为零面积三角形是合理策略，尤其是：

* 眼睛眨眼；
* 液体消失；
* 短时间死亡过渡；
* 每实体只有少量隐藏面。

注意三件事：

1. 退化顶点仍然可能参与顶点处理；
2. 隐藏位置必须稳定，不要产生 NaN；
3. 不要把顶点全部扔到世界原点，导致 Bounds 或异常拉伸。

建议提供统一方法：

```ts
collapsePrimitiveToPoint(
  positions,
  vertexOffset,
  vertexCount,
  sinkX,
  sinkY,
  sinkZ,
);
```

如果大量实体长期隐藏，则应该做：

* Active Entity Compaction；
* 批次重建；
* 或实体 Chunk 启停。

Degenerate 更适合“小区段短时间隐藏”，不是通用实体删除机制。

---

# 十六、最容易走偏的几个方案

## 1. 万能 `GeometryBuilder`

类似：

```ts
builder
  .wall()
  .noise()
  .bulge()
  .flat()
  .material()
  .shadow()
  .addToScene();
```

问题是 Geometry、材质、场景节点和业务公式重新耦合到一起。

## 2. 为每种方向保留一个 Wall 函数

```ts
appendBackWall()
appendFrontWall()
appendLeftWall()
appendRightWall()
```

这只是把重复代码移动了位置，没有解决抽象问题。

正确方向是：

```ts
appendGridPatch(spec)
```

## 3. 把洞穴算法塞进 Core

例如：

```ts
core.createCaveWall(...)
```

`Cave` 是 Lobby 领域概念，不是通用 Geometry 原语。

Core 应该只知道：

```text
Grid Patch
Surface Frame
Displacement Evaluator
Flat/Smooth Topology
```

## 4. 强行合并 Static 和 Dynamic Renderer

最后会出现：

```ts
dynamic?: boolean;
uploadNormal?: boolean;
fixedIndex?: boolean;
recalculateBounds?: boolean;
updateColor?: boolean;
createOnce?: boolean;
```

这种配置对象会迅速失控。

共享下层协议，保留两个 Adapter，反而更干净。

---

# 十七、推荐实施顺序

## 第一步：只改 Lobby，不动视觉

先实现：

```text
SurfaceFrame
GridPatchSpec
appendFlatGridPatch
GeometrySectionComposer
Lobby Shell Specs
```

把四面墙迁移成数据清单。

验收标准：

```text
三角形数量完全一致
顶点数量完全一致
三角形绕序一致
分面法线一致
固定种子下 Position 一致
最终截图一致
```

## 第二步：统一地面和天花板的 Grid 基础设施

不要求它们使用同一个形变函数，只共享 Patch 发射器。

## 第三步：提取静态 Layer 装配器

消灭 `LobbyRenderer` 中三个 Mesh 重复的创建、提交、材质、异常回滚逻辑。

## 第四步：抽 Fan、Ribbon、Radial Shell

它们在现有代码中已具有明确复用价值：

```text
Fan：Lobby 圆面 + Crawler Liquid
Grid：Lobby 多个表面
Ribbon：裂纹、轨迹和路径面
Radial Shell：祭台、灯座、圆环
```

## 第五步：模板化 Ellipsoid 与 Tube

把固定 Index、采样参数和 `sin/cos` 移到初始化。

## 第六步：第二个真实消费者出现后再晋升 Core

第二种怪物或第二个程序化场景，会告诉你哪些接口是真稳定的，哪些只是 Lobby 偶然需要。

---

# 十八、对你文档中十个问题的直接回答

| 问题                           | 我的判断                                                                |
| ---------------------------- | ------------------------------------------------------------------- |
| 框架边界停在哪                      | 停在 Primitive Template + Evaluator + Section + Renderer Adapter，非常合适 |
| Static/Dynamic 是否共享 Renderer | 不共享上层 Renderer，只共享模板、流布局和生命周期协议                                     |
| 坐标基怎么处理                      | 无轴局部模板 + 显式 Basis；不要强制所有业务改为 Y-up                                   |
| Flat/Smooth 放哪               | 放在模板/拓扑层，不是普通后处理                                                    |
| Crawler CPU 顶点色              | 暂时保留，先去掉固定拓扑和三角函数重复，再基准测试                                           |
| 是否支持独立脏区                     | 值得；先做 Stream 级 Dirty，再看是否需要 Range Dirty                             |
| Section-major 是否正式支持         | 支持为一种模式，但不要设为唯一布局                                                   |
| Degenerate 是否保留              | 保留，限定在小区段和短期隐藏                                                      |
| 两个消费者是否只做小原语库                | 是，高层 Recipe DSL 暂缓                                                  |
| 581 顶点实体目标规模                 | 先以 50–100 为基准区间实测；超过 100 后重点评估 CPU 与上传路径                            |

---

## 最核心的一句话

你的大厅不应该继续写成：

```text
“我现在创建后墙”
“我现在创建前墙”
“我现在创建左墙”
```

而应该写成：

```text
“我有一组参数化曲面描述”
        ↓
“由统一 Grid Patch 算法生成”
        ↓
“不同曲面只提供局部坐标基和艺术形变”
```

这一步做完，你的项目就不再只是“很多程序化建模函数”，而是开始真正形成：

```text
Topology
+ Evaluator
+ Recipe
+ Section
+ Render Adapter
```

这五部分组成的小型程序化 Low Poly 框架。
