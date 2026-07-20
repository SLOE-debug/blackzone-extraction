/**
 * 枚举允许通过运行时服务加载的 Asset Bundle。
 */
export enum BundleId {
  Main = 'main',
  Battlefield = 'battlefield',
  CommonMonsters = 'common-monsters',
}

/**
 * 枚举通过 Feature 注册表解析的领域功能。
 */
export enum FeatureId {
  Battlefield = 'battlefield',
  CommonMonsters = 'common-monsters',
}

/** 枚举允许通过 SceneService 加载和切换的独立场景。 */
export enum SceneId {
  Lobby = 'lobby',
  Battlefield = 'battlefield',
}
