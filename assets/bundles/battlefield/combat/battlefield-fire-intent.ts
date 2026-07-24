/** 只用于纵向弹道求解的世界空间怪物目标。 */
export interface BattlefieldFireElevationTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 输入阶段只保存的手动水平射击方向。 */
export interface BattlefieldFireDirection {
  readonly directionX: number;
  readonly directionZ: number;
}

/** World 原地复用的可写手动水平射击方向。 */
export interface MutableBattlefieldFireDirection extends BattlefieldFireDirection {
  directionX: number;
  directionZ: number;
}

/** 只在真实枪口射线找到怪物后形成的完整射击意图。 */
export interface BattlefieldFireIntent extends BattlefieldFireDirection {
  /** 仅贡献高度和枪口投影距离，绝不修改手动 XZ 方向。 */
  readonly elevationTarget: Readonly<BattlefieldFireElevationTarget>;
}

/** 武器阶段原地复用的世界空间纵向目标。 */
export interface MutableBattlefieldFireElevationTarget
extends BattlefieldFireElevationTarget {
  x: number;
  y: number;
  z: number;
}

/** 武器阶段原地复用的完整射击意图。 */
export interface MutableBattlefieldFireIntent extends BattlefieldFireIntent {
  directionX: number;
  directionZ: number;
  readonly elevationTarget: MutableBattlefieldFireElevationTarget;
}
