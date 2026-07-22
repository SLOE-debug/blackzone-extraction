import { type WeaponEquipmentDefinition } from '../../../../core/equipment/equipment';
import {
  type BattlefieldAimTarget,
} from '../../population/battlefield-monster-population';
import {
  BattlefieldPenetratingHitBuffer,
  type BattlefieldPenetratingHitQuery,
} from '../../population/battlefield-penetrating-hit';
import { type WeaponEquipmentId } from '../catalog/equipment-id';
import { type WeaponAmmunition } from '../model/weapon-ammunition';
import {
  type MutableBattlefieldProjectileDirection,
  writeBattlefieldProjectileDirection,
} from '../projectile/model/battlefield-projectile-trajectory';
import {
  getWeaponShotProjectileCount,
  writeBattlefieldShotProjectileDirection,
} from '../projectile/model/battlefield-weapon-shot-pattern';
import { type BattlefieldWeaponMuzzlePose } from './battlefield-weapon-muzzle-pose';

/** 射击求解依赖的最小弹体生成门面。 */
export interface BattlefieldWeaponProjectileSink {
  spawn(
    x: number,
    y: number,
    z: number,
    directionX: number,
    directionY: number,
    directionZ: number,
  ): void;
}

/** 射击求解只依赖怪物聚合层的贯穿命中门面。 */
export interface BattlefieldWeaponHitscanTarget {
  damageAlongSegment(
    query: Readonly<BattlefieldPenetratingHitQuery>,
    hits: BattlefieldPenetratingHitBuffer,
  ): number;
}

/** 一次射击求解的判别结果。 */
export enum BattlefieldWeaponAttackResult {
  Fired = 'fired',
  Empty = 'empty',
}

/** 根据枪口、目标和 Shot Pattern 完成一次无分配射击求解。 */
export class BattlefieldWeaponAttackExecutor {
  private readonly hits = new BattlefieldPenetratingHitBuffer(4);
  private readonly hitQuery: BattlefieldPenetratingHitQuery = {
    startX: 0,
    startY: 0,
    startZ: 0,
    endX: 0,
    endY: 0,
    endZ: 0,
    impactRadius: 0,
    damage: 1,
    maximumHitCount: 1,
    damageRetention: 1,
  };
  private readonly shotDirection: MutableBattlefieldProjectileDirection = {
    x: 0,
    y: 0,
    z: 1,
  };
  private readonly projectileDirection: MutableBattlefieldProjectileDirection = {
    x: 0,
    y: 0,
    z: 1,
  };

  /** 消耗弹药并把当前武器的全部弹体写入目标人口。 */
  public execute(
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>>,
    muzzle: Readonly<BattlefieldWeaponMuzzlePose>,
    target: Readonly<BattlefieldAimTarget>,
    ammunition: WeaponAmmunition,
    monsters: BattlefieldWeaponHitscanTarget,
    projectiles: BattlefieldWeaponProjectileSink,
  ): BattlefieldWeaponAttackResult {
    const direction = this.shotDirection;
    writeBattlefieldProjectileDirection(
      muzzle.muzzleX,
      muzzle.muzzleY,
      muzzle.muzzleZ,
      target.x,
      target.y,
      target.z,
      direction,
    );
    if (!ammunition.tryConsumeShot()) {
      return BattlefieldWeaponAttackResult.Empty;
    }
    const projectileCount = getWeaponShotProjectileCount(definition.shotPattern);
    for (let projectileIndex = 0; projectileIndex < projectileCount; projectileIndex++) {
      writeBattlefieldShotProjectileDirection(
        direction.x,
        direction.y,
        direction.z,
        definition.shotPattern,
        projectileIndex,
        this.projectileDirection,
      );
      this.writeHitQuery(definition, muzzle);
      monsters.damageAlongSegment(this.hitQuery, this.hits);
      projectiles.spawn(
        muzzle.muzzleX,
        muzzle.muzzleY,
        muzzle.muzzleZ,
        this.projectileDirection.x,
        this.projectileDirection.y,
        this.projectileDirection.z,
      );
    }
    return BattlefieldWeaponAttackResult.Fired;
  }

  /** 复用同一查询对象，把枪口与当前弹丸方向转换为完整射程线段。 */
  private writeHitQuery(
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>>,
    muzzle: Readonly<BattlefieldWeaponMuzzlePose>,
  ): void {
    const projectile = definition.projectile;
    const query = this.hitQuery as {
      startX: number; startY: number; startZ: number;
      endX: number; endY: number; endZ: number;
      impactRadius: number; damage: number;
      maximumHitCount: number; damageRetention: number;
    };
    query.startX = muzzle.muzzleX;
    query.startY = muzzle.muzzleY;
    query.startZ = muzzle.muzzleZ;
    query.endX = muzzle.muzzleX + this.projectileDirection.x * projectile.maximumRange;
    query.endY = muzzle.muzzleY + this.projectileDirection.y * projectile.maximumRange;
    query.endZ = muzzle.muzzleZ + this.projectileDirection.z * projectile.maximumRange;
    query.impactRadius = projectile.impactRadius;
    query.damage = definition.damage;
    query.maximumHitCount = projectile.maximumHitCount;
    query.damageRetention = projectile.damageRetention;
  }
}
