/** 行为模块、碰撞与后续 Reaction 共享的标准事件类型。 */
export enum BattlefieldCombatEventType {
  EntityBecameGrabbable,
  GrabStarted,
  EntityGrabbed,
  GrabCancelled,
  ThrowAimingStarted,
  EntityThrown,
  EntityCollision,
  GroundImpact,
  EntityImpact,
  HeavyImpact,
  EntityKilled,
  StatusApplied,
  StatusRemoved,
}

/** 事件缓冲拒绝链式写入时保存的诊断原因。 */
export enum BattlefieldCombatEventRejection {
  None,
  Capacity,
  MaximumDepth,
  RepeatedEvent,
}
