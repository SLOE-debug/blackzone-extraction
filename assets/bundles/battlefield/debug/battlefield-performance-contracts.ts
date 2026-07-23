/** 战场每帧编排中需要独立观察的 CPU 阶段。 */
export enum BattlefieldPerformanceStage {
  Control,
  Player,
  Environment,
  WorldSynchronization,
  Weapon,
  Monsters,
  Status,
  Treasures,
  CameraAndInteraction,
  Count,
}

/** 两秒诊断窗口内需要累计次数或数值的离散事件。 */
export enum BattlefieldPerformanceEvent {
  ChunkTransition,
  ChunksAdded,
  ChunksRemoved,
  ChestOpened,
  LootReleased,
  EquipmentPicked,
  PlayerDamage,
  MonsterBatchGrowth,
  MonsterBatchCapacityAdded,
  ProjectilesSpawned,
  ProjectilesIntegrated,
  ProjectileBroadPhaseCandidates,
  ProjectileNarrowPhaseHits,
  ProjectileImpactsQueued,
  ProjectileDamageEventsApplied,
  Count,
}
