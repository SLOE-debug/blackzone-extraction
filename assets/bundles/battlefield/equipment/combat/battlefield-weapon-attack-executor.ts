import { type WeaponEquipmentDefinition } from '../../../../core/equipment/equipment';
import { type BattlefieldFireIntent } from '../../combat/battlefield-fire-intent';
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

const DIRECTION_EPSILON = 0.0001;

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

/** 一次射击求解的判别结果。 */
export enum BattlefieldWeaponAttackResult {
  Fired = 'fired',
  Empty = 'empty',
}

/** 根据枪口、目标和 Shot Pattern 完成一次无分配射击求解。 */
export class BattlefieldWeaponAttackExecutor {
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
    intent: Readonly<BattlefieldFireIntent>,
    ammunition: WeaponAmmunition,
    projectiles: BattlefieldWeaponProjectileSink,
  ): BattlefieldWeaponAttackResult {
    const direction = this.shotDirection;
    const elevationTarget = intent.elevationTarget;
    const targetDistance = Math.max(
      (elevationTarget.x - muzzle.muzzleX) * intent.directionX
        + (elevationTarget.z - muzzle.muzzleZ) * intent.directionZ,
      DIRECTION_EPSILON,
    );
    writeBattlefieldProjectileDirection(
      muzzle.muzzleX,
      muzzle.muzzleY,
      muzzle.muzzleZ,
      muzzle.muzzleX + intent.directionX * targetDistance,
      elevationTarget.y,
      muzzle.muzzleZ + intent.directionZ * targetDistance,
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

}
