import { type Material, type Node } from 'cc';
import {
  EquipmentCategory,
  WeaponAction,
  type WeaponGrip,
  type WeaponEquipmentDefinition,
} from '../../../../core/equipment/equipment';
import {
  type BattlefieldEquipmentLibrary,
} from '../catalog/battlefield-equipment-contracts';
import { getBattlefieldWeaponPrototype } from '../catalog/battlefield-equipment-catalog';
import { type HeldWeaponProfile } from '../catalog/battlefield-equipment-prototype';
import {
  EquipmentId,
  type WeaponEquipmentId,
} from '../catalog/equipment-id';
import {
  type BattlefieldAimTarget,
  type BattlefieldMonsterPopulation,
} from '../../population/battlefield-monster-population';
import { BattlefieldWeaponActionState } from '../combat/battlefield-weapon-action-state';
import {
  BattlefieldWeaponAttackExecutor,
  BattlefieldWeaponAttackResult,
} from '../combat/battlefield-weapon-attack-executor';
import {
  type BattlefieldWeaponRootPose,
  type MutableBattlefieldWeaponMuzzlePose,
  writeBattlefieldWeaponMuzzlePose,
} from '../combat/battlefield-weapon-muzzle-pose';
import { type WeaponAmmunition } from '../model/weapon-ammunition';
import { WeaponAmmunitionInventory } from '../model/weapon-ammunition-inventory';
import {
  AMMUNITION_CALIBER_LABEL,
  type MutableWeaponAmmunitionStatus,
  type WeaponAmmunitionStatus,
} from '../model/weapon-ammunition-status';
import { BattlefieldProjectilePopulation } from '../projectile/population/battlefield-projectile-population';
import { createHeldWeaponMaterial } from '../rendering/held-weapon-material';
import { HeldWeaponRenderer } from '../rendering/held-weapon-renderer';

/** 武器运行时读取的 WeaponAimRoot 权威姿态与存活状态。 */
export interface BattlefieldWeaponOwnerPose extends BattlefieldWeaponRootPose {
  readonly alive: boolean;
}

/** 编排玩家唯一武器槽及其弹药、手持渲染、弹体和动作子系统生命周期。 */
export class BattlefieldPlayerWeaponRuntime {
  private readonly heldMaterial: Material;
  private readonly ammunitionInventory = new WeaponAmmunitionInventory();
  private readonly actionState = new BattlefieldWeaponActionState();
  private readonly attackExecutor = new BattlefieldWeaponAttackExecutor();
  private readonly muzzlePose: MutableBattlefieldWeaponMuzzlePose = {
    muzzleX: 0,
    muzzleY: 0,
    muzzleZ: 0,
  };
  private readonly mutableAmmunitionStatus: MutableWeaponAmmunitionStatus = {
    equipmentId: EquipmentId.DesertEagle,
    weaponName: '',
    caliber: '',
    roundsRemaining: 0,
    magazineCapacity: 0,
    reserveRounds: 0,
    reloading: false,
    reloadProgress: 0,
  };
  private definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>> | null = null;
  private grip: WeaponGrip | null = null;
  private heldProfile: Readonly<HeldWeaponProfile> | null = null;
  private ammunition: WeaponAmmunition | null = null;
  private heldRenderer: HeldWeaponRenderer | null = null;
  private projectiles: BattlefieldProjectilePopulation | null = null;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
  ) {
    this.heldMaterial = createHeldWeaponMaterial();
  }

  /** 当前唯一武器槽中的装备标识。 */
  public get equippedEquipmentId(): WeaponEquipmentId | null {
    return this.definition?.id ?? null;
  }

  /** 当前武器提供给任意角色动画层的中立握持方式。 */
  public get weaponGrip(): WeaponGrip | null {
    return this.grip;
  }

  /** 当前装备交给任意角色动画层采样的中立武器动作。 */
  public get weaponAction(): WeaponAction {
    return this.actionState.getAction(this.definition, this.ammunition);
  }

  /** 当前武器动作的零到一归一化进度。 */
  public get weaponActionProgress(): number {
    return this.actionState.getProgress(this.definition, this.ammunition);
  }

  /** 返回原地刷新的只读 HUD 快照；未装备武器时返回空值。 */
  public get ammunitionStatus(): Readonly<WeaponAmmunitionStatus> | null {
    const definition = this.definition;
    const ammunition = this.ammunition;
    if (definition === null || ammunition === null) {
      return null;
    }
    const status = this.mutableAmmunitionStatus;
    status.equipmentId = definition.id;
    status.weaponName = definition.displayName;
    status.caliber = AMMUNITION_CALIBER_LABEL[ammunition.ammunitionType];
    status.roundsRemaining = ammunition.roundsRemaining;
    status.magazineCapacity = ammunition.capacity;
    status.reserveRounds = ammunition.reserveRounds;
    status.reloading = ammunition.reloading;
    status.reloadProgress = ammunition.reloadProgress;
    return status;
  }

  /**
   * 装备一件武器，并在成功创建新资源后替换旧武器与在途弹体。
   *
   * @returns 被替换的旧装备标识；原槽为空时返回空值。
   */
  public equip(equipmentId: WeaponEquipmentId): WeaponEquipmentId | null {
    this.ensureActive();
    const definition = this.equipmentLibrary.get(equipmentId);
    const heldProfile = getBattlefieldWeaponPrototype(equipmentId).held;
    const grip = heldProfile.grip;
    const ammunition = this.ammunitionInventory.createFreshMagazine(definition);
    let heldRenderer: HeldWeaponRenderer | null = null;
    let projectiles: BattlefieldProjectilePopulation | null = null;
    try {
      heldRenderer = new HeldWeaponRenderer(this.parent, equipmentId, this.heldMaterial);
      projectiles = new BattlefieldProjectilePopulation(this.parent, definition);
      this.ammunitionInventory.provisionFirstAcquisition(definition);
    } catch (error: unknown) {
      projectiles?.dispose();
      heldRenderer?.dispose();
      throw error;
    }
    const replacedEquipmentId = this.definition?.id ?? null;
    this.projectiles?.dispose();
    this.heldRenderer?.dispose();
    this.definition = definition;
    this.grip = grip;
    this.heldProfile = heldProfile;
    this.ammunition = ammunition;
    this.heldRenderer = heldRenderer;
    this.projectiles = projectiles;
    this.actionState.reset();
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
        this.ammunitionInventory.receive(definition);
        if (this.ammunition?.ammunitionType === definition.ammunitionType
          && this.ammunition.empty) {
          this.actionState.requestReload();
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
    const ammunition = this.ammunition;
    if (definition === null || ammunition === null) {
      return;
    }

    this.actionState.update(safeDeltaTime, definition, ammunition);
    if (owner.alive
      && fireTarget !== null
      && this.actionState.canFire(ammunition)
      && this.projectiles !== null) {
      const heldProfile = this.heldProfile;
      if (heldProfile === null) {
        throw new Error('装备武器缺少枪口展示配置。');
      }
      writeBattlefieldWeaponMuzzlePose(owner, heldProfile, this.muzzlePose);
      const attackResult = this.attackExecutor.execute(
        definition,
        this.muzzlePose,
        fireTarget,
        ammunition,
        monsters,
        this.projectiles,
      );
      if (attackResult === BattlefieldWeaponAttackResult.Fired) {
        this.actionState.markFired(definition, ammunition);
      } else {
        this.actionState.markEmpty(ammunition);
      }
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
    this.projectiles?.update(safeDeltaTime);
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
    this.grip = null;
    this.heldProfile = null;
    this.ammunition = null;
    this.projectiles = null;
    this.heldRenderer = null;
    this.actionState.reset();
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
    || Math.abs(Math.hypot(
      owner.rotationX,
      owner.rotationY,
      owner.rotationZ,
      owner.rotationW,
    ) - 1) > 0.002) {
    throw new Error('玩家武器持有者姿态必须使用有限数值。');
  }
}
