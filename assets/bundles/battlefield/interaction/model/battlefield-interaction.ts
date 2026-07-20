/** 右侧操作区能够呈现和触发的强类型场景交互。 */
export enum BattlefieldInteractionAction {
  OpenContainer,
  PickupEquipment,
}

/** 交互提供者写入的可复用最近候选。 */
export interface MutableBattlefieldInteractionCandidate {
  sourceId: number;
  action: BattlefieldInteractionAction;
  x: number;
  z: number;
  distanceSquared: number;
}

/** 怪物、容器、掉落物或任务物体可实现的近距离交互门面。 */
export interface BattlefieldInteractionProvider {
  /** 查找当前提供者在玩家附近的最近候选。 */
  writeNearestInteraction(
    playerX: number,
    playerZ: number,
    result: MutableBattlefieldInteractionCandidate,
  ): boolean;

  /** 激活此前返回的候选；候选已失效时返回 false。 */
  activateInteraction(sourceId: number, action: BattlefieldInteractionAction): boolean;
}
