/** 永久箭矢在箭袋、去程、附着与回程之间的唯一状态。 */
export enum BattlefieldArrowState {
  Ready,
  Drawing,
  Flying,
  EmbeddedInMonster,
  EmbeddedInWorld,
  Returning,
}

/** 召回来源决定速度、伤害与拔箭效果。 */
export enum BattlefieldArrowRecallKind {
  None,
  Automatic,
  Skill,
}

/** 固定容量箭矢可组合行为标记。 */
export enum BattlefieldArrowModuleFlag {
  Piercing = 1 << 0,
  Explosive = 1 << 1,
  Conductive = 1 << 2,
  Grappling = 1 << 3,
  Splitting = 1 << 4,
}
