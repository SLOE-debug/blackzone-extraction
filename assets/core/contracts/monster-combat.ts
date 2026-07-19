import { type Disposable } from './disposable';

/** 怪物战斗系统在自身二维运动平面中追踪的单一目标。 */
export interface PlanarMonsterCombatTarget {
  /** 目标中心的平面 X 坐标。 */
  readonly x: number;
  /** 目标中心的平面 Y 坐标。 */
  readonly y: number;
  /** 目标用于贴身距离计算的碰撞半径。 */
  readonly collisionRadius: number;
}

/** 场景驱动怪物感知并接收聚合攻击结果时使用的稳定门面。 */
export interface MonsterCombatPopulation extends Disposable {
  /** 将当前存活目标同步到怪物自身的运动平面。 */
  synchronizeCombatTarget(target: Readonly<PlanarMonsterCombatTarget>): void;

  /** 目标失效或死亡时清除感知目标，并取消尚未命中的攻击。 */
  clearCombatTarget(): void;

  /**
   * 取走自上次消费以来全部有效啃咬造成的伤害。
   *
   * @returns 本帧需要由目标承受的聚合伤害，读取后内部数值归零。
   */
  consumeAttackDamage(): number;
}
