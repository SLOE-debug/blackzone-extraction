/** 怪物可参与战斗行为组合的统一标签位。 */
export enum CombatTag {
  None = 0,
  Poisoned = 1 << 0,
  Burning = 1 << 1,
  Frozen = 1 << 2,
  Explosive = 1 << 3,
  Armored = 1 << 4,
  Elite = 1 << 5,
  SmallBody = 1 << 6,
  Executable = 1 << 7,
}

/** 怪物体型分级，供通用行为模块判断可抓取边界。 */
export enum MonsterBodySize {
  Small,
  Medium,
  Large,
}

/** 怪物被外部战斗行为接管时的互斥状态。 */
export enum MonsterManipulationState {
  Free,
  Carried,
  Thrown,
}

/** 调用方长期复用的局部平面怪物操作候选。 */
export interface MutablePlanarMonsterManipulationCandidate {
  entityId: number;
  x: number;
  y: number;
  elevation: number;
  healthRatio: number;
  bodySize: MonsterBodySize;
  grabResistance: number;
  playerGrabbable: boolean;
  tags: CombatTag;
  throwMass: number;
  maximumThrowDistance: number;
  collisionRadius: number;
  impactStrength: number;
}

/**
 * 跨 Feature 暴露的可操作怪物稳定门面。
 *
 * 坐标使用怪物自身二维运动平面和正交高度轴；调用方负责转换到场景世界空间。
 */
export interface PlanarMonsterManipulationPopulation {
  /** 把一个活动槽位的可抓取与可投掷能力写入复用结果。 */
  writeManipulationCandidate(
    entityIndex: number,
    result: MutablePlanarMonsterManipulationCandidate,
  ): boolean;

  /** 把合法实体从自由状态切换为被携带状态。 */
  beginCarry(entityId: number): boolean;

  /** 把当前被携带实体切换为投掷飞行状态。 */
  beginThrow(entityId: number): boolean;

  /** 在外部行为接管期间同步局部平面位置、正交高度和朝向。 */
  synchronizeManipulatedPose(
    entityId: number,
    x: number,
    y: number,
    elevation: number,
    heading: number,
  ): boolean;

  /** 结束外部接管并把实体恢复到地面自由状态。 */
  releaseManipulation(entityId: number): boolean;

  /** 让仍存活的被操作实体进入其自身死亡生命周期。 */
  killManipulated(entityId: number): boolean;
}
