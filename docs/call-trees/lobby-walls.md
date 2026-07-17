# 大厅墙壁程序化几何调用树

## 1. 静态大厅初始化

```text
LobbySceneRuntime.initialize()
└─ new LobbyRenderer(parent, materialTemplate)
   ├─ new LobbyMaterials()
   ├─ createStaticSurfaceGeometry(LOBBY_OPAQUE_TOPOLOGY)
   ├─ TriangleMeshWriter.reset(true)
   ├─ lobbyOpaqueGeometry.write(writer)
   │  └─ GeometrySectionComposer
   │     ├─ Floor
   │     ├─ FloorCracks
   │     ├─ Ceiling
   │     ├─ BackWall
   │     ├─ FrontWall
   │     ├─ SideWalls
   │     └─ 祭台、窗框和灯具等其他区段
   ├─ lobbyVertexShading.update(geometry, sectionRanges)
   └─ StaticSurfaceMesh.initialize()
      └─ MeshUtils.createMesh()
```

大厅墙体只在初始化时生成一次，之后不逐帧重算。

## 2. 前墙、侧墙和天花板的统一参数化路线

```text
writeLobbyFrontWall()
或 writeLobbySideWalls()
或 writeLobbyCeiling()
└─ writeLobbyHallSurface(writer, LobbyHallSurfaceId)
   ├─ 从 LOBBY_HALL_SURFACE_RECIPES 读取 Recipe
   │  ├─ columns / rows
   │  ├─ width / height
   │  ├─ SurfaceFrame: origin + U/V/N 坐标基
   │  ├─ 交替对角线策略
   │  ├─ 三角形绕序
   │  └─ 固定 seed 与形变参数
   └─ appendFlatGridPatch(writer, spec, context)
      ├─ 采样 (columns + 1) × (rows + 1) 个共享网格点
      ├─ sampleLobbySurface()
      │  ├─ 切向 U/V 确定性扰动
      │  └─ 法向 Jitter 或 CaveRelief
      │     ├─ 边缘衰减
      │     ├─ 两组宽缓岩体隆起
      │     ├─ 正弦脊线
      │     └─ 固定 seed 细节
      ├─ SurfaceFrame 将局部 U/V/N 映射到世界 XYZ
      └─ 每个 Grid Cell 按交替对角线拆成 2 个三角形
         └─ appendLobbyTriangle()
            ├─ 由绕序计算单位面法线
            └─ 每个三角形写 3 个独立顶点
```

`SurfaceFrame` 让同一个 Grid Patch 算法能够生成水平地面、向下的天花板和朝向大厅内部的不同墙面，而不在核心算法里硬编码世界轴。

## 3. 带圆形观察窗的后墙特殊路线

后墙不能使用完整矩形 Grid，因为中央有圆形开口，因此使用领域化径向带状拓扑：

```text
writeLobbyBackWall()
└─ writeLobbyObservationWall(writer)
   └─ 循环 32 个圆周 segment
      ├─ Opening Band：圆形洞口边缘
      ├─ Relief Band：中间岩壁起伏环
      ├─ Boundary Band：射线与矩形墙边界交点
      ├─ Opening -> Relief：2 triangles
      └─ Relief -> Boundary：2 triangles
```

窗框和玻璃分别生成：

```text
writeLobbyObservationFrame()
└─ 内外轮廓 × 前后深度，形成厚框

writeLobbyObservationGlass()
└─ 中心点 + 32 个圆周点，形成透明 Triangle Fan
```

## 4. 固定拓扑规模

| 表面 | 三角形数 | 生成方式 |
| --- | ---: | --- |
| Floor | 84 | `6 × 7` Flat Grid |
| Ceiling | 140 | `10 × 7` Cave Grid |
| Back Wall | 128 | 32 段、每段 4 个三角形 |
| Front Wall | 140 | `10 × 7` Cave Grid |
| Left + Right Walls | 336 | 每侧 `12 × 7` Cave Grid |
| Lobby Opaque 全部区段 | 1528 | 墙体加祭台、窗框、裂缝和灯具 |

## 5. 当前技术路线

- 用类型化 Recipe 描述曲面参数，不为每个方向复制一套网格算法。
- 用固定 seed 的数学扰动获得可复现的不规则岩体轮廓。
- 边界点不扰动，确保相邻墙面和洞口边界闭合。
- 采样阶段共享网格点，输出阶段为 Flat Shading 展开独立三角形顶点。
- 顶点色只提供区段基础色和克制面差，真实 SpotLight、Ambient 和 ShadowMap 负责最终光照。
- 静态 Mesh 初始化后不再更新，适合大厅这类固定环境。
