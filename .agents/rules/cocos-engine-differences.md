# Cocos Creator 与常见框架的关键差异

## 规则定位

本文件记录 Cocos Creator 与 Three.js、Unity、Godot、WebGL 及常见应用框架之间容易被经验迁移误判的 API、坐标、渲染和资源行为。

涉及 Cocos Creator API、坐标与方向、节点变换、相机、灯光、材质、渲染或资源契约时，必须先完整阅读本文件。遇到新的已验证差异时，应补充到对应章节；未经官方文档、引擎源码或实际隔离测试确认的猜测不得写成规则。

## 坐标、前向轴与 lookAt

### Cocos 节点默认前向轴

- Cocos Creator 的 Camera、SpotLight 等方向对象使用节点本地 `-Z` 作为前向轴。
- 不得凭其他引擎或普通模型节点的前向轴经验推断 Cocos 灯光方向。
- 创建方向对象后必须验证本地 `-Z` 在世界空间中确实指向目标。

### 垂直 lookAt 的共线退化

- `Node.lookAt(target)` 默认使用世界 Y 轴作为 up。
- 当目标位于节点正上方或正下方时，视线与默认 Y-up 共线。Cocos Creator 3.8.8 的 `Mat3.fromViewUp()` 在该情况下返回单位旋转，不会得到期望的垂直朝向。
- 垂直向上或向下的 SpotLight、Camera 等节点必须显式提供不与视线共线的 up，例如：

```ts
node.lookAt(target, Vec3.UNIT_Z);
```

- 不得在垂直方向调用中省略第二个参数。否则 SpotLight 可能保持默认 `-Z` 方向，扩大 `range` 后误照前墙或后墙。
- 如果方向并非严格垂直，也应检查视线与 up 的点积，避免接近共线时出现不稳定旋转。

## SpotLight 参数与验真

- Cocos Creator 3.8 的 `SpotLight` 组件属性 `spotAngle` 使用角度制；组件内部会转换为弧度并向渲染场景传递半角余弦。业务代码应使用组件 API，不得直接套用底层渲染对象的角度契约。
- 代码通过 `SpotLight.luminousFlux` 设置光通量，不得根据 Inspector 文案臆造 `luminousPower` 字段。
- `range` 只表示灯光影响距离，不能修正错误朝向。扩大范围前必须先确认灯光轴线正确。
- 验证真实 SpotLight 时，应降低 Ambient，并切换灯光 `enabled`：受光区域和阴影必须围绕同一目标同步出现、消失和移动。
- 如果增大 `range` 后远处墙面突然受光，优先检查节点方向、`lookAt` 的 up 和灯光目标，不要先修改法线、材质亮度或增加模拟光斑。

## 受光材质与程序几何

- Cocos `builtin-standard` 参与实时光照、PBR 高光和阴影接收；`builtin-unlit` 不参与实时灯光计算。
- 程序创建的受光 Mesh 必须显式上传正确且归一化的 Normal 流。只有 Position、Color 和 Index 的几何不能产生正确 Standard 光照。
- 不得为了让顶部灯照亮垂直表面而人工扭曲真实法线。受光方向不符合预期时，应先检查几何绕序、法线、灯光方向和材质类型。
- 灯具自身可见的发光面与照亮场景的 Light 是两个职责：Unlit 发光面只负责自身显示，SpotLight 才负责表面照明和阴影。
- 普通 SpotLight 不会自动渲染空气中的体积光柱。需要可见体积散射时，应明确采用体积雾或后处理方案，不得把半透明锥体描述成真实灯光。

### 动态 Mesh 的受光顶点流

- Cocos Creator 3.8.8 的 `utils.MeshUtils.createDynamicMesh()` 只会为实际传入的数据创建顶点流；几何对象在 CPU 侧保存 `normals`，不代表法线会自动上传到 GPU。
- 使用 `builtin-standard` 的动态程序网格必须在创建 Dynamic Mesh 时显式传入 `normals`，并在几何每帧变化后同步更新对应的法线顶点缓冲。
- 动态几何同时传入 Position、Normal、Color 时，`renderingSubMesh.vertexBuffers` 会按 Position、Normal、Color 的创建顺序排列；不得继续把第二个缓冲硬编码为 Color。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `cocos/3d/misc/create-mesh.ts` 验证：`createDynamicMesh()` 仅在 `geometry.normals` 非空时创建 `ATTR_NORMAL` 独立流。
- 验证动态受光材质时，应旋转或移动真实灯光并检查高光与明暗随法线变化；只有顶点色变化而灯光不产生响应，优先检查 Normal 流是否创建和逐帧上传。

## Profiler 帧率与帧耗时

- Cocos Creator 3.8.8 的 Profiler 中，`Framerate (FPS)` 与 `Frame time (ms)` 不是简单倒数关系。
- `FPS` 在 `AFTER_DRAW` 中通过连续帧时间戳统计真实帧间隔；`Frame time` 从 `BEFORE_UPDATE` 开始，到当前帧 `AFTER_DRAW` 结束，只覆盖引擎主动执行更新、渲染提交和 Present 调用的时间。
- 浏览器 `requestAnimationFrame`、帧率调度器、VSync 等两帧之间的等待不计入 `Frame time`。GPU 异步执行造成的真实压力也不能只凭 `Renderer` 或 `Present` 的 CPU 计时排除。
- 因此出现 `Frame time` 很低但 FPS 只有 30 到 50 的情况时，必须继续检查渲染分辨率、阴影与材质像素成本、浏览器调度和目标帧率，不得用 `1000 / Frame time` 推断设备应有帧率。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `cocos/profiler/profiler.ts` 验证：`beforeUpdate()` 启动帧计时，`afterPresent()` 结束帧计时并单独推进 FPS 计数。

## Cocos 资源与元数据

- Cocos `.meta` 文件由编辑器管理，禁止手动创建、复制或修改 UUID。
- 代码中能否按名称初始化内置 Effect 与 Editor 中能否选择该 Effect 不是同一契约。需要稳定引用内置 Standard 时，优先由 Editor 创建 Material 并通过场景或 Prefab 序列化引用。
- 新增、移动或重命名资源时只修改实际源文件，让 Cocos Editor 生成或更新对应 `.meta`。

## 新差异的记录要求

新增规则时必须包含：

1. 容易从哪个框架或通用经验产生错误类比；
2. Cocos 的实际行为和适用版本；
3. 已确认的官方文档、引擎源码位置或最小复现结论；
4. 项目中的强制写法与禁止写法；
5. 能够证明行为正确的隔离验证方法。
