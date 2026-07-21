import { type Material, type Node } from 'cc';
import {
  EquipmentCategory,
  type EquipmentId,
  type EquipmentLibrary,
  type WeaponEquipmentDefinition,
  type WeaponEquipmentId,
} from '../../../../core/equipment/equipment';
import {
  VanguardWeaponAction,
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
import { WeaponAmmunitionReserve } from '../model/weapon-ammunition-reserve';
import {
  type MutableBattlefieldProjectileDirection,
  writeBattlefieldProjectileDirection,
} from '../projectile/model/battlefield-projectile-trajectory';
import {
  getWeaponShotProjectileCount,
  writeBattlefieldShotProjectileDirection,
} from '../projectile/model/battlefield-weapon-shot-pattern';
import { BattlefieldProjectilePopulation } from '../projectile/population/battlefield-projectile-population';
import { createHeldWeaponMaterial } from '../rendering/held-weapon-material';
import { HeldWeaponRenderer } from '../rendering/held-weapon-renderer';

/** 武器运行时读取的 WeaponAimRoot 权威姿态与存活状态。 */
export interface BattlefieldWeaponOwnerPose {
  readonly rootX: number;
  readonly rootY: number;
  readonly rootZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly rotationW: number;
  readonly muzzleX: number;
  readonly muzzleY: number;
  readonly muzzleZ: number;
  readonly forwardX: number;
  readonly forwardY: number;
  readonly forwardZ: number;
  readonly alive: boolean;
}

/** 管理玩家唯一武器槽、攻击策略、类型化手持渲染和攻击姿态脉冲。 */
export class BattlefieldPlayerWeaponRuntime {
  private readonly heldMaterial: Material;
  private readonly ammunitionReserve = new WeaponAmmunitionReserve();
  private readonly ammunitionStates = new Map<WeaponEquipmentId, WeaponAmmunition>();
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
  private readonly projectileDirection: MutableBattlefieldProjectileDirection = {
    x: 0,
    y: 0,
    z: 1,
  };
  private fireCooldown = 0;
  private attackAnimationElapsed = Number.POSITIVE_INFINITY;
  private reloadPending = false;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly equipmentLibrary: EquipmentLibrary,
  ) {
    this.heldMaterial = createHeldWeaponMaterial();
  }

  /** 当前唯一武器槽中的装备标识。 */
  public get equippedEquipmentId(): WeaponEquipmentId | null {
    return this.definition?.id ?? null;
  }

  /** 当前武器提供给主角动画的类型化姿态。 */
  public get vanguardWeaponPose(): VanguardWeaponPose {
    return this.profile?.pose ?? VanguardWeaponPose.Unarmed;
  }

  /** 当前装备交给主角动画层采样的武器动作。 */
  public get vanguardWeaponAction(): VanguardWeaponAction {
    if (this.ammunition?.reloading === true) {
      return VanguardWeaponAction.Reload;
    }
    if (this.definition !== null
      && this.attackAnimationElapsed < this.definition.attackAnimationSeconds) {
      return VanguardWeaponAction.Fire;
    }
    return VanguardWeaponAction.Ready;
  }

  /** 当前武器动作的零到一归一化进度。 */
  public get vanguardWeaponActionProgress(): number {
    if (this.ammunition?.reloading === true) {
      return this.ammunition.reloadProgress;
    }
    const definition = this.definition;
    if (definition !== null
      && this.attackAnimationElapsed < definition.attackAnimationSeconds) {
      return Math.min(1, this.attackAnimationElapsed / definition.attackAnimationSeconds);
    }
    return 0;
  }

  /**
   * 装备一件武器，并在成功创建新资源后替换旧武器与在途弹体。
   *
   * @returns 被替换的旧装备标识；原槽为空时返回空值。
   */
  public equip(equipmentId: WeaponEquipmentId): WeaponEquipmentId | null {
    this.ensureActive();
    const definition = this.equipmentLibrary.get(equipmentId);
    const profile = getHeldWeaponProfile(equipmentId);
    const existingAmmunition = this.ammunitionStates.get(equipmentId);
    const ammunition = existingAmmunition ?? createWeaponAmmunition(
      definition.ammunition,
      this.ammunitionReserve,
    );
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
    if (existingAmmunition === undefined) {
      this.ammunitionStates.set(equipmentId, ammunition);
    }
    this.definition = definition;
    this.profile = profile;
    this.ammunition = ammunition;
    this.heldRenderer = heldRenderer;
    this.projectiles = projectiles;
    this.fireCooldown = 0;
    this.attackAnimationElapsed = Number.POSITIVE_INFINITY;
    this.reloadPending = false;
    return replacedEquipmentId;
  }

  /** 接收一件世界装备；武器进入槽位，弹药则直接加入对应备用库存。 */
  public receive(equipmentId: EquipmentId): WeaponEquipmentId | null {
    this.ensureActive();
    const definition = this.equipmentLibrary.get(equipmentId);
    switch (definition.category) {
      case EquipmentCategory.Weapon:
        return this.equip(definition.id);
      case EquipmentCategory.Ammunition:
        this.ammunitionReserve.add(definition.ammunitionType, definition.rounds);
        if (this.ammunition?.ammunitionType === definition.ammunitionType
          && this.ammunition.empty) {
          this.reloadPending = true;
        }
        return null;
    }
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
    if (definition === null || profile === null || ammunition === null) {
      return;
    }

    ammunition.update(safeDeltaTime);
    this.attackAnimationElapsed += safeDeltaTime;
    this.fireCooldown = Math.max(0, this.fireCooldown - safeDeltaTime);
    if (this.reloadPending
      && this.attackAnimationElapsed >= definition.attackAnimationSeconds) {
      ammunition.beginReload();
      this.reloadPending = false;
    }
    if (owner.alive
      && fireTarget !== null
      && this.fireCooldown <= 0
      && !ammunition.reloading) {
      this.attack(
        definition,
        owner,
        fireTarget,
        ammunition,
      );
    }
    this.heldRenderer?.setRigPose(
      owner.rootX,
      owner.rootY,
      owner.rootZ,
      owner.rotationX,
      owner.rotationY,
      owner.rotationZ,
      owner.rotationW,
    );
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
    this.ammunitionStates.clear();
    this.projectiles = null;
    this.heldRenderer = null;
    this.reloadPending = false;
  }

  /** 根据手持配置计算真实枪口位置，并按武器分布完成一次射击。 */
  private attack(
    definition: Readonly<WeaponEquipmentDefinition>,
    owner: Readonly<BattlefieldWeaponOwnerPose>,
    target: Readonly<BattlefieldAimTarget>,
    ammunition: WeaponAmmunition,
  ): void {
    const attackX = owner.muzzleX;
    const attackY = owner.muzzleY;
    const attackZ = owner.muzzleZ;
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
    const projectileCount = getWeaponShotProjectileCount(definition.shotPattern);
    if (!ammunition.tryConsumeShot()) {
      ammunition.beginReload();
      return;
    }
    for (let projectileIndex = 0; projectileIndex < projectileCount; projectileIndex++) {
      writeBattlefieldShotProjectileDirection(
        direction.x,
        direction.y,
        direction.z,
        definition.shotPattern,
        projectileIndex,
        this.projectileDirection,
      );
      this.projectiles?.spawn(
        attackX,
        attackY,
        attackZ,
        this.projectileDirection.x,
        this.projectileDirection.y,
        this.projectileDirection.z,
      );
    }
    this.fireCooldown = definition.fireIntervalSeconds;
    this.attackAnimationElapsed = 0;
    this.reloadPending = ammunition.empty;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('玩家武器运行时已经释放。');
    }
  }
}

function validateOwnerPose(owner: Readonly<BattlefieldWeaponOwnerPose>): void {
  if (!Number.isFinite(owner.rootX)
    || !Number.isFinite(owner.rootY)
    || !Number.isFinite(owner.rootZ)
    || !Number.isFinite(owner.rotationX)
    || !Number.isFinite(owner.rotationY)
    || !Number.isFinite(owner.rotationZ)
    || !Number.isFinite(owner.rotationW)
    || !Number.isFinite(owner.muzzleX)
    || !Number.isFinite(owner.muzzleY)
    || !Number.isFinite(owner.muzzleZ)
    || !Number.isFinite(owner.forwardX)
    || !Number.isFinite(owner.forwardY)
    || !Number.isFinite(owner.forwardZ)
    || Math.abs(Math.hypot(
      owner.rotationX,
      owner.rotationY,
      owner.rotationZ,
      owner.rotationW,
    ) - 1) > 0.002
    || Math.abs(Math.hypot(owner.forwardX, owner.forwardY, owner.forwardZ) - 1) > 0.002) {
    throw new Error('玩家武器持有者姿态必须使用有限数值。');
  }
}
