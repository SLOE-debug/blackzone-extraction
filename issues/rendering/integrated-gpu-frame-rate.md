# 集显环境下大厅帧率未达到 60 FPS

## 问题现象

大厅场景在性能较好的设备上可以稳定达到 60 FPS，但在公司电脑的集成显卡环境中通常只有 50 多 FPS。

当前 Profiler 中的典型数据如下：

- Draw Call：约 5；
- Triangle：约 4876；
- Renderer CPU 时间较低；
- 实际帧率在 50 多 FPS，无法稳定达到 60 FPS。

## 初步结论

当前问题不是 Draw Call 数量过多。大厅已经把主要内容合并为一个不透明受光 Mesh 和一个发光 Mesh，5 个 Draw Call 对该场景而言已经很低。

更可能的瓶颈是集显的像素处理能力、内存带宽和阴影采样成本。实时阴影会增加 Shadow Map 渲染，但单盏 SpotLight 本身不等于大量 Draw Call。

当前动态分辨率策略还存在一个明显的保持区间：

- 平均帧率低于 55 FPS 时降低渲染比例；
- 平均帧率达到 59 FPS 时才进入恢复流程；
- 平均帧率处于 55～59 FPS 时不调整渲染比例。

因此，集显如果长期运行在 56～58 FPS，渲染比例会继续保持为 1，不会主动降档以争取稳定 60 FPS。

## 当前实现依据

### 场景已经完成主要合批

`assets/lobby/rendering/lobby-renderer.ts` 中只创建以下两个大厅静态表面：

- `LobbyOpaqueSurface`：使用 Standard 材质，投射并接收阴影；
- `LobbyEmissiveSurface`：使用 Unlit 材质，不参与阴影。

因此，不应为了降低 Draw Call 再把大厅拆分成更多 Mesh。拆分后主渲染提交次数反而可能增加。

### 当前启用了实时 Shadow Map

`assets/lobby/scene/lobby-scene-runtime.ts` 中启用了全局 Shadow Map：

```ts
scene.globals.shadows.enabled = true;
scene.globals.shadows.type = renderer.scene.ShadowType.ShadowMap;
scene.globals.shadows.shadowMapSize = LOBBY_RENDER_QUALITY.shadowMapSize;
```

`assets/lobby/scene/lobby-lighting.ts` 中还启用了 SpotLight 实时阴影和 PCF 滤波。

### Web 使用较高的阴影质量

`assets/lobby/model/lobby-render-quality.ts` 当前为 Web 平台配置：

```ts
{
  shadowMapSize: 1024,
  shadowFiltering: LobbyShadowFiltering.Soft2X,
}
```

1024 阴影贴图不会直接增加 Draw Call 数量，但会提高阴影贴图填充、带宽和采样成本。Soft2X 也会增加受光表面的阴影采样开销。

### 动态分辨率无法处理 55～59 FPS

`assets/core/performance/runtime-performance-profile.ts` 当前配置为：

```ts
{
  slowFrameRate: 55,
  recoveryFrameRate: 59,
  initialScale: 1,
  minimumScale: 0.65,
  maximumScale: 1,
}
```

`assets/core/performance/adaptive-render-scale.ts` 只在平均帧率严格低于 `slowFrameRate` 时降低渲染比例。因此，50 多 FPS 不一定会触发降档。

## 为什么 Draw Call 很低仍然可能掉帧

Draw Call 主要反映 CPU 向 GPU 提交绘制命令的次数，不直接代表每次绘制需要完成多少 GPU 工作。

当前大厅的单次主渲染仍可能包含：

- Standard/PBR 表面计算；
- SpotLight 实时光照；
- Shadow Map 查询；
- Soft2X PCF 阴影采样；
- 环境光、顶点色和高光计算；
- 覆盖大部分屏幕的墙面、地面和祭坛像素。

一个 Draw Call 可以覆盖数百万个像素。集显即使处理很少的 Draw Call，也可能受限于像素填充率和共享内存带宽。

显示分辨率也会显著放大差异：

| 分辨率 | 每帧像素数量 | 相对 720p 的像素量 |
| --- | ---: | ---: |
| 1280×720 | 约 92 万 | 1 倍 |
| 1920×1080 | 约 207 万 | 2.25 倍 |
| 2560×1440 | 约 369 万 | 4 倍 |

如果公司电脑使用更高的显示分辨率、浏览器设备像素比或系统缩放，实际渲染像素数量可能明显高于测试设备。

## Profiler 数据注意事项

Cocos Creator 3.8.8 的 `Frame time` 和 `Renderer` 时间主要反映 CPU 更新、渲染提交和 Present 调用，不完整代表 GPU 异步执行时间，也不包含所有 VSync 和浏览器帧调度等待。

因此，出现 `Frame time` 很低但实际只有 50 多 FPS 并不矛盾。不能用 `1000 / Frame time` 推断设备理论帧率。

## 建议的验证顺序

### 1. 关闭实时阴影

使用大厅调试面板中的“实时阴影”开关进行对照测试，保持窗口大小、相机和浏览器环境不变。

- 如果帧率从 50 多提升到稳定 60，主要瓶颈是阴影贴图和阴影采样；
- 如果帧率几乎不变，应继续检查渲染分辨率、硬件加速和浏览器调度。

关闭阴影不会关闭 SpotLight。真实灯光照明仍然存在，只是不再产生动态遮挡阴影。

### 2. 降低阴影质量

保留实时阴影，将质量改为：

```ts
{
  shadowMapSize: 512,
  shadowFiltering: LobbyShadowFiltering.Hard,
}
```

如果帧率明显改善，可以将该配置作为集显或低画质档位。此修改主要降低 GPU 成本，通常不会改变 Draw Call 数量。

### 3. 降低渲染分辨率

缩小浏览器窗口，或临时把 `shadingScale` 调低到 0.8 左右进行对照。

- 如果帧率随分辨率降低而明显提升，可以确认瓶颈主要是像素填充率；
- 如果降低分辨率仍无改善，应优先排查浏览器、驱动、帧率限制和电源策略。

### 4. 检查运行环境

在公司电脑上检查：

- `chrome://gpu` 中 WebGL 是否使用硬件加速；
- 浏览器硬件加速是否被公司策略关闭；
- Windows 是否处于节能模式；
- 笔记本是否未接电源；
- 是否通过远程桌面运行；
- 是否在 Cocos Editor 预览环境而非独立构建中测试；
- 浏览器窗口分辨率和 `devicePixelRatio` 是否与其他设备一致。

## 建议的处理方案

### 优先调整动态分辨率触发范围

如果目标是尽量稳定 60 FPS，可以考虑把降档阈值从 55 提高到 58 左右，缩小当前过宽的保持区间：

```ts
{
  slowFrameRate: 58,
  recoveryFrameRate: 59,
}
```

调整后，持续运行在 56～57 FPS 的设备会逐级降低渲染比例。需要通过公司集显和性能较好设备共同验证，避免渲染比例在阈值附近频繁波动。

### 提供类型化画质档位

建议最终提供三个明确的阴影质量档位：

| 档位 | Shadow Map | 滤波 | 实时阴影 |
| --- | ---: | --- | --- |
| 高 | 1024 | Soft2X | 开启 |
| 中 | 512 | Hard | 开启 |
| 低 | 无 | 无 | 关闭，保留 SpotLight |

如果低画质仍需保留阴影轮廓，可以进一步评估静态顶点色烘焙或低成本假阴影，但不应在没有验证瓶颈前提前增加额外实现。

## 不建议的处理方式

- 不要仅为降低阴影成本把当前大厅拆成大量独立 Mesh；
- 不要只盯 Draw Call，而忽略分辨率、阴影滤波和材质像素成本；
- 不要因为 Profiler 的 CPU `Frame time` 很低就排除 GPU 瓶颈；
- 不要同时修改多个变量后再比较结果，应按验证顺序逐项测试。

## 推荐结论

当前最可能的原因组合是：

> 集显像素性能和共享内存带宽较弱，加上 1024 Soft2X 实时阴影、全分辨率渲染，以及动态分辨率没有在 55～59 FPS 区间触发。

优先通过关闭阴影、降低阴影质量和降低渲染分辨率完成三组对照测试。确认瓶颈后，再决定采用更积极的动态分辨率阈值或增加正式画质档位。
