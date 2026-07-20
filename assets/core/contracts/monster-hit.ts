import { type Disposable } from './disposable';

/** 怪物自身二维运动平面及其正交高度轴中的有限线段命中查询。 */
export interface PlanarMonsterHitQuery {
  readonly startX: number;
  readonly startY: number;
  readonly startElevation: number;
  readonly endX: number;
  readonly endY: number;
  readonly endElevation: number;
  readonly impactRadius: number;
}

/** 调用方复用的首个命中结果。 */
export interface MutablePlanarMonsterHitResult {
  entityId: number;
  x: number;
  y: number;
  elevation: number;
  segmentProgress: number;
}

/** 能够接受带正交高度的线段命中查询与实体伤害的怪物群稳定门面。 */
export interface PlanarMonsterHitPopulation extends Disposable {
  /** 查找线段从起点到终点最先接触的存活怪物。 */
  findFirstPlanarHit(
    query: Readonly<PlanarMonsterHitQuery>,
    result: MutablePlanarMonsterHitResult,
  ): boolean;

  /** 对稳定实体标识施加有限正数伤害。 */
  damage(entityId: number, amount: number): void;
}
