# 程序化 Low Poly Geometry 架构裁决

## 一、总裁决

你提出的边界**总体合理，但需要把 Plan Composer 再切一刀**：

```text
Feature
├─ Recipe / Cage / Prototype Catalog
├─ Deformer / Sampler / Evaluator
├─ 世界连续性、领域语义、确定性扰动
└─ Feature-specific Compilation Policy

Core Geometry
├─ Faceted Emission
├─ Flat Grid Topology
├─ Radial Topology
├─ Surface Frame
└─ 无领域含义的数学与拓扑 Kernel

Core Mesh
├─ MeshPlan 基础类型
├─ Section / Offset / Index Composition
├─ Typed Vertex Layout
└─ 显式 Plan Cache

Rendering
├─ Cocos Mesh / RenderingSubMesh
├─ Material / MeshRenderer
├─ GPU Upload
└─ Node 生命周期
```

其中：

* `Recipe / Deformer / Sampler / Evaluator` 留在业务层；
* `Faceted / Grid / Radial` 的**拓扑机械能力**进入 core；
* 通用的 `MeshPlan Composer` 可以进入 core；
* 但 `Heterogeneous Environment Mega Mesh` 的容量、原型顺序、碰撞、实例 SoA、单材质约束仍应留在 Battlefield Feature。

这与项目要求的“领域结构明确、确定性不规则、Geometry 与 Rendering 严格分离”一致。

### 各问题的直接结论

| 问题                                                                    | 裁决                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Feature Recipe/Deformer 留业务层，Faceted/Grid/Radial/Plan Composer 进 core | **基本批准**；Plan Composer 只提取通用偏移、重复、Index 平移与 Section，不提取 Environment 批处理策略 |
| Faceted 使用 Emitter + Sink 还是泛型 Builder                                | **Emitter + 窄接口 Attribute Sink**                                          |
| Lobby 与 Ground 共享 Grid                                                | 共享 Plan、Workspace 类型和发射器；**不共享采样结果内容**                                    |
| Radial 是否包含确定性扰动                                                      | **不包含扰动策略**；只接受已经解析好的轮廓采样                                                 |
| 灯具、祭台、树木、蘑菇、帽子共享 Radial                                               | 可以共享拓扑 Kernel；**不能共享一个充满布尔参数的 Recipe**                                    |
| Environment Mega Mesh 是否通用化                                           | 抽通用 Plan Composition；Mega Mesh Policy 暂时保持 Battlefield 专用                 |
| Unlit 无用 Normal                                                       | 引入精确的强类型 SoA Vertex Layout                                                |
| Vanguard 是否泛化                                                         | 等第二个骨骼角色；目前只抽已有第二消费者的纯拓扑 Kernel                                           |
| MeshPlan 编译时机                                                         | 改为 Feature `prepare` 显式编译，通过显式 Cache 复用                                   |
| P0–P3 减少 530–880 行                                                    | 作为 Feature 侧减少量可信；作为整个仓库净减少量偏乐观                                           |

---

# 二、推荐的最终模块边界

## 2.1 Core Geometry：只负责“怎样稳定地产生拓扑”

```text
assets/core/geometry/
├─ faceted/
│  ├─ faceted-emitter.ts
│  ├─ facet-orientation.ts
│  └─ sequential-flat-normal.ts
│
├─ grid/
│  ├─ flat-grid-plan.ts
│  ├─ flat-grid-workspace.ts
│  ├─ flat-grid-emitter.ts
│  └─ surface-frame.ts
│
├─ radial/
│  ├─ radial-topology-plan.ts
│  ├─ radial-ring-source.ts
│  └─ radial-emitter.ts
│
└─ math/
   ├─ deterministic-hash.ts
   └─ geometry-validation.ts
```

Core Geometry 可以知道：

* 点；
* 三角形；
* 绕序；
* 面法线；
* Grid 的格点索引；
* 相邻 Ring 如何连接；
* 端盖使用 fan、annulus 还是不封口；
* 如何把局部 `U/V/N` 映射到三维空间。

Core Geometry 不可以知道：

* Lobby Cave Relief；
* Battlefield biome；
* 树干、菌盖、帽檐；
* Vanguard 骨骼；
* 材质、颜色主题；
* Cocos `Mesh`、`Node`、`Material`；
* 某个参数为什么是 `0.17`。

## 2.2 Core Mesh：负责固定计划和流契约

```text
assets/core/mesh/
├─ mesh-plan.ts
├─ mesh-plan-composer.ts
├─ mesh-section-layout.ts
├─ vertex-layout.ts
├─ vertex-streams.ts
└─ mesh-plan-cache.ts
```

这里的 Composer 只负责：

* 计算 Vertex/Index offset；
* 平移局部 Index；
* 重复固定 Plan；
* 生成连续 Section；
* 检查容量、溢出和 Index 类型；
* 确保最终计数与声明一致。

它不应该认识：

* `DeadTree`；
* `LuminousMushroom`；
* prototype capacity 的业务来源；
* obstacle；
* chunk visibility；
* tint；
* material pass。

## 2.3 Lobby Feature

```text
assets/lobby/geometry/
├─ recipes/
│  ├─ lobby-shell-recipe.ts
│  ├─ lobby-altar-recipe.ts
│  └─ lobby-lamp-recipe.ts
├─ deformers/
│  ├─ lobby-cave-deformer.ts
│  └─ lobby-radial-deformer.ts
├─ samplers/
│  ├─ lobby-grid-sampler.ts
│  └─ lobby-radial-ring-source.ts
└─ lobby-geometry-compiler.ts
```

继续保留：

* 洞穴隆起；
* 边缘衰减；
* Lobby seed；
* Observation Wall 矩形边界求交；
* 祭台层级的视觉命名；
* 灯具和祭台的非对称轮廓。

## 2.4 Battlefield Ground

```text
assets/bundles/battlefield/ground/
├─ battlefield-ground-recipe.ts
├─ battlefield-ground-world-sampler.ts
├─ battlefield-ground-shading.ts
└─ battlefield-ground-evaluator.ts
```

Ground 专属职责包括：

* 世界整数格点；
* chunk 到绝对格点的映射；
* 世界连续高度；
* biome 与颜色；
* chunk root 的世界定位；
* Bounds 更新。

## 2.5 Battlefield Environment

```text
assets/bundles/battlefield/environment/
├─ catalog/
│  └─ battlefield-environment-catalog.ts
├─ recipes/
│  ├─ dead-tree-recipe.ts
│  ├─ luminous-mushroom-recipe.ts
│  └─ ...
├─ compilation/
│  ├─ environment-prototype-compiler.ts
│  └─ environment-mega-mesh-compiler.ts
├─ evaluation/
│  └─ environment-instance-evaluator.ts
└─ rendering/
   └─ battlefield-environment-renderer.ts
```

当前 Environment 是一个 `150,736` 三角形、`452,208` 顶点、单 MeshRenderer 的异构批次；其单 Draw Call 和实例 SoA 属于明确的 Battlefield 策略，不应因为 Composer 抽到 core 而丢失这一层。

## 2.6 Vanguard

保持：

```text
assets/player/vanguard/
├─ cages/
├─ anatomy/
├─ compiler/
├─ evaluator/
├─ animation/
└─ mantle/
```

只调用 core 的：

* Faceted triangle emission；
* sequential flat-normal；
* 基础 MeshPlan；
* typed streams；
* compiled batch renderer。

不要新增 `core/character`、`core/humanoid` 或 `GenericSkinnedCageBuilder`。

---

# 三、Faceted：选择 Emitter + Attribute Sink

## 3.1 为什么不是泛型 Builder

一个泛型 Builder 很容易逐步演化成：

```ts
new MeshBuilder({
  faceted: true,
  smooth: false,
  static: true,
  lit: false,
  indexed: true,
  doubleSided: false,
  hasVariant: true,
  hasSemantic: true,
  ...
});
```

问题不只是布尔参数多，而是它会同时承担：

* 点生成；
* 拓扑；
* 法线；
* 颜色；
* metadata；
* section；
* plan 编译；
* stream 分配；
* index 写入；
* 生命周期。

最终它会成为所有 Feature 都依赖、却没有任何 Feature 能清楚理解的万能类。

## 3.2 推荐接口

Emitter 只计算面法线、绕序和独立分面顶点。Sink 决定写哪些属性。

```ts
export type TriangleWinding = 'ccw' | 'cw';

export interface FacetMetaSink<TMeta> {
    appendFlatTriangle(
        ax: number,
        ay: number,
        az: number,
        bx: number,
        by: number,
        bz: number,
        cx: number,
        cy: number,
        cz: number,
        nx: number,
        ny: number,
        nz: number,
        meta: TMeta,
    ): void;
}

export function emitFlatTriangle<TMeta>(
    sink: FacetMetaSink<TMeta>,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx: number,
    cy: number,
    cz: number,
    meta: TMeta,
    winding: TriangleWinding,
): void;
```

具体 Sink：

```ts
type NoFacetMeta = undefined;

interface EnvironmentFacetMeta {
    readonly colorVariant: number;
    readonly semanticId: number;
}
```

* Lobby Sink 可以忽略 metadata；
* Environment Sink 写 `facetVariants`；
* Vanguard 编译器可以写 semantic ID；
* Ground Sink 可以直接写 Position、Normal、Color；
* Emitter 永远不解释这些 metadata。

## 3.3 避免万能类的约束

必须坚持四条限制：

1. Emitter 不分配最终 Geometry；
2. Emitter 不拥有 Recipe；
3. Emitter 不创建 Cocos 对象；
4. Emitter 不解释颜色、语义、骨骼或原型。

`Triangle`、`Quad`、`OrientedQuad`、`DoubleSidedQuad` 可以是独立函数或小型命名模块，不要集中成一个几十个方法的 Builder。

---

# 四、Lobby 与 Ground 如何共享 Grid

当前两者重复的是：

* 共享格点采样；
* 每格对角线策略；
* 独立三角形展开；
* 面法线；
* 固定拓扑计数。

生命周期虽不同，但几何机械阶段相同。Ground 当前为 `20,000` triangles，并在 chunk 切换后只重写 Position、Normal 和 Color，Index 保持固定。

## 4.1 共享三个东西

### FlatGridPlan

```ts
export interface FlatGridPlan {
    readonly columns: number;
    readonly rows: number;
    readonly sampleCount: number;
    readonly triangleCount: number;

    /**
     * 每三个值表示一个三角形引用的三个共享采样点。
     */
    readonly triangleSampleIndices: Uint32Array;
}

export type GridDiagonalPolicy =
    | { readonly kind: 'alternating'; readonly parityOffset: 0 | 1 }
    | { readonly kind: 'fixed-forward' }
    | { readonly kind: 'fixed-backward' };

export function compileFlatGridPlan(
    columns: number,
    rows: number,
    diagonal: GridDiagonalPolicy,
    winding: TriangleWinding,
): FlatGridPlan;
```

这里的 diagonal 使用 tagged union，而不是：

```ts
alternating: boolean;
reverse: boolean;
flipEveryRow: boolean;
```

### FlatGridWorkspace

```ts
export interface FlatGridWorkspace {
    readonly positions: Float32Array;
}

export function createFlatGridWorkspace(
    plan: FlatGridPlan,
): FlatGridWorkspace;
```

Ground 在 chunk 更新时复用同一个 Workspace，不能每次更新创建数组或点对象。

### FlatGridEmitter

```ts
export interface GridPointSampler<TContext> {
    sample(
        context: TContext,
        column: number,
        row: number,
        output: Float32Array,
        outputOffset: number,
    ): void;
}

export function sampleFlatGrid<TContext>(
    plan: FlatGridPlan,
    sampler: GridPointSampler<TContext>,
    context: TContext,
    workspace: FlatGridWorkspace,
): void;

export function emitSampledFlatGrid<TMeta>(
    plan: FlatGridPlan,
    workspace: FlatGridWorkspace,
    sink: FacetMetaSink<TMeta>,
    meta: TMeta,
): void;
```

## 4.2 Ground 世界连续性的正确实现

连续性不应该依赖“上一个 chunk 的缓存还在”，而应依赖绝对整数格点：

```ts
interface GroundSampleContext {
    readonly baseGridX: number;
    readonly baseGridZ: number;
    readonly spacing: number;
    readonly localOriginX: number;
    readonly localOriginZ: number;
}
```

采样时：

```ts
const worldGridX = context.baseGridX + column;
const worldGridZ = context.baseGridZ + row;

const height = sampleGroundHeight(worldGridX, worldGridZ);
```

关键规则：

* Noise/hash 输入使用整数 `worldGridX/worldGridZ`；
* 不用 `chunkWorldX + column * spacing` 作为随机输入；
* 重叠边界点必须由相同绝对整数格点产生；
* local X/Z 由相对格点差计算；
* Root Node 再移动到 chunk origin；
* biome/color 也使用绝对格点或稳定世界坐标。

因此相邻 chunk 的：

```text
chunk A 的最右列
=
chunk B 的最左列
```

在逻辑采样上是同一组世界格点。

## 4.3 “共享采样缓存”的准确含义

应共享：

* Workspace 类型；
* sample slot 排布；
* 单 patch 内每个格点只采样一次的机制；
* Workspace 复用策略。

不应共享：

* Lobby 和 Ground 的实际 Position 数据；
* 不同 chunk 之间的长期全局缓存；
* Feature seed；
* Deformation context。

全局 Ground Sample Cache 会引入：

* 淘汰策略；
* chunk 生命周期耦合；
* 浮点键或哈希键；
* 内存上限；
* 多 chunk 同步。

当前没有证据表明需要它。世界连续性由纯确定性采样保证，不由缓存保证。

---

# 五、Radial：只抽拓扑，不抽扰动策略

## 5.1 Core Radial 应负责的内容

* 固定 segment 顺序；
* 闭环；
* 相邻 ring 连接；
* outward winding；
* fan cap；
* annulus；
* open end；
* double-sided cap；
* 截面 basis；
* 计数和退化检查。

## 5.2 Core 不应负责的内容

* 树干弯曲；
* 菌盖下垂；
* 祭台肩部；
* 灯口开合；
* 帽檐前后差；
* 每个 segment 的半径扰动公式；
* seed 到 radius offset 的映射；
* 某个对象的非对称规则。

确定性 hash/noise 数学函数可以在 `core/math`，但“使用哪一个 seed、多少振幅、作用在哪个 ring”必须由 Feature 决定。

## 5.3 推荐接口

```ts
export interface RadialTopologyPlan {
    readonly ringCount: number;
    readonly segmentCount: number;
    readonly sideTriangleIndices: Uint32Array;
    readonly caps: readonly RadialCapPlan[];
}

export type RadialCapPlan =
    | { readonly kind: 'none'; readonly end: 'start' | 'finish' }
    | { readonly kind: 'fan'; readonly end: 'start' | 'finish' }
    | { readonly kind: 'double-sided-fan'; readonly end: 'start' | 'finish' };

export interface RadialRingSource<TContext> {
    sample(
        context: TContext,
        ringIndex: number,
        segmentIndex: number,
        output: Float32Array,
        outputOffset: number,
    ): void;
}
```

Feature 负责的 Ring Source 示例：

```ts
class DeadTreeRingSource
    implements RadialRingSource<DeadTreeRecipe> {
    // 树干弯曲、半径收缩和 segment 扰动
}

class LobbyAltarRingSource
    implements RadialRingSource<LobbyAltarRecipe> {
    // 层级、肩部和轮廓错角
}

class VanguardHatRingSource
    implements RadialRingSource<VanguardHatRecipe> {
    // 帽冠、帽檐和前后不对称
}
```

它们共享的是：

```text
Ring sample indexing
→ ring connection
→ cap emission
→ face normal
```

而不是共享一个 `RadialObjectOptions`。

## 5.4 如何避免大量业务布尔参数

错误形式：

```ts
interface RadialOptions {
    isTree?: boolean;
    isMushroom?: boolean;
    hasTop?: boolean;
    hasBottom?: boolean;
    doubleSided?: boolean;
    bend?: boolean;
    irregular?: boolean;
    flattenFront?: boolean;
}
```

正确方式：

* 用不同 Feature Recipe；
* 用不同 Ring Source；
* 端盖使用 tagged union；
* 不同造型通过多个小型 shell 组合；
* 一个 Radial Plan 只处理一组 segment 兼容的连续 rings。

树冠、菌盖、灯壳和帽子可以调用同一个 Kernel，但不需要具有同一个业务配置类型。

---

# 六、Environment Mega Mesh 与 Prototype Catalog

## 6.1 值得抽象，但只抽底层组合机制

推荐进入 core：

```ts
export interface MeshPlanPart<TId> {
    readonly id: TId;
    readonly plan: MeshPlan;
    readonly repeatCount: number;
}

export interface ComposedMeshPlan<TId> extends MeshPlan {
    readonly sections: ReadonlyMap<TId, MeshSection>;
}

export function composeRepeatedMeshPlans<TId>(
    parts: readonly MeshPlanPart<TId>[],
    indexFormat: 'uint16' | 'uint32',
): ComposedMeshPlan<TId>;
```

它可以服务：

* Environment 的 prototype × capacity；
* Crawler 子计划；
* Lobby 连续语义 Section；
* 后续其他固定异构批次。

暂时不进入 core：

```text
HeterogeneousEnvironmentBatch
EnvironmentPrototypeCapacity
EnvironmentChunkVisibility
EnvironmentObstacle
EnvironmentTint
```

换句话说：

> 抽象 `Plan Concatenation`，不抽象 `Battlefield Environment System`。

## 6.2 强类型 Catalog

不要继续维护：

* enum；
* ordered list；
* config map；
* plan map；
* capacity map；
* collision map。

应以一个只读 tuple 为唯一真源：

```ts
export const ENVIRONMENT_PROTOTYPE_CATALOG = definePrototypeCatalog([
    {
        id: 'deadTree',
        capacity: 128,
        compilePlan: compileDeadTreePlan,
        collision: DEAD_TREE_COLLISION,
        spawn: DEAD_TREE_SPAWN,
    },
    {
        id: 'luminousMushroom',
        capacity: 96,
        compilePlan: compileLuminousMushroomPlan,
        collision: MUSHROOM_COLLISION,
        spawn: MUSHROOM_SPAWN,
    },
] as const satisfies readonly EnvironmentPrototypeDefinition[]);

export type EnvironmentPrototypeId =
    typeof ENVIRONMENT_PROTOTYPE_CATALOG[number]['id'];
```

显式 tuple 顺序比依赖对象 key 顺序更适合作为：

* 稳定 Section 顺序；
* Index 编译顺序；
* 序列化 ID 映射；
* 调试输出顺序；
* Hash 基准顺序。

其他映射由 Catalog 派生，不再手工维护平行清单。

## 6.3 保持单 Draw Call 的编译期约束

Environment compiler 应验证所有 prototype：

* 使用同一 Vertex Layout；
* 使用同一 Material/Pass；
* 使用相同 primitive topology；
* 总 Index 能被 `Uint32` 表达；
* Section 不重叠；
* capacity 与预留范围一致；
* inactive slot 有确定性退化或隐藏策略；
* Index 只在 prepare 阶段写一次。

Core Composer 不能擅自拆 Mesh；若布局或材质不兼容，应编译失败，而不是静默产生多个批次。

---

# 七、强类型 Vertex Layout

当前 Environment 使用 Unlit，只实际写入 Position 和 Color，却仍为 `452,208` 个顶点分配 Normal，约浪费 `5.2 MiB` CPU 内存。

## 7.1 不要用可选字段模拟布局

不推荐：

```ts
interface VertexStreams {
    position: Float32Array;
    normal?: Float32Array;
    color?: Float32Array;
    uv?: Float32Array;
}
```

这会把错误推迟到运行时：

```ts
streams.normal?.set(...);
```

最终大量代码需要可选链和断言。

## 7.2 推荐语义映射

```ts
export interface VertexStreamTypeMap {
    readonly position: Float32Array;
    readonly normal: Float32Array;
    readonly color: Float32Array;
    readonly uv0: Float32Array;
}

export type VertexSemantic = keyof VertexStreamTypeMap;

export type VertexStreams<
    TSemantics extends VertexSemantic
> = {
    readonly [K in TSemantics]: VertexStreamTypeMap[K];
};

export interface VertexLayout<
    TSemantics extends VertexSemantic
> {
    readonly id: string;
    readonly semantics: readonly TSemantics[];

    createStreams(
        vertexCount: number,
    ): VertexStreams<TSemantics>;
}
```

布局定义：

```ts
export const UNLIT_COLOR_LAYOUT =
    defineSoAVertexLayout('unlit-color', [
        'position',
        'color',
    ] as const);

export const LIT_COLOR_LAYOUT =
    defineSoAVertexLayout('lit-color', [
        'position',
        'normal',
        'color',
    ] as const);

export const LIT_COLOR_UV_LAYOUT =
    defineSoAVertexLayout('lit-color-uv', [
        'position',
        'normal',
        'color',
        'uv0',
    ] as const);
```

Environment evaluator：

```ts
type EnvironmentStreams =
    VertexStreams<'position' | 'color'>;
```

编译器访问 `streams.normal` 时应直接产生 TypeScript 错误。

## 7.3 Layout 必须贯穿整个链路

```text
MeshPlan<L>
→ VertexStreams<L>
→ Evaluator<L>
→ DynamicMeshBatch<L>
→ Cocos Vertex Attribute Description
```

不能只让 Geometry 强类型化，而 Renderer 仍假定存在 Position/Normal/Color。

材质和 Layout 也应在 Renderer 初始化时验证：

```text
Unlit Environment Material
requires Position + Color

Standard Lit Material
requires Position + Normal + Color
```

未来 Environment 改用 Standard 时，必须显式改为 Lit Layout，并补上实例法线旋转和上传，不应通过保留无用 Normal 来“提前兼容”。

---

# 八、Vanguard 的抽象上限

## 8.1 当前不应建立通用角色框架

Vanguard 的 `695` triangles 只是表面规模；真正复杂度在于：

* 显式人体 Cage；
* 非对称轮廓；
* 双骨骼权重；
* 披风覆盖关系；
* animation dirty stream；
* semantic spans；
* 颜色事件；
* 每帧 flat normal。

这些不是普通样板。当前审计也表明，Vanguard 的运行时 Plan/Evaluator/Dirty Stream 已经高度模块化，大量代码是明确的角色拓扑与披风行为。

## 8.2 现在最多抽到这里

可以进入 core：

* Triangle/Quad/FacetedQuad 的纯展开；
* sequential index；
* sequential flat normal；
* 通用 MeshPlan 基础数据；
* Typed Stream；
* Compiled batch renderer；
* 与角色无关的双权重数学函数，但仅在已有其他消费者时。

暂时留在 Vanguard：

* bone enum；
* control vertex schema；
* anatomy section；
* ring/band 的人体含义；
* body/outfit/hair/headwear/mantle cage；
* semantic ID；
* skinning plan 编译过程；
* mantle control；
* damage palette；
* 左右非对称。

特别不要把 Vanguard 当前的 `FacetedQuad`、双权重和披风需求直接命名成：

```text
GenericCharacterMeshPlan
UniversalHumanoidCage
CharacterBandBuilder
```

第二个骨骼角色出现后，先对比两个角色真实共有的数据，再决定是否形成：

```text
Core SkinBindingPlan
Core ControlVertexExpansion
Feature Character Cage
```

而不是现在预判未来角色都会与 Vanguard 相同。

---

# 九、MeshPlan 编译时机

## 9.1 推荐改到 Feature prepare

模块顶层编译当前虽然避免逐实例重建，但存在几个问题：

* import 具有不可见计算副作用；
* 编译错误发生在模块求值阶段；
* 启动耗时不容易归属；
* 测试导入单个常量也会触发完整环境编译；
* 热重载可能重复编译；
* 无法显式选择 quality、layout、seed 或 recipe version；
* Cache 生命周期不清楚。

推荐：

```ts
export interface MeshPlanCache {
    getOrCompile<TKey, TPlan>(
        key: TKey,
        compile: () => TPlan,
    ): TPlan;
}
```

Feature：

```ts
export function prepareBattlefieldEnvironment(
    cache: MeshPlanCache,
): PreparedBattlefieldEnvironment {
    const plans = compileEnvironmentCatalog(
        ENVIRONMENT_PROTOTYPE_CATALOG,
        cache,
    );

    const megaMeshPlan = cache.getOrCompile(
        createEnvironmentMegaMeshCacheKey(plans),
        () => compileEnvironmentMegaMeshPlan(plans),
    );

    return {
        plans,
        megaMeshPlan,
    };
}
```

## 9.2 模块加载期只保留不可变声明

模块顶层可以导出：

* Recipe；
* Catalog；
* enum/tag；
* 常量尺寸；
* 编译函数。

不应在模块顶层：

* 分配数十万顶点的数组；
* 遍历所有 prototype；
* 组合 Mega Mesh Index；
* 计算 Bounds；
* 执行可能抛错的编译。

## 9.3 Cache Key

至少包含：

```text
feature
recipe version
topology version
vertex layout ID
quality tier
deterministic seed/config identity
index format
```

不要用整个 Recipe 的 JSON 字符串作为每次运行时 key。优先使用显式版本号和稳定标识。

编译仍然是确定性的，只是从“隐式 import 副作用”改成“显式 prepare 生命周期”。

---

# 十、分阶段迁移顺序

## P0：建立不可变基线并提取 Faceted

先锁定：

* Position hash；
* Normal hash；
* Color hash；
* Index hash；
* triangle count；
* section ranges；
* bounds；
* Ground seam。

然后：

1. 提取 flat triangle normal；
2. 提取 winding/orientation；
3. 提取 Triangle/Quad emission；
4. 将 Lobby Section Composer 提升为通用 Section Layout；
5. Lobby、Ground、Environment 按顺序接入；
6. 不改变任何 Recipe。

验收时所有 Geometry 输出应逐字节或在明确浮点规则下保持一致。

## P1：Grid 收敛

1. 编译 `FlatGridPlan`；
2. 引入可复用 Workspace；
3. Lobby 改用 `LobbyGridSampler`；
4. Ground 改用绝对世界格点 Sampler；
5. 保持 Ground Index 初始化后不再写；
6. 增加相邻 chunk seam 测试。

这一阶段最大风险不是视觉，而是世界格点与 local/root 坐标的计算次序。

## P2：Radial 收敛

迁移顺序应从简单到复杂：

```text
Lobby Lamp
→ Lobby Ritual Lamp
→ Mushroom
→ Altar
→ DeadTree branches/canopy
→ Rock/Pool
→ Vanguard Headwear adapter
```

每迁移一个对象都比较：

* ring 顶点；
* winding；
* cap；
* silhouette；
* triangle count；
* face normal。

不要一次性重写全部 Radial 对象，否则视觉回归很难定位。

## P3：Vertex Layout、Catalog 与 Plan Composition

推荐内部顺序：

1. 先引入强类型 Vertex Layout；
2. Environment 切换到 Position + Color；
3. 验证 Normal CPU 缓冲完全消失；
4. 合并 Prototype 平行清单为 Catalog；
5. 提取底层 repeated-plan composition；
6. 最后改 Environment Mega Mesh 编译器；
7. 验证仍为一个 MeshRenderer 和一个 Uint32 Index 批次。

Vertex Layout 的收益明确且与 Composer 相对独立，应先完成，不必等待整个 Mega Mesh 架构重写。

## P4：推迟的角色作者抽象

触发条件：

* 第二个固定拓扑骨骼 Cage 角色已经实现；
* 两个角色都出现相同的 control-to-render expansion；
* 两者确实共享绑定数据表达；
* 提取后不需要 Vanguard 专属布尔参数。

条件未满足前，不启动 P4。

---

# 十一、不应抽象的“重复代码”

以下代码即使形状相似，也不应合并为统一业务抽象。

## 11.1 Lobby Cave 与 Ground World Surface

两者可以共享 Grid 拓扑，但不能共享 Deformer：

* Lobby 是局部 `SurfaceFrame` 上的洞穴雕刻；
* Ground 是绝对世界格点上的连续地表；
* 边缘处理、噪声域和生命周期完全不同。

## 11.2 Lobby Observation Wall 与普通 Grid

矩形窗口边界求交、内外框和深度墙具有明确领域结构。它最多复用：

* ring connection；
* annulus；
* faceted emission。

不要伪装成“支持洞口的万能 Grid”。

## 11.3 Environment 静态硬分面 Tube 与 Crawler 动态 Tube

Crawler 具有：

* 动态曲线；
* 每帧采样；
* 平滑参数体元；
* emergence；
* 动画状态。

Environment Tube 具有：

* 编译一次；
* 静态硬分面；
* 领域半径扰动；
* 实例变换。

两者只共享低层采样数学或 Index Pattern，不应共用一个带 `smooth/static/dynamic/emergence/faceted` 参数的函数。现有 Crawler 也证明统一 Plan/Stream/Renderer 并不要求统一作者算法。

## 11.4 各 Radial 对象的 Ring 清单

祭台层级、树木分叉、蘑菇菌褶和帽檐是美术表达本身。即使最终调用同一个 emitter，这些 Recipe 仍应显式存在。

## 11.5 Vanguard 的显式不对称拓扑

左右差异、头发轮廓、服装层级和披风绑定不属于机械重复。自动镜像或统一参数表会削弱美术可读性。

## 11.6 Environment 的 Prototype 实例策略

下列内容不属于通用 MeshPlan：

* capacity；
* spawn density；
* collision；
* chunk；
* tint；
* heading；
* inactive slot；
* obstacle field。

Catalog 可以把它们集中，但不应搬进 core。

## 11.7 Lit 与 Unlit Renderer 路径

应共享底层上传基础，但不要用：

```ts
uploadNormals: boolean;
isLit: boolean;
hasUv: boolean;
```

构造统一 Renderer。应让 Layout 和 Material Contract 在类型和初始化验证上表达差异。

---

# 十二、P0–P3 净减少 530–880 行是否可信

## 12.1 作为 Feature 侧减少量：可信

当前 Feature 建模与渲染约 `6,958` 行，重复主要集中在：

* face normal/winding；
* Grid loops；
* radial connection/caps；
* section offset；
* environment parallel maps；
  -固定流分配。

`530–880` 行相当于约 `8%–13%`，没有假设删除领域 Recipe、Vanguard Cage 或美术数据，因此不像“减少 30%”那样依赖万能 DSL。

## 12.2 作为整个仓库生产代码净减少量：偏乐观

因为同时会新增：

* Core interface；
* typed layout；
* adapter；
* validation；
* cache；
* catalog compiler；
  -错误信息和断言。

更现实的分层估算：

| 口径               |          预计变化 |
| ---------------- | ------------: |
| Feature 目录减少     |   `530–880` 行 |
| 重复机械实现的毛删除量      | `650–1,000` 行 |
| 新增 Core 基础设施     |   `180–350` 行 |
| 生产源码全仓净减少        | 约 `300–650` 行 |
| 加入完整回归测试后总 TS 行数 |  可能只小幅下降，甚至增加 |

这不代表重构收益不足。真正收益是：

* 后续新模型只增加 Recipe；
* 拓扑 Bug 只修一处；
* Ground 和 Lobby 使用同一验证路径；
* Unlit 直接减少约 `5.2 MiB` 无用 CPU Normal；
* 新 prototype 不再维护多份平行映射；
* 编译生命周期可观测。

## 12.3 原估算中最容易高估的部分

### P2 Radial

环连接代码确实重复，但树、蘑菇、祭台、灯具的 Ring Recipe 不应删除。若估算把这些显式美术数据也算成可替代代码，`160–260` 行的上限会偏高。

### P3 Catalog/Composer

强类型 Catalog 会减少映射和分发代码，但类型声明、编译校验和错误信息会抵消一部分行数。P3 的主要收益不是删除代码，而是消除“新增原型漏改某张表”的错误。

## 12.4 不应为了达到行数目标做的事情

不要通过以下方式强行实现 `880+` 行减少：

* 将所有 Recipe 写入统一 JSON DSL；
* 将 Tree/Mushroom/Altar 合并成一个 radial options 表；
* 自动镜像 Vanguard；
* 合并 static/dynamic/lit/unlit Renderer；
* 让 core 解释 semantic、palette 和 biome；
* 用匿名数字数组替代命名美术结构。

这些做法会减少表面代码，却降低项目最重要的美术意图可读性。

---

# 十三、主要风险与控制措施

## 13.1 正确性风险

| 风险                    | 严重度 | 控制                                        |
| --------------------- | --: | ----------------------------------------- |
| Faceted winding 改变    |   高 | 对 Position、Normal、Index 做 golden hash     |
| Normal 方向翻转           |   高 | 验证 `dot(faceNormal, expectedOutward) > 0` |
| Grid 对角线 parity 改变    |   高 | 锁定每个 cell 的 triangle sample indices       |
| Ground seam 不连续       |   高 | 测试相邻 chunk 重叠格点和颜色                        |
| Radial cap 出现退化面      |   中 | 编译期面积阈值检查                                 |
| Radial ring 起始角改变     |   高 | 比较轮廓和逐顶点 hash                             |
| Uint16/Uint32 越界      |   高 | Composer 编译时检查最大 Index                    |
| Section offset 错位     |   高 | Section 覆盖完整性和无重叠检查                       |
| Layout 与 Material 不兼容 |   高 | Renderer 初始化时硬失败                          |
| Cache key 不完整         |   中 | 显式 topology/layout/recipe version         |

Ground seam 测试至少应同时覆盖：

```text
高度一致
Position 世界值一致
颜色一致
对角线策略一致
Bounds 包含全部顶点
```

## 13.2 性能风险

### Callback 热路径

过度接口化可能使 Ground 更新变成多层虚调用。应做到：

* Plan 使用 TypedArray；
* Workspace 长期复用；
* 热循环中不创建闭包；
* 不生成临时 tuple/Vec3；
* Sampler 在进入循环前固定；
* Sink 保持单态；
* Normal 使用标量计算。

### Composer 重复复制

Environment Mega Mesh 的 Index 只应在 prepare 时编译一次。Chunk 更新不能重新执行 Plan Composition。

### Cache 无界增长

Cache 应由 Runtime 或 Feature Prepare Context 持有，不能是不可释放的匿名全局 Map。Quality、seed 或 recipe version 改变时需要可控失效。

### Vertex Layout 隐性转换

不能为了兼容旧接口临时创建：

```ts
new Float32Array(vertexCount * 3)
```

作为假的 Normal。迁移应直接对齐目标布局，不保留双路径。

## 13.3 美术可读性风险

最大的风险不是视觉变化，而是 Recipe 变得无法阅读。

应保留：

```ts
const ALTAR_SHOULDER_RING = ...
const MUSHROOM_GILL_RING = ...
const HAT_FRONT_BRIM = ...
```

不应变成：

```ts
rings[4].flags = 13;
rings[4].variant = 2;
```

建议每个 Feature Recipe 继续使用领域命名，并允许显式、少量、确定性的不对称数据。Core 只隐藏拓扑循环，不隐藏“为什么长成这样”。

## 13.4 架构风险

必须增加依赖约束：

```text
core/geometry
  不得 import cocos
  不得 import lobby
  不得 import battlefield
  不得 import player

feature geometry
  不得 import feature rendering

rendering
  不得调用 deformer 或 recipe compiler
```

最好通过 ESLint boundary rule 或路径约束自动检查，而不是只写在文档里。

---

# 十四、最终推荐

最终边界应表达为：

```text
领域 Recipe 决定“长什么样”
Feature Sampler/Deformer 决定“怎样不规则”
Core Topology Plan 决定“点怎样连接”
Faceted Emitter 决定“怎样形成硬分面”
MeshPlan Composer 决定“怎样组合固定计划”
Evaluator 决定“哪些流在何时变化”
Vertex Layout 决定“哪些流真实存在”
Renderer 决定“怎样提交给 Cocos”
```

因此本次建议批准：

1. `Faceted Emitter + Attribute Sink`；
2. `FlatGridPlan + Workspace + Emitter`；
3. 不包含扰动策略的 `RadialTopologyPlan`；
4. 通用 offset/index/section `MeshPlan Composer`；
5. Feature 专属的 Environment Mega Mesh Compiler；
6. 单一强类型 Environment Prototype Catalog；
7. 精确的 SoA Vertex Layout；
8. Feature `prepare` 阶段显式编译和缓存；
9. Vanguard 暂缓角色级泛化。

不批准：

* 万能 Geometry Builder；
* 通用 Radial Business Recipe；
* 通用 Environment System；
* 当前阶段的 Generic Character Cage；
* 为减少行数而牺牲显式艺术数据。

这个方案既能收敛 Lobby、Ground、树木、蘑菇、灯具和祭台的机械重复，又不会把项目最关键的确定性不规则、世界连续性、领域轮廓和可控不对称埋进通用框架。
