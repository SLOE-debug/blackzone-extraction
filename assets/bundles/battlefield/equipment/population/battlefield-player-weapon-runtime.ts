import { type Material, type Node } from 'cc';
import {
  WeaponAction,
  WeaponKind,
  type MeleeWeaponDefinition,
  type ProjectileWeaponDefinition,
  type WeaponGrip,
} from '../../../../core/equipment/equipment';
import { type BattlefieldEquipmentLibrary } from '../catalog/battlefield-equipment-contracts';
import { type EquipmentHudProfile } from '../catalog/equipment-hud-profile';
import { getBattlefieldEquipmentPrototype } from '../catalog/battlefield-equipment-catalog';
import { EquipmentId, type WeaponEquipmentId } from '../catalog/equipment-id';
import { type BattlefieldHammerCombatTarget } from '../combat/battlefield-hammer-combat-target';
import {
  BattlefieldHammerCombatRuntime,
  type BattlefieldHammerOwnerState,
} from '../combat/battlefield-hammer-combat-runtime';
import { type BattlefieldHammerActionControlEffect } from '../combat/battlefield-facing-lock-effect';
import { type BattlefieldHammerSweepDebugSource } from '../combat/battlefield-hammer-sweep-debug-state';
import { BattlefieldHammerActionState } from '../combat/battlefield-hammer-action-state';
import { type MutableHammerActionEvents } from '../combat/battlefield-hammer-action-events';
import { BattlefieldWeaponCommandBuffer, type MutableBattlefieldWeaponCommand } from '../combat/battlefield-weapon-command-buffer';
import { type BattlefieldItemInstance } from '../model/battlefield-item-instance';
import { type EquippedWeaponPresentation } from '../model/equipped-weapon-presentation';
import { SledgehammerSpinKnockbackTuning } from '../items/sledgehammer/sledgehammer-spin-knockback-tuning';
import { createHeldEquipmentMaterial } from '../rendering/held-equipment-material';
import { HeldEquipmentRenderer } from '../rendering/held-equipment-renderer';
import { type BattlefieldArrowCombatTarget } from '../projectile/model/battlefield-arrow-query';
import { BattlefieldBowAction } from '../projectile/model/battlefield-bow-action-state';
import { BattlefieldBowActionControl } from '../projectile/model/battlefield-bow-action-control';
import {
  BattlefieldReturningBowRuntime,
} from '../projectile/population/battlefield-returning-bow-runtime';
import { BattlefieldArrowRenderer } from '../projectile/rendering/battlefield-arrow-renderer';
import { createBattlefieldArrowMaterial } from '../projectile/rendering/battlefield-arrow-material';

/** 大锤运行时读取的玩家世界姿态。 */
export type BattlefieldWeaponOwnerState = BattlefieldHammerOwnerState;

/** 手持渲染读取的角色权威武器根姿态。 */
export interface BattlefieldWeaponRigPose {
  readonly rootX: number;
  readonly rootY: number;
  readonly rootZ: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
  readonly rotationW: number;
  readonly mainGripX: number;
  readonly mainGripY: number;
  readonly mainGripZ: number;
  readonly supportGripX: number;
  readonly supportGripY: number;
  readonly supportGripZ: number;
}

/** 编排可空手持装备、大锤行为、命中结算和 Renderer 生命周期。 */
export class BattlefieldPlayerEquipmentRuntime {
  public readonly commands = new BattlefieldWeaponCommandBuffer();
  private material: Material | null = null;
  private arrowMaterial: Material | null = null;
  private arrowRenderer: BattlefieldArrowRenderer | null = null;
  private hammerDefinition: Readonly<MeleeWeaponDefinition<EquipmentId.Sledgehammer>> | null = null;
  private bowDefinition: Readonly<ProjectileWeaponDefinition<EquipmentId.ReturningBow>> | null = null;
  private readonly actionState = new BattlefieldHammerActionState();
  private readonly bowActionControl = new BattlefieldBowActionControl();
  private readonly actionEvents: MutableHammerActionEvents = {
    uppercutImpact: false,
    groundSlamImpact: false,
    spinPulse: false,
    spinFinal: false,
  };
  private readonly command: MutableBattlefieldWeaponCommand = {
    attackHeld: false,
    swingRequested: false,
    directionX: 0,
    directionZ: 1,
    startsRight: null,
    groundSlamRequested: false,
    groundSlamDirectionX: 0,
    groundSlamDirectionZ: 1,
    spinRequested: false,
    recallAllRequested: false,
    huntingTetherRequested: false,
  };
  private readonly spinKnockbackTuning = new SledgehammerSpinKnockbackTuning();
  private readonly combat: BattlefieldHammerCombatRuntime;
  private readonly projectileTarget: BattlefieldArrowCombatTarget;
  private bow: BattlefieldReturningBowRuntime | null = null;
  private bowDesiredHeading = 0;
  private projectileOriginX = 0;
  private projectileOriginY = 0;
  private projectileOriginZ = 0;
  private projectileOriginReady = false;
  private renderer: HeldEquipmentRenderer | null = null;
  private equippedItemIdValue: WeaponEquipmentId | null = null;
  private equippedItemInstanceSeedValue: number | null = null;
  private presentationValue: {
    equipmentId: EquipmentId;
    itemInstanceSeed: number;
    hud: Readonly<EquipmentHudProfile>;
    hitCount: number;
    requiredHits: number;
    momentumReady: boolean;
    action: WeaponAction;
    actionProgress: number;
  } | null = null;
  private disposed = false;

  constructor(
    private readonly parent: Node,
    private readonly equipmentLibrary: BattlefieldEquipmentLibrary,
    monsters: BattlefieldHammerCombatTarget & BattlefieldArrowCombatTarget,
  ) {
    this.combat = new BattlefieldHammerCombatRuntime(monsters, this.spinKnockbackTuning);
    this.projectileTarget = monsters;
  }

  public get equipped(): boolean {
    return this.equippedItemIdValue !== null;
  }

  public get equippedItemId(): WeaponEquipmentId | null {
    return this.equippedItemIdValue;
  }

  public get equippedItemInstanceSeed(): number | null {
    return this.equippedItemInstanceSeedValue;
  }

  public get weaponGrip(): WeaponGrip | null {
    return this.equippedItemIdValue === null
      ? null
      : getBattlefieldEquipmentPrototype(this.equippedItemIdValue).held.grip;
  }

  public get weaponAction(): WeaponAction {
    if (this.bow !== null) {
      switch (this.bow.action.action) {
        case BattlefieldBowAction.Charging:
          return WeaponAction.Primary;
        case BattlefieldBowAction.Recover:
          return WeaponAction.Recover;
        default:
          return WeaponAction.Idle;
      }
    }
    return this.actionState.action;
  }

  public get weaponActionProgress(): number {
    if (this.bow !== null && this.bowDefinition !== null) {
      return this.bow.action.action === BattlefieldBowAction.Recover
        ? Math.min(1, this.bow.action.elapsed / this.bowDefinition.attackIntervalSeconds)
        : Math.min(1, this.bow.action.chargeSeconds / this.bowDefinition.chargeDurationSeconds);
    }
    return this.actionState.progress;
  }

  public get weaponActionSide(): -1 | 0 | 1 {
    return this.actionState.poseSide;
  }

  public get actionControl(): Readonly<BattlefieldHammerActionControlEffect> {
    if (this.bow !== null) {
      const remainingSeconds = this.bowDefinition === null
        ? 0
        : Math.max(0, this.bowDefinition.chargeDurationSeconds - this.bow.action.chargeSeconds);
      return this.bowActionControl.write(
        this.bow.action.action,
        this.bowDesiredHeading,
        remainingSeconds,
      );
    }
    return this.actionState.actionControl;
  }

  /** 当前攻击时间轴持有的目标朝向，供连段限制计算。 */
  public get attackHeading(): number {
    return this.actionState.attackHeading;
  }

  public get hammerSweepDebug(): BattlefieldHammerSweepDebugSource {
    return this.combat.sweepDebug;
  }

  /** 当前战场会话中供右上角 Debug 实时修改的旋风击退参数。 */
  public get hammerSpinKnockbackTuning(): SledgehammerSpinKnockbackTuning {
    return this.spinKnockbackTuning;
  }

  /** 当前武器可用于自动锁敌的基础近战射程。 */
  public get meleeReach(): number {
    return this.hammerDefinition?.reach ?? 0;
  }

  /** 当前武器真实命中判定使用的横扫弧度。 */
  public get meleeHitArcRadians(): number {
    return this.hammerDefinition?.hitArcRadians ?? 0;
  }

  /** 当前远程武器的自动锁敌距离。 */
  public get projectileRange(): number {
    return this.bowDefinition?.maximumRange ?? 0;
  }

  /** 输入层应为首次横扫解析新目标。 */
  public get needsInitialSwingAim(): boolean {
    return this.bow !== null || this.actionState.needsInitialSwingAim;
  }

  /** 输入层应在预输入窗口为下一击解析并缓存新目标。 */
  public get canBufferNextSwing(): boolean {
    return this.bow === null && this.actionState.canBufferNextSwing;
  }

  /** 特殊技能仍只能从空闲状态开始。 */
  public get acceptingSkillCommand(): boolean {
    return this.bow !== null
      ? this.bow.action.action === BattlefieldBowAction.Idle
      : this.actionState.action === WeaponAction.Idle;
  }

  public get weaponKind(): WeaponKind | null {
    return this.hammerDefinition?.kind ?? this.bowDefinition?.kind ?? null;
  }

  public get presentation(): Readonly<EquippedWeaponPresentation> | null {
    const value = this.presentationValue;
    if (value === null) {
      return null;
    }
    value.hitCount = this.bow?.readyArrowCount ?? this.actionState.hitCount;
    value.momentumReady = this.bow !== null
      ? this.bow.readyArrowCount < 6
      : this.actionState.momentumCharges > 0;
    value.action = this.weaponAction;
    value.actionProgress = this.weaponActionProgress;
    return value;
  }

  /** 绑定背包中的永久物品实例，并按原型创建对应手持资源。 */
  public equip(item: Readonly<BattlefieldItemInstance>): void {
    this.ensureActive();
    if (this.equippedItemInstanceSeedValue === item.itemInstanceSeed) {
      return;
    }
    if (this.equippedItemIdValue === item.equipmentId && this.renderer !== null) {
      this.equippedItemInstanceSeedValue = item.itemInstanceSeed;
      this.actionState.reset();
      this.combat.reset();
      this.bow?.reset();
      this.commands.clear();
      if (this.presentationValue !== null) {
        this.presentationValue.itemInstanceSeed = item.itemInstanceSeed;
      }
      return;
    }
    this.unequipInternal();
    const prototype = getBattlefieldEquipmentPrototype(item.equipmentId);
    const definition = this.equipmentLibrary.get(item.equipmentId);
    const material = createHeldEquipmentMaterial();
    try {
      this.renderer = new HeldEquipmentRenderer(this.parent, item.equipmentId, material);
    } catch (error: unknown) {
      material.destroy();
      throw error;
    }
    this.material = material;
    if (definition.kind === WeaponKind.Sledgehammer) {
      this.hammerDefinition = definition as Readonly<MeleeWeaponDefinition<EquipmentId.Sledgehammer>>;
    } else {
      this.bowDefinition = definition as Readonly<ProjectileWeaponDefinition<EquipmentId.ReturningBow>>;
      this.bow = new BattlefieldReturningBowRuntime(
        this.bowDefinition,
        this.projectileTarget,
      );
      const arrowMaterial = createBattlefieldArrowMaterial();
      try {
        this.arrowRenderer = new BattlefieldArrowRenderer(this.parent, arrowMaterial);
        this.arrowMaterial = arrowMaterial;
      } catch (error: unknown) {
        arrowMaterial.destroy();
        this.renderer?.dispose();
        material.destroy();
        this.renderer = null;
        this.material = null;
        this.bow = null;
        this.bowDefinition = null;
        throw error;
      }
    }
    this.equippedItemIdValue = item.equipmentId;
    this.equippedItemInstanceSeedValue = item.itemInstanceSeed;
    this.presentationValue = {
      equipmentId: item.equipmentId,
      itemInstanceSeed: item.itemInstanceSeed,
      hud: prototype.hud,
      hitCount: 0,
      requiredHits: definition.kind === WeaponKind.Sledgehammer
        ? definition.specialRequiredHits
        : definition.projectileCapacity,
      momentumReady: false,
      action: WeaponAction.Idle,
      actionProgress: 0,
    };
  }

  /** 卸下当前物品并立即回到空手状态。 */
  public unequip(): void {
    this.ensureActive();
    this.unequipInternal();
  }

  /** 在 PreSimulation 阶段消费输入并推进大锤动作时间轴。 */
  public updateActions(deltaTime: number, owner: Readonly<BattlefieldWeaponOwnerState>): void {
    this.ensureActive();
    this.combat.beginFrame();
    this.commands.consume(this.command);
    const bow = this.bow;
    if (bow !== null) {
      bow.damageEvents.beginFrame();
      bow.setAttackHeld(owner.alive && this.command.attackHeld);
      if (!owner.alive) {
        bow.reset();
        this.commands.clear();
        return;
      }
      if (this.command.recallAllRequested) {
        bow.requestRecallAll();
      } else if (this.command.huntingTetherRequested) {
        bow.requestTether();
      } else if (this.command.swingRequested) {
        this.bowDesiredHeading = Math.atan2(this.command.directionX, this.command.directionZ);
        bow.requestPrimaryAttack();
      }
      bow.update(deltaTime, {
        entityId: 0,
        positionX: owner.positionX,
        positionY: owner.positionY,
        positionZ: owner.positionZ,
        projectileOriginX: this.projectileOriginReady
          ? this.projectileOriginX
          : owner.positionX,
        projectileOriginY: this.projectileOriginReady
          ? this.projectileOriginY
          : owner.positionY + 2.45,
        projectileOriginZ: this.projectileOriginReady
          ? this.projectileOriginZ
          : owner.positionZ,
        aimX: this.command.directionX,
        aimZ: this.command.directionZ,
        alive: owner.alive,
      });
      this.arrowRenderer?.synchronize(
        bow.arrows,
        bow.tethers,
        owner.positionX,
        owner.positionY,
        owner.positionZ,
        owner.heading,
        this.projectileOriginReady ? this.projectileOriginX : owner.positionX,
        this.projectileOriginReady ? this.projectileOriginY : owner.positionY + 2.45,
        this.projectileOriginReady ? this.projectileOriginZ : owner.positionZ,
      );
      return;
    }
    this.actionState.setAttackHeld(owner.alive && this.command.attackHeld);
    if (!owner.alive) {
      this.actionState.reset();
      this.combat.reset();
      this.commands.clear();
      return;
    }
    const definition = this.hammerDefinition;
    if (definition === null) {
      return;
    }
    if (this.command.spinRequested) {
      this.actionState.requestSpin(owner.heading);
    } else if (this.command.groundSlamRequested) {
      this.actionState.requestGroundSlam(Math.atan2(
        this.command.groundSlamDirectionX,
        this.command.groundSlamDirectionZ,
      ));
    } else if (this.command.swingRequested) {
      this.actionState.requestSwing(
        this.command.directionX,
        this.command.directionZ,
        owner.heading,
        this.command.startsRight,
      );
    }
    this.actionState.update(
      Math.max(0, Math.min(deltaTime, 0.05)),
      definition,
      this.actionEvents,
    );
  }

  /** 在怪物空间索引更新后，用同帧视觉锤头轨迹生成全部命中事件。 */
  public collectCombatHits(owner: Readonly<BattlefieldWeaponOwnerState>): void {
    this.ensureActive();
    const definition = this.hammerDefinition;
    if (definition === null) {
      return;
    }
    this.combat.collectHits(owner, this.actionState, this.actionEvents, definition);
  }

  /** 在 PostSimulation 阶段统一结算 Damage 与通用 Effect。 */
  public resolveCombatEvents(): void {
    this.ensureActive();
    if (this.bow !== null) {
      this.bow.resolveDamageEvents();
      return;
    }
    const definition = this.hammerDefinition;
    if (definition === null) {
      return;
    }
    this.combat.resolveEvents(this.actionState, definition);
  }

  /** 在角色动画刷新后同步双手权威握点与唯一武器根。 */
  public synchronizeHeldPose(
    pose: Readonly<BattlefieldWeaponRigPose>,
  ): void {
    this.ensureActive();
    const renderer = this.renderer;
    if (renderer === null) {
      this.combat.reset();
      return;
    }
    const worldPose = renderer.setRigPose(pose);
    if (this.hammerDefinition !== null) {
      this.combat.synchronizeHead(worldPose, renderer.hammerHeadRadius);
    } else if (this.bow !== null) {
      this.projectileOriginX = worldPose.headX;
      this.projectileOriginY = worldPose.headY;
      this.projectileOriginZ = worldPose.headZ;
      this.projectileOriginReady = true;
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.unequipInternal();
    this.disposed = true;
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('玩家武器行为运行时已经释放。');
    }
  }

  private unequipInternal(): void {
    this.renderer?.dispose();
    this.arrowRenderer?.dispose();
    this.material?.destroy();
    this.arrowMaterial?.destroy();
    this.renderer = null;
    this.arrowRenderer = null;
    this.material = null;
    this.arrowMaterial = null;
    this.hammerDefinition = null;
    this.bowDefinition = null;
    this.bow = null;
    this.bowDesiredHeading = 0;
    this.projectileOriginReady = false;
    this.equippedItemIdValue = null;
    this.equippedItemInstanceSeedValue = null;
    this.presentationValue = null;
    this.actionState.reset();
    this.combat.reset();
    this.commands.clear();
  }
}
