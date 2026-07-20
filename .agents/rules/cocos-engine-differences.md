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

### 世界坐标投影到 UI 本地坐标

- 不得把浏览器 DOM、CSS 或指针事件常见的“左上角为原点、Y 向下”经验套用到 `Camera.convertToUINode()` 的返回值上，也不得把这个问题误判为欧拉角的 `XYZ`、`ZYX` 或 `YXZ` 旋转顺序问题。
- Cocos Creator 3.8.8 的 `Camera.convertToUINode(wpos, uiNode, out)` 返回 `wpos` 在指定 `uiNode` 本地坐标系中的位置。目标 UI 节点是 `uiNode` 的直接子节点时，可以把结果直接传给目标节点的 `setPosition()`，禁止再次手动执行 `out.y = -out.y`。
- 需要转换的 `uiNode` 应当是接收位置的目标 UI 节点之父节点；目标存在更深层级时，不得固定传入 Canvas 后再忽略中间父节点的变换。
- 在没有旋转或负缩放的普通 UI 父节点中，局部 Y 增大表示向上，局部 Y 减小表示向下。屏幕方向偏移应在 `convertToUINode()` 完成后直接加到本地坐标，例如向下偏移使用 `out.y += negativeOffsetY`。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `cocos/misc/camera-component.ts` 验证：实现先调用 `worldToScreen()`，按 View 缩放和可视尺寸换算，再调用目标节点的 `UITransform.convertToNodeSpaceAR()`；官方示例也是将转换结果直接赋给 UI 节点位置。
- 隔离验证时，应固定一个可见的 3D 世界锚点，把转换结果直接赋给父节点下的 UI 标记，再分别添加正、负局部 Y 偏移；标记应在锚点上方、下方对称移动。若无偏移时位置正确而取反后上下镜像，即可确认错误来自额外的 Y 翻转。

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

### GFX Buffer 的局部更新边界

- 不得把原生 WebGL `bufferSubData(target, dstByteOffset, ...)` 的目标偏移能力直接套用到 Cocos Creator 3.8.8 的公开 `gfx.Buffer.update()`：该 API 只接收数据源和可选字节数，不提供目标缓冲偏移参数。
- WebGL 后端会把公开 `update()` 转换为目标偏移固定为零的 `WebGLCmdFuncUpdateBuffer` 调用；传入 TypedArray 子视图只会把该子视图写到 GPU 缓冲开头，不能用于更新大缓冲中间区段。
- 单 MeshRenderer 大网格需要降低低频更新尖峰时，应在 CPU 侧按预算分帧求值，完成后整体提交；若必须分段提交 GPU，只能显式拆成多个独立缓冲/渲染批次并接受对应 Draw Call 代价，禁止依赖不存在的公开偏移参数。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `cocos/gfx/base/buffer.ts` 与 `cocos/gfx/webgl/webgl-buffer.ts` 验证：抽象接口为 `update(buffer, size?)`，WebGL 实现向底层更新函数传入固定目标偏移 `0`。
- 隔离验证时，可创建已填充不同哨兵值的动态缓冲，再用子视图调用 `update()`；读取或渲染结果应显示缓冲开头被覆盖，而不是子视图原 ArrayBuffer 偏移对应的目标区段。

## Profiler 帧率与帧耗时

- Cocos Creator 3.8.8 的 Profiler 中，`Framerate (FPS)` 与 `Frame time (ms)` 不是简单倒数关系。
- `FPS` 在 `AFTER_DRAW` 中通过连续帧时间戳统计真实帧间隔；`Frame time` 从 `BEFORE_UPDATE` 开始，到当前帧 `AFTER_DRAW` 结束，只覆盖引擎主动执行更新、渲染提交和 Present 调用的时间。
- 浏览器 `requestAnimationFrame`、帧率调度器、VSync 等两帧之间的等待不计入 `Frame time`。GPU 异步执行造成的真实压力也不能只凭 `Renderer` 或 `Present` 的 CPU 计时排除。
- 因此出现 `Frame time` 很低但 FPS 只有 30 到 50 的情况时，必须继续检查渲染分辨率、阴影与材质像素成本、浏览器调度和目标帧率，不得用 `1000 / Frame time` 推断设备应有帧率。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `cocos/profiler/profiler.ts` 验证：`beforeUpdate()` 启动帧计时，`afterPresent()` 结束帧计时并单独推进 FPS 计数。

## Web Pacer 与 60Hz 同频边界

- Cocos Creator 3.8.8 的 Web Pacer 不会直接在每个 `requestAnimationFrame` 回调执行游戏帧。它使用 `Math.floor(elapsedTime / frameTime)` 计算理论帧编号，并把下一目标编号保存为 `elapsedFrame + 1`。
- 当 `game.frameRate` 恰好为 `60`、显示器也接近严格 `60Hz` 时，rAF 的亚毫秒抖动会让相邻回调落在整数边界两侧。原本可执行的显示帧可能被判定为“尚未到达下一理论帧”，从而出现 30 到 50 FPS、但引擎主动 Frame time 仍只有数毫秒的假性性能瓶颈。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `pal/pacer/pacer-web.ts` 验证：`_handleRAF()` 使用累计时间、向下取整帧编号和 `_frameCount = elapsedFrame + 1` 进行门控；使用带 0.35ms 确定性抖动的隔离模拟时，目标 60 在 60Hz 下只能触发约 46 FPS，而目标 61 能覆盖全部约 60 次 rAF。
- HTML5 运行时需要把调度目标设为略高于常见刷新率的 `61`，实际显示仍由 60Hz VSync 限制在约 60 FPS。小游戏和原生平台使用不同 Pacer，不得照搬这一数值。
- 验证此问题时，应同时满足“Draw Call 与三角形很低、Frame time 很低、FPS 却显著低于刷新率”三个信号；不要仅通过降低模型面数掩盖调度器漏帧。

## 动态分辨率恢复探测

- 修改 `pipeline.shadingScale` 可能触发渲染附件尺寸变化；连续上下调整会额外制造资源重建和 GPU 波动。
- 只依据 VSync 封顶后的 60 FPS 无法证明更高分辨率仍有 GPU 余量。恢复探测升档后若不能继续达到恢复阈值，必须立即回到此前稳定档位，并记住本场景会话的稳定上限，禁止周期性重复探测同一失败档位。
- 高 DPR 或高分辨率画布必须先按物理像素预算限制启动比例，再由低频采样逐级恢复；不得总以完整物理分辨率启动后等待多轮掉帧才降档。

## Graphics 路径与 UI Draw Call

- 不得把浏览器 Canvas 的即时绘制调用或通用 UI 控件经验直接等同于 Cocos 的 Draw Call：Cocos Creator 3.8.8 会把同一 `Graphics` 组件的多次 `fill()`、`stroke()` 结果继续写入共享 `MeshRenderData`，不同填充色和描边色作为顶点数据保存；只有缓冲容量不足等边界才会申请新的 RenderData。
- 独立 `Label` 使用字体纹理和文字材质，即使与 `Graphics` 相邻，也不属于同一个 Graphics 网格批次。对 Draw Call 极敏感且字形固定的程序化按钮，应优先把底板与矢量字形绘制在同一个 `Graphics` 中；需要完整字体、动态文案或可访问性语义时仍应使用 `Label`，不得把本规则泛化为全面移除文字组件。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `cocos/2d/assembler/graphics/webgl/impl.ts` 和 `graphics-assembler.ts` 验证：组件持有 `MeshRenderData[]`，Assembler 在现有缓冲容量允许时持续追加顶点与索引，并把路径颜色写入顶点流。
- 隔离验证时，应分别创建“单个 Graphics 内多色底板加矢量字形”和“Graphics 底板加独立 Label”两种 UI，关闭其他 UI 后比较 Profiler；前者在未触发缓冲分裂时应只产生一个 Graphics 提交，后者会增加文字材质提交。

## Cocos 资源与元数据

- Cocos Creator 3.8.8 的 `AssetManager.loadBundle()` 与 `Bundle.loadScene()` 类型声明和文档把成功回调的错误参数描述为 `null`，但 HTML5 预览路径中已实际观察到成功时传入 `undefined`。业务 Promise 适配层不得用 `error !== null` 判断失败，否则会把成功加载转换成 `reject(undefined)`；必须同时排除 `null` 与 `undefined`，并独立校验成功资源是否存在。
- 该行为已通过 HTML5 预览隔离复现：使用 `error !== null` 包装 `loadScene()` 时，点击开始游戏稳定记录“战场加载失败：undefined”；引擎自身在 `cocos/asset/asset-manager/bundle.ts` 和 `asset-manager.ts` 中也使用 `if (err)` 判断失败，而不是严格比较 `null`。
- 验证资源回调适配时，应分别覆盖“错误参数为 `undefined` 且资源有效”“错误对象存在”“错误为空但资源缺失”三种输入；只有第一种可以成功解析，后两种必须返回包含资源标识的明确错误。
- Cocos `.meta` 文件由编辑器管理，禁止手动创建、复制或修改 UUID。
- 代码中能否按名称初始化内置 Effect 与 Editor 中能否选择该 Effect 不是同一契约。需要稳定引用内置 Standard 时，优先由 Editor 创建 Material 并通过场景或 Prefab 序列化引用。
- 新增、移动或重命名资源时只修改实际源文件，让 Cocos Editor 生成或更新对应 `.meta`。

## Scene 切换与递归销毁生命周期

- Cocos Creator 3.8.8 的 `director.runScene()` 不会在调用点立即替换场景，而是在当前帧 `END_FRAME` 执行 `runSceneImmediate()`；旧 Scene 随后进入销毁和同帧 `_deferredDestroy()`。
- 节点的 `_onPreDestroyBase()` 会先销毁自身事件处理器，再递归销毁所有子节点，最后销毁当前节点组件。因此场景入口组件执行 `onDestroy()` 时，它管理的运行时子节点可能已经完成销毁，禁止再对这些子节点调用 `off()`、修改组件或重复 `destroy()`。
- 场景切换时，业务拥有的运行时资源必须在调用 `director.runScene()` 之前主动释放，并先把运行时状态标记为已释放；旧 Scene 随后触发入口组件 `onDestroy()` 时只能命中幂等返回，不得再次执行同一套清理。
- Cocos 对象的 `obj.isValid` 在调用 `destroy()` 的当前帧仍可能为 `true`；`isValid(obj, true)` 虽然会排除 `ToDestroy`，但不表达父节点递归销毁期间的完整业务所有权。不得只靠 `isValid` 猜测是否应销毁，必须先明确资源由业务切场流程还是 Scene 递归销毁负责。
- 节点封装类的兜底 `dispose()` 必须先记录已释放状态，再检查节点是否仍有效；只有节点有效时才能解除节点事件和请求销毁。Renderer 组件已经失效时，不得再清空其 Mesh 或 Material 属性，但独立创建且仍由业务持有的 GPU 资源仍需按其所有权释放。
- 该行为已通过 Cocos Creator 3.8.8 引擎源码 `cocos/game/director.ts`、`cocos/scene-graph/node.ts` 和 `cocos/core/data/object.ts` 验证。隔离验证应在旧 Scene 中创建“入口组件 → 运行时根节点 → 带事件子节点”的层级，切换 Scene 后确认业务清理发生在 `runScene()` 调用前，且入口 `onDestroy()` 不再产生双重销毁或空事件处理器异常。

## 新差异的记录要求

新增规则时必须包含：

1. 容易从哪个框架或通用经验产生错误类比；
2. Cocos 的实际行为和适用版本；
3. 已确认的官方文档、引擎源码位置或最小复现结论；
4. 项目中的强制写法与禁止写法；
5. 能够证明行为正确的隔离验证方法。
