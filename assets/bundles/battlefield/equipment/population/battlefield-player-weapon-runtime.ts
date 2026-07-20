import { type Material, type Node } from 'cc';
import {
  EquipmentCategory,
  type EquipmentId,
  type EquipmentLibrary,
  type WeaponEquipmentDefinition,
} from '../../../../core/equipment/equipment';
import {
  VanguardWeaponHand,
  VanguardWeaponPose,
} from '../../../../player/vanguard';
import {
  type BattlefieldAimTarget,
  type BattlefieldMonsterPopulation,
} from '../../population/battlefield-monster-population';
import {
  getHeldWeaponProfile,
  type HeldWeaponProfile,
} from '../model/held-weapon-profile';
import {
  createWeaponAmmunition,
  type WeaponAmmunition,
} from '../model/weapon-ammunition';
import {
  type MutableBattlefieldProjectileDirection,
  writeBattlefieldProjectileDirection,
} from '../projectile/model/battlefield-projectile-trajectory';
import { BattlefieldProjectilePopulation } from '../projectile/population/battlefield-projectile-population';
import { createHeldWeaponMaterial } from '../rendering/held-weapon-material';
import { HeldWeaponRenderer } from '../rendering/held-weapon-renderer';

/** 武器运行时读取的双手挂点、世界朝向与存活状态。 */
export interface BattlefieldWeaponOwnerPose {
  readonly leftX: number;
  readonly leftY: number;
  readonly leftZ: number;
  readonly rightX: number;
  readonly rightY: number;
  readonly rightZ: number;
  readonly heading: number;
  readonly alive: boolean;
}

/** 管理玩家唯一武器槽、攻击策略、类型化手持渲染和攻击姿态脉冲。 */
export class BattlefieldPlayerWeaponRuntime {
  private readonly heldMaterial: Material;
  private definition: Readonly<WeaponEquipmentDefinition> | null = null;
  private profile: Readonly<HeldWeaponProfile> | null = null;
  private ammunition: WeaponAmmunition | null = null;
  private heldRenderer: HeldWeaponRenderer | null = null;
  private projectiles: BattlefieldProjectilePopulation | null = null;
  private readonly shotDirection: MutableBattlefieldProjectileDirection = {
    x: 0,
    y: 0,
    z: 1,
  };
  private fireCooldown = 0;
  private attackAnimationAmount = 0;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    surfaceMaterialTemplate: Material,
    private readonly equipmentLibrary: EquipmentLibrary,
  ) {
    this.heldMaterial = createHeldWeaponMaterial(surfaceMaterialTemplate);
  }

  /** 当前唯一武器槽中的装备标识。 */
  public get equippedEquipmentId(): EquipmentId | null {
    return this.definition?.id ?? null;
  }

  /** 当前武器提供给主角动画的类型化姿态。 */
  public get vanguardWeaponPose(): VanguardWeaponPose {
    return this.profile?.pose ?? VanguardWeaponPose.Unarmed;
  }

  /** 最近一次真实攻击留下的平滑姿态脉冲。 */
  public get vanguardAttackAnimationAmount(): number {
    return this.attackAnimationAmount;
  }

  /**
   * 装备一件武器，并在成功创建新资源后替换旧武器与在途弹体。
   *
   * @returns 被替换的旧装备标识；原槽为空时返回空值。
   */
  public equip(equipmentId: EquipmentId): EquipmentId | null {
    this.ensureActive();
    const definition = this.equipmentLibrary.get(equipmentId);
    if (definition.category !== EquipmentCategory.Weapon) {
      throw new Error(`玩家武器槽不能装备非武器物品：${equipmentId}。`);
    }
    const profile = getHeldWeaponProfile(equipmentId);
    const ammunition = createWeaponAmmunition(definition.ammunition);
    let heldRenderer: HeldWeaponRenderer | null = null;
    let projectiles: BattlefieldProjectilePopulation | null = null;
    try {
      heldRenderer = new HeldWeaponRenderer(this.parent, equipmentId, this.heldMaterial);
      projectiles = new BattlefieldProjectilePopulation(this.parent, definition);
    } catch (error: unknown) {
      projectiles?.dispose();
      heldRenderer?.dispose();
      throw error;
    }
    const replacedEquipmentId = this.definition?.id ?? null;
    this.projectiles?.dispose();
    this.heldRenderer?.dispose();
    this.definition = definition;
    this.profile = profile;
    this.ammunition = ammunition;
    this.heldRenderer = heldRenderer;
    this.projectiles = projectiles;
    this.fireCooldown = 0;
    this.attackAnimationAmount = 0;
    return replacedEquipmentId;
  }

  /** 同步手持姿态、推进在途弹体，并对锁定目标触发射击。 */
  public update(
    deltaTime: number,
    owner: Readonly<BattlefieldWeaponOwnerPose>,
    fireTarget: Readonly<BattlefieldAimTarget> | null,
    monsters: BattlefieldMonsterPopulation,
  ): void {
    this.ensureActive();
    validateOwnerPose(owner);
    if (!Number.isFinite(deltaTime)) {
      throw new Error('玩家武器帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(0, deltaTime);
    const definition = this.definition;
    const profile = this.profile;
    const ammunition = this.ammunition;
    const socketX = profile?.hand === VanguardWeaponHand.Left
      ? owner.leftX
      : owner.rightX;
    const socketY = profile?.hand === VanguardWeaponHand.Left
      ? owner.leftY
      : owner.rightY;
    const socketZ = profile?.hand === VanguardWeaponHand.Left
      ? owner.leftZ
      : owner.rightZ;
    this.heldRenderer?.setSocketPose(socketX, socketY, socketZ, owner.heading);
    if (definition === null || profile === null || ammunition === null) {
      return;
    }

    this.attackAnimationAmount = Math.max(
      0,
      this.attackAnimationAmount - safeDeltaTime / definition.attackAnimationSeconds,
    );
    this.fireCooldown = Math.max(0, this.fireCooldown - safeDeltaTime);
    if (owner.alive && fireTarget !== null && this.fireCooldown <= 0) {
      this.attack(
        definition,
        profile,
        socketX,
        socketY,
        socketZ,
        owner.heading,
        fireTarget,
        ammunition,
      );
    }
    this.projectiles?.update(safeDeltaTime, monsters);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.projectiles?.dispose();
    this.heldRenderer?.dispose();
    this.heldMaterial.destroy();
    this.definition = null;
    this.profile = null;
    this.ammunition = null;
    this.projectiles = null;
    this.heldRenderer = null;
  }

  /** 根据手持配置计算真实枪口位置，并向目标发射一枚弹体。 */
  private attack(
    definition: Readonly<WeaponEquipmentDefinition>,
    profile: Readonly<HeldWeaponProfile>,
    socketX: number,
    socketY: number,
    socketZ: number,
    heading: number,
    target: Readonly<BattlefieldAimTarget>,
    ammunition: WeaponAmmunition,
  ): void {
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    const attackX = socketX
      + rightX * profile.attackRightFromSocket
      + forwardX * profile.attackForwardFromSocket;
    const attackY = socketY + profile.attackHeightFromSocket;
    const attackZ = socketZ
      + rightZ * profile.attackRightFromSocket
      + forwardZ * profile.attackForwardFromSocket;
    const direction = this.shotDirection;
    writeBattlefieldProjectileDirection(
      attackX,
      attackY,
      attackZ,
      target.x,
      target.y,
      target.z,
      direction,
    );
    if (!ammunition.tryConsumeShot()) {
      return;
    }
    this.projectiles?.spawn(
      attackX,
      attackY,
      attackZ,
      direction.x,
      direction.y,
      direction.z,
    );
    this.fireCooldown = definition.fireIntervalSeconds;
    this.attackAnimationAmount = 1;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('玩家武器运行时已经释放。');
    }
  }
}

function validateOwnerPose(owner: Readonly<BattlefieldWeaponOwnerPose>): void {
  if (!Number.isFinite(owner.leftX)
    || !Number.isFinite(owner.leftY)
    || !Number.isFinite(owner.leftZ)
    || !Number.isFinite(owner.rightX)
    || !Number.isFinite(owner.rightY)
    || !Number.isFinite(owner.rightZ)
    || !Number.isFinite(owner.heading)) {
    throw new Error('玩家武器持有者姿态必须使用有限数值。');
  }
}
