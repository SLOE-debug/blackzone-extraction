# 性能优化计划

## 目标

在不依赖远距离模型简化的前提下，提升战场运行时在低端移动设备和微信小游戏环境中的性能。

当前项目已经采用了许多正确的优化方向，包括：

- SoA 数据布局
- 预分配 `TypedArray`
- 共享材质与动态网格批次
- Unlit 渲染
- 关闭阴影与复杂灯光
- 分帧模拟
- 对象复用
- 区块化世界生成

下一阶段的重点不应该继续压低 Draw Call，而应该集中处理以下问题：

- CPU 重复扫描
- GPU Buffer 全量或前缀上传
- Projectile 对全部怪物的碰撞扫描
- 环境窗口整体重建
- 动态实体数据地址不稳定
- CPU 端程序化顶点动画成本过高

---

## 优先级概览

| 优先级 | 优化项 | 预计收益 |
|---|---|---:|
| P0 | 消除 GPU 上传前的临时数据复制 | 中 |
| P0 | 为 Cocos Buffer 增加目标偏移更新 | 高 |
| P0 | 用共享空间索引替换 Projectile 全量扫描 | 很高 |
| P1 | 使用固定怪物 GPU Slot 与 Dirty Page | 很高 |
| P1 | 使用持久化环境 Chunk Batch | 高 |
| P1 | 使用稠密生命周期索引列表 | 中到高 |
| P2 | 合并高频移动与动画循环 | 中 |
| P2 | 将程序化形变迁移到 GPU 参数 | 很高 |

---

# 1. 消除 GPU 上传前的临时复制

## 当前问题

`DynamicMeshBatch` 可能保存完整的底层 `ArrayBuffer`，然后调用：

```ts
buffer.update(fullBuffer, smallerSize);
```

在 Cocos WebGL 后端中，当传入 Buffer 大于实际上传大小时，可能会先执行类似：

```ts
buffer.slice(0, size);
```

这意味着即使逻辑上只上传部分数据，也可能先在 CPU 端复制出一份临时 Buffer。

这会增加：

- 内存带宽
- 临时对象
- GC 压力
- 低端设备帧抖动

## 优化方式

在 `DynamicMeshBatch` 中直接保存实际的 TypedArray：

```ts
private positionSource: Float32Array | null = null;
private normalSource: Float32Array | null = null;
private colorSource: Float32Array | null = null;
private indexSource: Uint16Array | Uint32Array | null = null;
```

上传活动前缀时，传入精确的视图：

```ts
const componentCount = activeVertexCount * 3;
const source = this.positionSource.subarray(0, componentCount);

this.positionBuffer.update(source);
```

`subarray()` 不复制底层数据，只创建一个共享原始内存的视图。

## 验收标准

- 正常动态网格上传不再产生大块临时 `ArrayBuffer`
- 性能日志记录实际上传字节数
- 连续压力测试中不出现持续增长的临时内存
- GC 峰值明显降低

---

# 2. 为 Cocos Creator 3.8.8 增加局部 Buffer 更新

## 目标

让 `gfx.Buffer.update()` 支持目标 Buffer 内的字节偏移。

当前 WebGL 和 WebGL2 底层命令本身已经支持 offset，但公开接口只把更新写入 Buffer 起始位置。

## 建议接口

```ts
public abstract update(
  buffer: Readonly<BufferSource>,
  size?: number,
  destinationOffset?: number,
): void;
```

第三个参数保持可选，避免破坏引擎现有调用。

## WebGL 实现示意

```ts
public update(
  buffer: Readonly<BufferSource>,
  size?: number,
  destinationOffset = 0,
): void {
  const byteLength = size ?? getBufferSourceByteLength(buffer);

  if (
    !Number.isInteger(destinationOffset)
    || destinationOffset < 0
    || destinationOffset + byteLength > this._size
  ) {
    throw new RangeError('GPU Buffer 更新范围超出分配容量');
  }

  WebGLCmdFuncUpdateBuffer(
    WebGLDeviceManager.instance,
    this._gpuBuffer!,
    buffer,
    destinationOffset,
    byteLength,
  );
}
```

WebGL2 采用同样的修改。

## 引擎维护建议

- 从官方仓库 clone 或 fork `cocos/cocos-engine`
- 固定到 Creator 3.8.8 对应 tag，并在 Creator 中为当前项目配置自定义 TypeScript 引擎路径
- 单独维护一个局部 Buffer 更新分支
- 添加目标偏移和越界测试
- 在游戏侧增加一层适配器
- 不要让业务代码直接访问 WebGL 私有实现

---

# 3. 为 DynamicMeshBatch 增加范围上传接口

建议新增：

```ts
public uploadPositionRange(
  firstVertex: number,
  vertexCount: number,
): void;

public uploadNormalRange(
  firstVertex: number,
  vertexCount: number,
): void;

public uploadColorRange(
  firstVertex: number,
  vertexCount: number,
): void;

public uploadIndexRange(
  firstIndex: number,
  indexCount: number,
): void;
```

位置范围上传示例：

```ts
public uploadPositionRange(
  firstVertex: number,
  vertexCount: number,
): void {
  if (
    vertexCount <= 0
    || this.positionSource === null
    || this.positionBuffer === null
  ) {
    return;
  }

  const firstComponent = firstVertex * 3;
  const componentCount = vertexCount * 3;

  const source = this.positionSource.subarray(
    firstComponent,
    firstComponent + componentCount,
  );

  this.positionBuffer.update(
    source,
    source.byteLength,
    firstComponent * Float32Array.BYTES_PER_ELEMENT,
  );
}
```

开发环境中应检查：

- 起始位置不能为负数
- 数量不能为负数
- 必须是整数
- 不能超出容量
- 必须符合属性组件对齐
- Byte Offset 必须正确

---

# 4. 使用固定怪物 GPU Slot

## 当前问题

共享怪物网格如果按照“当前可见怪物”紧凑排列，任何怪物进入或离开可见集合后，后续怪物都可能移动到新的 GPU 区间。

例如：

```text
Slot 0 = Monster 5
Slot 1 = Monster 8
Slot 2 = Monster 11
Slot 3 = Monster 15
```

Monster 8 不再可见后，可能变成：

```text
Slot 0 = Monster 5
Slot 1 = Monster 11
Slot 2 = Monster 15
```

即使 Monster 11 和 Monster 15 的动画没有变化，它们仍然需要重写顶点。

这种紧凑搬迁会严重削弱局部更新的收益。

## 新布局

为每个实体分配固定 GPU 区间：

```ts
const firstVertex = entityIndex * verticesPerMonster;
const firstIndex = entityIndex * indicesPerMonster;
```

怪物在整个生命周期中保持相同 GPU Slot。

## 可见性处理

可见性变化不移动顶点，只改变活动索引列表。

```text
Vertex Buffer：
固定保存所有怪物 Slot 的顶点

Index Buffer：
只提交当前需要绘制的怪物 Slot
```

## 收益

- 相机移动不会搬迁其他怪物顶点
- 出生和回收不会重写后续怪物
- CPU Dirty Range 与 GPU Range 一致
- 每个实体的内存地址稳定
- 局部上传更容易实现
- 方便后续页级双缓冲

## 内存统计

启动时记录：

```text
monsterVertexCapacityBytes
monsterIndexCapacityBytes
monsterCpuScratchBytes
```

固定 Slot 会增加预留容量，因此必须在目标设备上确认内存可接受。

---

# 5. 使用 Dirty Page 和连续范围合并

不要每只怪物调用一次 `bufferSubData`。

每次 Buffer 更新都可能带来：

- GL 命令开销
- VAO 或 InputAssembler 缓存失效
- Buffer 重新绑定
- JS 到图形层调用成本

## 推荐页大小

```ts
const MONSTERS_PER_PAGE = 16;
const PAGE_SHIFT = 4;
```

维护页级 Dirty Flag：

```ts
positionPageDirty: Uint8Array;
colorPageDirty: Uint8Array;
indexPageDirty: Uint8Array;
```

怪物更新后标记：

```ts
positionPageDirty[entityIndex >> PAGE_SHIFT] = 1;
```

## 合并相邻 Dirty Page

```text
2, 3, 4 -> 合并为一个上传范围
7, 8    -> 合并为一个上传范围
12      -> 单独上传
```

这样 6 个脏页只需要 3 次上传。

## 自适应完整上传

局部上传并不总是更快。

当脏范围过多或脏数据比例过高时，应回退到完整活动范围上传：

```ts
if (
  dirtyRangeCount > maximumPartialUploadCount
  || dirtyVertexCount / activeVertexCount >= fullUploadRatio
) {
  uploadFullActiveRange();
} else {
  uploadMergedDirtyRanges();
}
```

初始测试值：

```text
maximumPartialUploadCount = 8
fullUploadRatio = 0.5
```

最终阈值必须通过低端 Android 和 iOS 真机测试确定。

---

# 6. 建立共享怪物空间索引

## 当前问题

Projectile 碰撞目前可能接近：

```text
活动 Projectile 数量 × 怪物容量
```

随着以下玩法增加，成本会快速放大：

- 自动步枪
- 冲锋枪
- 霰弹枪
- 穿透
- 弹射
- 分裂弹
- 连锁攻击
- 多重投射物
- 高射速词条组合

## 新服务

建立战场级共享空间索引：

```ts
class BattlefieldMonsterSpatialIndex {
  rebuild(...): void;
  querySegment(...): void;
  queryCircle(...): void;
  queryCone(...): void;
  queryNearest(...): void;
  queryNeighbors(...): void;
}
```

使用：

- 预分配 TypedArray
- 固定 Bucket
- 稳定实体 Handle
- 无热路径对象创建
- 固定容量候选缓存

## 更新顺序

```text
怪物移动
-> 分离修正
-> 重建一次空间索引
-> Projectile / Hitscan 查询
-> 自动瞄准查询
-> 范围技能查询
```

如果武器系统必须在怪物移动之前运行，可以使用上一帧已经构建完成的空间索引，而不是一帧重建多次。

## 线段查询

建议分两阶段：

1. 遍历射线或线段经过的网格单元
2. 只对附近候选执行精确碰撞

长距离高速 Projectile 可使用 2D DDA 网格遍历。

## 共享用途

同一个索引应该服务于：

- Projectile 碰撞
- Hitscan
- 自动瞄准
- 最近目标
- 近战扇形
- 爆炸
- 毒池
- 连锁闪电
- 怪物分离候选
- 吸附和牵引效果

不要为每个玩法分别维护一次全量扫描。

---

# 7. 高速枪械改为 Hitscan

以下武器更适合即时线段命中：

- 手枪
- 突击步枪
- 冲锋枪
- 霰弹枪

开火帧立即完成命中结算，再创建一个不带碰撞逻辑的短生命周期 Tracer。

保留真实模拟 Projectile 的类型：

- 毒液炸弹
- 手雷
- 慢速魔法弹
- 火球
- 可以被玩家躲避的 Boss Projectile

这样可以避免：

```text
射速 × 子弹存活帧数 × 怪物数量
```

导致的碰撞成本放大。

---

# 8. 环境改为持久化 Chunk Batch

## 当前问题

把整个活动窗口合成一个 Mesh，可以减少 Draw Call，但会带来：

- 每次跨 Chunk 重建整个窗口
- 大量顶点与索引重新生成
- 大块 TypedArray 分配
- 新 Mesh / GPU Buffer 创建
- 旧资源销毁
- 无法进行 Chunk 级视锥剔除
- 单个 Chunk 改变导致整体更新

## 新设计

使用固定 Chunk Batch 池：

```text
3 × 3 或 5 × 5 活动 Chunk Slot
```

玩家跨 Chunk 时：

1. 保留没有变化的 Chunk
2. 回收离开窗口的 Chunk Slot
3. 只生成进入窗口的新行或新列
4. 在原有 Chunk Buffer 上更新数据
5. 复用 Node、MeshRenderer、Material 和 TypedArray

## 预期权衡

Draw Call 可能增加到：

```text
9 ～ 25
```

但能够换来：

- CPU 重建量显著降低
- Chunk 级视锥剔除
- 更少 Mesh 创建和销毁
- 更少大块临时分配
- 更稳定的跨区块帧时间

对于当前项目，20 到 40 左右 Draw Call 通常比每次整体重建更合理。

---

# 9. 使用稠密生命周期索引列表

当前许多系统会遍历 `state.count`，再根据生命周期跳过不相关实体。

可以维护稠密列表：

```ts
aliveIndices: Uint16Array;
spawningIndices: Uint16Array;
dyingIndices: Uint16Array;
residentIndices: Uint16Array;
```

同时维护反向位置：

```ts
slotToAlivePosition: Int16Array;
slotToSpawningPosition: Int16Array;
slotToDyingPosition: Int16Array;
slotToResidentPosition: Int16Array;
```

删除时使用 Swap Remove：

```text
被删除位置 = 最后一个有效元素
列表长度减一
更新反向映射
```

## 系统迭代方式

```text
移动与普通动画 -> aliveIndices
出生动画       -> spawningIndices
死亡和液体效果 -> dyingIndices
可见性和渲染   -> residentIndices
```

这样系统成本与实际活动实体数相关，而不是与最大容量相关。

---

# 10. 合并高频移动和动画循环

ECS 的系统边界有利于维护，但高频热路径不一定要严格保持多个完整循环。

如果多个系统反复读取和写入同一批数组，可以合并为一个 Alive Monster Kernel：

- 速度阻尼
- 朝向阻尼
- `sin/cos`
- 世界坐标
- 步态相位
- Crouch
- Bite
- Turn Blend
- Body Pulse
- Render Dirty Flag

仍然保持独立的低频系统：

- 目标决策
- 战斗决策
- 感知
- 分离
- 重生
- 刷怪维护

这样可以减少：

- 重复数组扫描
- 重复生命周期检查
- 重复属性访问
- 多次函数调用
- 缓存失效

---

# 11. 长期方向：GPU 程序化动画

当前怪物模型和动画由 TypeScript 动态计算顶点。

长期可以把网格改为静态局部模型，并为每个顶点写入程序化元数据：

```text
部位编号
腿编号
沿肢体归一化位置
局部坐标
可选关节权重
```

每只怪物只上传少量参数：

```text
位置
朝向
动画相位
当前速度
Bite
Crouch
Turn
Body Pulse
生命周期进度
颜色
Hit Flash
```

由 Vertex Shader 重建程序化姿态。

## 收益

CPU 不再每帧重新生成完整怪物顶点，只需要更新每只怪物的小型参数记录。

这不是 LOD：

- 模型没有简化
- 动画没有关闭
- 远近使用同一套几何结构
- 只是把顶点形变从 CPU 转移到 GPU

---

# 12. 可选双缓冲或三缓冲

即使采用局部上传，如果 CPU 正在写入 GPU 当前使用的 Buffer，仍可能出现 Stall。

只有在真机分析确认存在上传等待后，再考虑：

```ts
const bufferIndex = frameSequence % bufferCount;
```

建议优先对高频 Dirty Page 做双缓冲，而不是对全部最大容量网格做三份完整复制。

---

# 13. 性能诊断指标

## GPU 上传

```text
positionUploadCalls
colorUploadCalls
indexUploadCalls
positionBytesUploaded
colorBytesUploaded
indexBytesUploaded
fullBufferUploads
partialBufferUploads
dirtyMonsterPages
```

## 几何生成

```text
monsterVerticesEvaluated
environmentVerticesRebuilt
groundVerticesRebuilt
dynamicMeshCreations
dynamicMeshDisposals
```

## 碰撞

```text
activeProjectiles
projectileSegmentQueries
spatialCellsVisited
projectileCandidatesTested
projectileNarrowPhaseTests
hitscanQueries
```

## 生命周期

```text
monsterCapacity
residentMonsters
aliveMonsters
spawningMonsters
dyingMonsters
visibleMonsters
```

## 帧稳定性

```text
averageUpdateMilliseconds
maximumUpdateMilliseconds
p95UpdateMilliseconds
p99UpdateMilliseconds
averageFrameInterval
maximumFrameInterval
```

相比只看最大值，P95 和 P99 更适合判断实际游戏体验是否稳定。

---

# 14. 基准测试场景

## 场景 A：怪物渲染基线

- 220 只 Curve Crawler
- 不开火
- 固定相机
- 正常动画

用于测量：

- CPU 动画
- 顶点计算
- GPU 上传
- 怪物模拟基础成本

## 场景 B：相机运动

- 220 只 Curve Crawler
- 持续移动和旋转相机
- 不开火

用于测量：

- 可见性变化
- Index Buffer 更新
- 是否存在不必要的顶点搬迁

## 场景 C：自动武器

- 怪物冻结
- 持续使用 Vector

用于测量：

- Projectile 或 Hitscan 查询成本
- 候选数量
- 窄相位测试数量

## 场景 D：霰弹枪

- 怪物冻结
- 持续多弹丸射击

用于测量：

- Pellet 数量对碰撞成本的放大
- 空间索引收益

## 场景 E：跨 Chunk

- 关闭怪物
- 持续跨越区块边界

用于测量：

- 环境重建峰值
- TypedArray 分配
- Mesh 创建与销毁
- GPU Buffer 替换

## 场景 F：综合压力

- 最大预期怪物波次
- 持续自动开火
- Loot 与特效同时存在
- 持续跨区块移动

这是发布前的主要压力测试。

---

# 15. 推荐实施顺序

## 第一阶段：低风险修正

1. 增加 GPU 上传字节统计
2. 增加碰撞候选统计
3. 改用精确 TypedArray View
4. 消除临时 Buffer Copy
5. 记录 GC 和帧时间变化

## 第二阶段：碰撞架构

1. 建立共享怪物空间索引
2. Projectile 查询改用空间索引
3. 自动瞄准和范围技能复用同一索引
4. 高速枪械改为 Hitscan

## 第三阶段：引擎局部上传

1. 克隆 Cocos Creator 3.8.8 引擎并配置项目级自定义 TypeScript 引擎
2. 为 `gfx.Buffer.update()` 增加目标偏移
3. 实现 WebGL
4. 实现 WebGL2
5. 增加测试
6. 为 `DynamicMeshBatch` 增加 Range Upload

## 第四阶段：固定 GPU 存储

1. 为怪物分配固定 GPU Slot
2. 顶点与可见索引分离
3. 增加 Dirty Page
4. 合并连续脏页
5. 增加完整上传回退阈值

## 第五阶段：环境 Chunk 池

1. 移除完整活动窗口重建
2. 建立 3×3 或 5×5 持久化 Chunk Pool
3. 只生成进入窗口的 Chunk
4. 复用 Buffer 容量
5. 增加 Chunk 级剔除

## 第六阶段：模拟热路径

1. 增加生命周期稠密列表
2. 移动系统改为遍历 Alive List
3. 动画系统改为遍历相关列表
4. 合并最热的移动与动画循环

## 第七阶段：GPU 动画验证

1. 只选择一个 Curve Crawler 部位进行原型
2. 比较 CPU 时间
3. 比较上传字节
4. 比较 GPU 时间
5. 验证微信小游戏兼容性
6. 确认视觉一致后再扩大范围

---

# 发布验收标准

每个重大优化都应通过：

- 桌面 WebGL2 正确性
- 微信开发者工具正确性
- 低端 Android 真机测试
- iOS 真机测试
- 重复跨 Chunk 内存稳定性
- 怪物出生、攻击、受击、死亡和回收测试
- 程序化动画视觉回归
- 15 分钟综合压力测试

初始目标：

```text
30 FPS 帧间隔：<= 33.3 ms
P95 游戏逻辑耗时：<= 12 ms
P99 游戏逻辑耗时：<= 18 ms
重复跨 Chunk 峰值不超过 33.3 ms
15 分钟压力测试无持续内存增长
```

这些目标应根据真实设备基线继续调整。

---

# 核心原则

1. Draw Call 更少不一定更快。
2. 工作量应该与发生变化的实体数量相关，而不是与最大容量相关。
3. CPU Dirty Range 与 GPU Upload Range 必须保持一致。
4. 对动态实体来说，稳定的数据地址比紧凑搬迁更有价值。
5. 空间索引应该被多个玩法系统共享。
6. 持久化资源池优于完整 Mesh 替换。
7. 局部上传必须合并，避免 GL 命令过多。
8. 当大部分数据变脏时，完整上传依然是正确策略。
9. 真机 P95/P99 比编辑器平均值更重要。
10. 优化数据流，而不是牺牲 Low Poly 视觉效果。
