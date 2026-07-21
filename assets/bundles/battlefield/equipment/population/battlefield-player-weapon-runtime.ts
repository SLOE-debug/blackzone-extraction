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
import {
  type EquipmentId,
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
  createWeaponAmmunition,
  type WeaponAmmunition,
} from '../model/weapon-ammunition';
import { WeaponAmmunitionReserve } from '../model/weapon-ammunition-reserve';
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

/** 编排玩家唯一武器槽及其弹药、手持渲染、弹体和动作子系统生命周期。 */
export class BattlefieldPlayerWeaponRuntime {
  private readonly heldMaterial: Material;
  private readonly ammunitionReserve = new WeaponAmmunitionReserve();
  private readonly ammunitionStates = new Map<WeaponEquipmentId, WeaponAmmunition>();
  private readonly actionState = new BattlefieldWeaponActionState();
  private readonly attackExecutor = new BattlefieldWeaponAttackExecutor();
  private definition: Readonly<WeaponEquipmentDefinition<WeaponEquipmentId>> | null = null;
  private grip: WeaponGrip | null = null;
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

  /**
   * 装备一件武器，并在成功创建新资源后替换旧武器与在途弹体。
   *
   * @returns 被替换的旧装备标识；原槽为空时返回空值。
   */
  public equip(equipmentId: WeaponEquipmentId): WeaponEquipmentId | null {
    this.ensureActive();
    const definition = this.equipmentLibrary.get(equipmentId);
    const grip = getBattlefieldWeaponPrototype(equipmentId).held.grip;
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
    this.grip = grip;
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
        this.ammunitionReserve.add(definition.ammunitionType, definition.rounds);
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
      const attackResult = this.attackExecutor.execute(
        definition,
        owner,
        fireTarget,
        ammunition,
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
    this.grip = null;
    this.ammunition = null;
    this.ammunitionStates.clear();
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
