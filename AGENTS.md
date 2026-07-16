# 项目 Agent 自述

## 核心原则

- 代码以强类型为先，优先使用接口、泛型、枚举、只读类型、映射类型、条件类型和明确的领域模型。
- 高内聚、低耦合是强制架构约束，不是可选优化；职责边界不清时必须先拆分再继续实现。
- 不把运行时协议写成散落字符串；Bundle、Feature、Scene、Asset、怪物原型和渲染层标识必须来自枚举、清单或类型化 key。
- 充分利用 TypeScript 的类型推导、泛型约束、`satisfies`、判别联合和元数据注册能力，避免弱类型服务定位和字符串式分发。
- 文件和文件夹命名必须使用小写；`AGENTS.md` 属于约定文件名例外。
- 入口文件只做注册和编排，不承载转换、映射、构造、解析、校验、持久化、渲染或业务细节。

## 高内聚与低耦合

- 每个模块只拥有一种明确职责；行为决策、移动、动画、几何生成、渲染适配和群体生命周期不得混在同一个类或文件中。
- Feature 特有逻辑必须留在对应 Feature Bundle；只有能够被多个 Feature 复用的稳定契约、数据结构和算法才能进入 `assets/core`。
- core 不得 import 任何具体 Feature 实现；Feature 可以单向依赖 core 的稳定契约和服务。
- 不同 Feature Bundle 之间禁止直接 import；跨 Feature 通信必须经过 core 中的契约、注册表或服务。
- 对外只暴露稳定门面和只读契约，不暴露可被任意修改的内部 SoA 数据、渲染批次或系统实例。
- 不为了追求“通用”而提前制造空抽象；泛型必须表达真实的输入输出关系或复用边界。

## 模块边界

- `assets/core` 放主包稳定基础设施：Bundle/Feature 加载、泛型实体表、通用 geometry、批渲染适配和跨 Feature 契约。
- `assets/bundles/common-monsters` 是普通怪物真实 Asset Bundle，保存具名怪物原型、Bundle 入口及其领域实现。
- `common-monsters` 只能依赖 core，不得依赖其他自定义 Bundle；它不是可跨项目独立发布的 Bundle。
- Bundle 入口只能执行 Feature 注册，不得直接创建实体、材质、场景节点或玩法状态。
- 主包和其他 Feature 不得静态 import `common-monsters` 的具体实现；必须通过 `BundleId`、Feature 清单、`BundleService` 和 `FeatureLoader` 加载。

## 实体目录规范

- 怪物组和怪物原型必须使用领域语义命名，禁止 `monster1`、`monster2`、`enemy-a` 等数字或占位式命名。
- 每种实体必须拥有独立目录，禁止多个怪物共享一个杂乱的 `types.ts`、`animations.ts` 或 `entities.ts`。
- 怪物实体目录必须按职责细分为 `model`、`behavior`、`movement`、`animation`、`geometry`、`rendering`、`population`；缺少某项职责时可以不创建对应目录。
- `model` 只保存 Schema、状态、配置和领域枚举；`behavior` 只产生决策与意图；`movement` 只处理位移；`animation` 只处理姿态状态。
- `geometry` 只把实体状态转换为固定拓扑顶点；`rendering` 只负责引擎资源和 GPU 上传；`population` 只编排系统顺序与生命周期。
- 新增怪物时必须先加入类型化怪物清单，再增加对应工厂映射，不得写字符串 `switch` 或数字编号分发。

## 性能规范

- 大量同类实体的高频数据优先使用 SoA 和 TypedArray，系统按连续实体索引批处理。
- 高频更新路径禁止逐帧创建临时对象、数组、Cocos `Vec2`/`Vec3` 或闭包；初始化阶段的少量分配不受此限制。
- 固定拓扑实体在初始化后不得重写索引缓冲；运行时只更新发生变化的顶点流。
- 批容量必须由拓扑和索引格式计算，禁止散落人工上限或未经解释的魔法数字。
- 几何算法不得依赖 Cocos 节点、材质或渲染器；引擎适配必须位于 rendering 模块。

## 加载规范

- 禁止在业务代码中直接写 `loadBundle("...")`、`bundle.load("...")`、拼接资源路径或散落 Bundle 名称。
- Bundle 加载必须经过 `BundleId`、`BUNDLE_MANIFEST` 和 `BundleService`。
- Feature 加载必须经过 `FeatureId`、Feature 清单、`FeatureLoader` 和类型化 Feature 注册表。
- 新增 Bundle 或 Feature 时先补强类型清单，再接入加载调用点。

## Cocos 元数据

- **禁止手动创建、复制或修改 Cocos `.meta` 文件。**
- 新增、移动或重命名 TypeScript、资源及目录时，只处理实际源文件；对应 `.meta` 文件统一由 Cocos 编辑器自动生成和维护。
- 不要为了让文件与 `.meta` 成对出现而预生成 UUID，也不要复制其他资源的 `.meta` 作为模板。

## Cocos 引擎规则

- 涉及 Cocos Creator API、坐标与方向、节点变换、相机、灯光、材质、渲染或资源契约时，必须先完整阅读 `.agents/rules/cocos-engine-differences.md`。
- 发现 Cocos 与 Three.js、Unity、Godot、WebGL 或常见框架存在容易误判的行为差异时，应更新该规则文件，不要把详细差异持续堆入根 `AGENTS.md`。

## 程序化 Low Poly 美术规则

- 项目统一画风是“不规则、分面式、带洞穴岩体感的程序化 Low Poly”；大厅墙面、地面、天花板和双层祭台是风格基准。
- 涉及任何新增或重做的可见三维场景、建筑、道具、角色、怪物或实体特效时，必须先完整阅读 `.agents/rules/procedural-low-poly-art-style.md`。
- 主体可见模型必须由代码生成具有领域语义的低密度三角网格，并包含受控、确定、可复现的非均匀轮廓或分面变化。
- 禁止使用 Cocos 内置 Box、Sphere、Cylinder、Capsule、Cone、Plane 等 Primitive 作为最终模型，也禁止通过缩放、穿插或节点堆叠 Primitive 拼凑造型。
- 通用 Geometry 工具只能作为生成基础；未经不规则化、低段数化和领域化改造的完美规则几何不得进入最终画面。

## 实现规范

- 单文件超过 500 行前必须先评估拆分。
- 不为了减少补丁次数把 helper、模型、转换逻辑或工具逻辑塞进入口文件。
- 除非用户明确要求，不添加兼容分支、回退逻辑、双写逻辑或新旧字段映射。
- 不主动运行编译或构建命令；编译和构建由用户自行负责。

## 注释规范

- 注释内容必须使用中文；除代码标识、平台名、API 名称等无法替代的专有名词外，不写英文说明句。
- 方法、函数、类和接口优先使用 TypeScript 风格的详细注释，即 `/** ... */`。
- `/** ... */` 注释应说明职责、参数含义、返回值和关键约束，不写空泛描述。
- 变量、成员字段和局部状态如果含义不是一眼明确，必须补充 `// xxx` 形式的简短注释。
- 注释用于解释命名无法直接表达的意图、约束和边界，不替代清晰命名。
