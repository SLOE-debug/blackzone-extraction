import { type Material, type Node } from 'cc';
import {
  EquipmentCategory,
  type EquipmentId,
  type EquipmentLibrary,
  type WeaponEquipmentDefinition,
} from '../../../../core/equipment/equipment';
import {
  type BattlefieldAimTarget,
  type BattlefieldMonsterPopulation,
} from '../../population/battlefield-monster-population';
import { HELD_WEAPON_LAYOUT } from '../model/held-weapon-layout';
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

/** 武器运行时读取的玩家主手挂点与世界朝向。 */
export interface BattlefieldWeaponOwnerPose {
  /** 右手掌心挂点世界 X。 */
  readonly x: number;
  /** 右手掌心挂点世界 Y。 */
  readonly y: number;
  /** 右手掌心挂点世界 Z。 */
  readonly z: number;
  readonly heading: number;
  readonly alive: boolean;
}

/** 管理玩家唯一武器槽、弹药策略、手持渲染和自动射击。 */
export class BattlefieldPlayerWeaponRuntime {
  private readonly heldMaterial: Material;
  private definition: Readonly<WeaponEquipmentDefinition> | null = null;
  private ammunition: WeaponAmmunition | null = null;
  private heldRenderer: HeldWeaponRenderer | null = null;
  private projectiles: BattlefieldProjectilePopulation | null = null;
  private readonly shotDirection: MutableBattlefieldProjectileDirection = {
    x: 0,
    y: 0,
    z: 1,
  };
  private fireCooldown = 0;
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

  /** 装备一件武器，并在成功创建新资源后替换旧武器与在途子弹。 */
  public equip(equipmentId: EquipmentId): void {
    this.ensureActive();
    const definition = this.equipmentLibrary.get(equipmentId);
    if (definition.category !== EquipmentCategory.Weapon) {
      throw new Error(`玩家武器槽不能装备非武器物品：${equipmentId}。`);
    }
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
    this.projectiles?.dispose();
    this.heldRenderer?.dispose();
    this.definition = definition;
    this.ammunition = ammunition;
    this.heldRenderer = heldRenderer;
    this.projectiles = projectiles;
    this.fireCooldown = 0;
  }

  /** 同步手持姿态、推进在途子弹，并从枪口向锁定目标的三维坐标自动射击。 */
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
    this.heldRenderer?.setSocketPose(owner.x, owner.y, owner.z, owner.heading);
    const definition = this.definition;
    const ammunition = this.ammunition;
    const projectiles = this.projectiles;
    if (definition === null || ammunition === null || projectiles === null) {
      return;
    }
    this.fireCooldown = Math.max(0, this.fireCooldown - Math.max(0, deltaTime));
    if (owner.alive && fireTarget !== null && this.fireCooldown <= 0) {
      const headingX = Math.sin(owner.heading);
      const headingZ = Math.cos(owner.heading);
      const muzzleX = owner.x + headingX * HELD_WEAPON_LAYOUT.muzzleForwardFromSocket;
      const muzzleY = owner.y + HELD_WEAPON_LAYOUT.muzzleHeightFromSocket;
      const muzzleZ = owner.z + headingZ * HELD_WEAPON_LAYOUT.muzzleForwardFromSocket;
      const direction = this.shotDirection;
      writeBattlefieldProjectileDirection(
        muzzleX,
        muzzleY,
        muzzleZ,
        fireTarget.x,
        fireTarget.y,
        fireTarget.z,
        direction,
      );
      if (ammunition.tryConsumeShot()) {
        projectiles.spawn(
          muzzleX,
          muzzleY,
          muzzleZ,
          direction.x,
          direction.y,
          direction.z,
        );
        this.fireCooldown = definition.fireIntervalSeconds;
      }
    }
    projectiles.update(deltaTime, monsters);
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
    this.ammunition = null;
    this.projectiles = null;
    this.heldRenderer = null;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('玩家武器运行时已经释放。');
    }
  }
}

function validateOwnerPose(owner: Readonly<BattlefieldWeaponOwnerPose>): void {
  if (!Number.isFinite(owner.x)
    || !Number.isFinite(owner.y)
    || !Number.isFinite(owner.z)
    || !Number.isFinite(owner.heading)) {
    throw new Error('玩家武器持有者姿态必须使用有限数值。');
  }
}
