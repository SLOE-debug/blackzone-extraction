import {
  WeaponAction,
  type WeaponEquipmentDefinition,
} from '../../../../core/equipment/equipment';
import { type WeaponEquipmentId } from '../catalog/equipment-id';
import { type WeaponAmmunition } from '../model/weapon-ammunition';

/**
 * 只管理当前武器的射击间隔、动作进度和延迟装填请求。
 *
 * 装备槽、渲染器和弹体资源不属于此状态机。
 */
export class BattlefieldWeaponActionState {
  private fireCooldown = 0;
  private attackElapsed = Number.POSITIVE_INFINITY;
  private reloadPending = false;

  /** 新装备进入槽位时重置动作时序。 */
  public reset(): void {
    this.fireCooldown = 0;
    this.attackElapsed = Number.POSITIVE_INFINITY;
    this.reloadPending = false;
  }

  /** 推进动作时序，并在攻击动画结束后兑现延迟装填。 */
  public update(
    deltaTime: number,
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>>,
    ammunition: WeaponAmmunition,
  ): void {
    ammunition.update(deltaTime);
    this.attackElapsed += deltaTime;
    this.fireCooldown = Math.max(0, this.fireCooldown - deltaTime);
    if (this.reloadPending && this.attackElapsed >= definition.attackAnimationSeconds) {
      ammunition.beginReload();
      this.reloadPending = false;
    }
  }

  /** 当前武器是否已经满足下一次射击的节奏条件。 */
  public canFire(ammunition: WeaponAmmunition): boolean {
    return this.fireCooldown <= 0 && !ammunition.reloading;
  }

  /** 成功发射后开始射速冷却和攻击动画。 */
  public markFired(
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>>,
    ammunition: WeaponAmmunition,
  ): void {
    this.fireCooldown = definition.fireIntervalSeconds;
    this.attackElapsed = 0;
    this.reloadPending = ammunition.empty;
  }

  /** 弹仓拒绝射击时立即尝试进入装填流程。 */
  public markEmpty(ammunition: WeaponAmmunition): void {
    ammunition.beginReload();
  }

  /** 新增备用弹药时为已经空仓的当前武器排队装填。 */
  public requestReload(): void {
    this.reloadPending = true;
  }

  /** 返回角色动画层消费的中立武器动作。 */
  public getAction(
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>> | null,
    ammunition: WeaponAmmunition | null,
  ): WeaponAction {
    if (ammunition?.reloading === true) {
      return WeaponAction.Reload;
    }
    if (definition !== null && this.attackElapsed < definition.attackAnimationSeconds) {
      return WeaponAction.Fire;
    }
    return WeaponAction.Ready;
  }

  /** 返回当前 Fire 或 Reload 动作的零到一归一化进度。 */
  public getProgress(
    definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>> | null,
    ammunition: WeaponAmmunition | null,
  ): number {
    if (ammunition?.reloading === true) {
      return ammunition.reloadProgress;
    }
    if (definition !== null && this.attackElapsed < definition.attackAnimationSeconds) {
      return Math.min(1, this.attackElapsed / definition.attackAnimationSeconds);
    }
    return 0;
  }
}
