import { type Material, type Node } from 'cc';
import { WeaponAction, type MeleeWeaponDefinition, type WeaponGrip } from '../../../../core/equipment/equipment';
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
  private definition: Readonly<MeleeWeaponDefinition<EquipmentId.Sledgehammer>> | null = null;
  private readonly actionState = new BattlefieldHammerActionState();
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
  };
  private readonly spinKnockbackTuning = new SledgehammerSpinKnockbackTuning();
  private readonly combat: BattlefieldHammerCombatRuntime;
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
    monsters: BattlefieldHammerCombatTarget,
  ) {
    this.combat = new BattlefieldHammerCombatRuntime(monsters, this.spinKnockbackTuning);
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
    return this.actionState.action;
  }

  public get weaponActionProgress(): number {
    return this.actionState.progress;
  }

  public get weaponActionSide(): -1 | 0 | 1 {
    return this.actionState.poseSide;
  }

  public get actionControl(): Readonly<BattlefieldHammerActionControlEffect> {
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
    return this.definition?.reach ?? 0;
  }

  /** 当前武器真实命中判定使用的横扫弧度。 */
  public get meleeHitArcRadians(): number {
    return this.definition?.hitArcRadians ?? 0;
  }

  /** 输入层应为首次横扫解析新目标。 */
  public get needsInitialSwingAim(): boolean {
    return this.actionState.needsInitialSwingAim;
  }

  /** 输入层应在预输入窗口为下一击解析并缓存新目标。 */
  public get canBufferNextSwing(): boolean {
    return this.actionState.canBufferNextSwing;
  }

  /** 特殊技能仍只能从空闲状态开始。 */
  public get acceptingSkillCommand(): boolean {
    return this.actionState.action === WeaponAction.Idle;
  }

  public get presentation(): Readonly<EquippedWeaponPresentation> | null {
    const value = this.presentationValue;
    if (value === null) {
      return null;
    }
    value.hitCount = this.actionState.hitCount;
    value.momentumReady = this.actionState.momentumCharges > 0;
    value.action = this.actionState.action;
    value.actionProgress = this.actionState.progress;
    return value;
  }

  /** 绑定背包中的永久物品实例，并按原型创建对应手持资源。 */
  public equip(item: Readonly<BattlefieldItemInstance>): void {
    this.ensureActive();
    if (item.equipmentId !== EquipmentId.Sledgehammer) {
      throw new Error(`玩家装备运行时不支持该装备：${item.equipmentId}`);
    }
    if (this.equippedItemInstanceSeedValue === item.itemInstanceSeed) {
      return;
    }
    if (this.equippedItemIdValue === item.equipmentId && this.renderer !== null) {
      this.equippedItemInstanceSeedValue = item.itemInstanceSeed;
      this.actionState.reset();
      this.combat.reset();
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
    this.definition = definition;
    this.equippedItemIdValue = item.equipmentId;
    this.equippedItemInstanceSeedValue = item.itemInstanceSeed;
    this.presentationValue = {
      equipmentId: item.equipmentId,
      itemInstanceSeed: item.itemInstanceSeed,
      hud: prototype.hud,
      hitCount: 0,
      requiredHits: definition.specialRequiredHits,
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
    this.actionState.setAttackHeld(owner.alive && this.command.attackHeld);
    if (!owner.alive) {
      this.actionState.reset();
      this.combat.reset();
      this.commands.clear();
      return;
    }
    const definition = this.definition;
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
    const definition = this.definition;
    if (definition === null) {
      return;
    }
    this.combat.collectHits(owner, this.actionState, this.actionEvents, definition);
  }

  /** 在 PostSimulation 阶段统一结算 Damage 与通用 Effect。 */
  public resolveCombatEvents(): void {
    this.ensureActive();
    const definition = this.definition;
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
    this.combat.synchronizeHead(worldPose, renderer.hammerHeadRadius);
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
    this.material?.destroy();
    this.renderer = null;
    this.material = null;
    this.definition = null;
    this.equippedItemIdValue = null;
    this.equippedItemInstanceSeedValue = null;
    this.presentationValue = null;
    this.actionState.reset();
    this.combat.reset();
    this.commands.clear();
  }
}
