import { WorldScheduler } from '../../../core/world/world-scheduler';
import { type BattlefieldMonsterCombatTarget } from '../population/battlefield-monster-contracts';
import { type BattlefieldWeaponOwnerState } from '../equipment/population/battlefield-player-weapon-runtime';
import { BattlefieldPerformanceStage } from '../debug/battlefield-performance-contracts';
import { type BattlefieldWorldResources } from './battlefield-world-resources';
import { BattlefieldCameraWorldSystem } from './systems/battlefield-camera-world-system';
import { BattlefieldControlWorldSystem } from './systems/battlefield-control-world-system';
import { BattlefieldEnvironmentWorldSystem } from './systems/battlefield-environment-world-system';
import { BattlefieldGroundWorldSystem } from './systems/battlefield-ground-world-system';
import { BattlefieldMonsterWorldSystem } from './systems/battlefield-monster-world-system';
import { BattlefieldMonsterAttackWorldSystem } from './systems/battlefield-monster-attack-world-system';
import { BattlefieldMonsterRenderingWorldSystem } from './systems/battlefield-monster-rendering-world-system';
import { BattlefieldMonsterSpatialIndexWorldSystem } from './systems/battlefield-monster-spatial-index-world-system';
import { BattlefieldPlayerWorldSystem } from './systems/battlefield-player-world-system';
import { BattlefieldStatusWorldSystem } from './systems/battlefield-status-world-system';
import { BattlefieldTreasureWorldSystem } from './systems/battlefield-treasure-world-system';
import { BattlefieldWeaponWorldSystem } from './systems/battlefield-weapon-world-system';
import { BattlefieldCombatEventWorldSystem } from './systems/battlefield-combat-event-world-system';
import { BattlefieldWeaponInputWorldSystem } from './systems/battlefield-weapon-input-world-system';
import { BattlefieldWeaponPoseWorldSystem } from './systems/battlefield-weapon-pose-world-system';
import { BattlefieldMonsterEffectWorldSystem } from './systems/battlefield-monster-effect-world-system';
import { BattlefieldHammerSweepWorldSystem } from './systems/battlefield-hammer-sweep-world-system';
import { BattlefieldInventoryWorldSystem } from './systems/battlefield-inventory-world-system';

interface MutableBattlefieldMonsterCombatTarget extends BattlefieldMonsterCombatTarget {
  x: number;
  z: number;
  collisionRadius: number;
}

interface MutableBattlefieldWeaponOwnerState extends BattlefieldWeaponOwnerState {
  positionX: number;
  positionY: number;
  positionZ: number;
  heading: number;
  alive: boolean;
}

/**
 * 战场轻量数据导向 World。
 *
 * World 只持有稳定资源、跨系统帧状态和 Scheduler，不介入各 Storage 的 SoA 字段遍历。
 */
export class BattlefieldWorld {
  private readonly scheduler = new WorldScheduler<BattlefieldWorld>();
  public readonly monsterCombatTarget: MutableBattlefieldMonsterCombatTarget = {
    x: 0,
    z: 0,
    collisionRadius: 0,
  };
  public readonly weaponOwnerState: MutableBattlefieldWeaponOwnerState = {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    heading: 0,
    alive: true,
  };
  public pendingMonsterAttackDamage = 0;
  private defeatPresented = false;

  constructor(public readonly resources: Readonly<BattlefieldWorldResources>) {
    this.scheduler.register(new BattlefieldControlWorldSystem());
    this.scheduler.register(new BattlefieldInventoryWorldSystem());
    this.scheduler.register(new BattlefieldWeaponInputWorldSystem());
    this.scheduler.register(new BattlefieldWeaponWorldSystem());
    this.scheduler.register(new BattlefieldPlayerWorldSystem());
    this.scheduler.register(new BattlefieldWeaponPoseWorldSystem());
    this.scheduler.register(new BattlefieldCameraWorldSystem());
    this.scheduler.register(new BattlefieldMonsterWorldSystem());
    this.scheduler.register(new BattlefieldMonsterEffectWorldSystem());
    this.scheduler.register(new BattlefieldEnvironmentWorldSystem());
    this.scheduler.register(new BattlefieldGroundWorldSystem());
    this.scheduler.register(new BattlefieldMonsterSpatialIndexWorldSystem());
    this.scheduler.register(new BattlefieldHammerSweepWorldSystem());
    this.scheduler.register(new BattlefieldMonsterAttackWorldSystem());
    this.scheduler.register(new BattlefieldCombatEventWorldSystem());
    this.scheduler.register(new BattlefieldMonsterRenderingWorldSystem());
    this.scheduler.register(new BattlefieldStatusWorldSystem());
    this.scheduler.register(new BattlefieldTreasureWorldSystem());
    this.scheduler.seal();
  }

  /** 推进完整 World；返回大厅期间只维持 HUD 输入和性能窗口。 */
  public step(deltaTime: number, returningToLobby: boolean): void {
    const performance = this.resources.performance;
    performance.beginFrame();
    if (returningToLobby) {
      const startedAt = performance.beginStage();
      this.resources.controls.update(deltaTime);
      performance.endStage(BattlefieldPerformanceStage.Control, startedAt);
      performance.endFrame(deltaTime);
      return;
    }
    this.scheduler.step(this, deltaTime);
    performance.endFrame(deltaTime);
  }

  /** 首次观察到玩家生命归零时冻结交互并显示死亡弹窗。 */
  public presentDefeatIfNeeded(): void {
    if (this.defeatPresented || this.resources.player.isAlive) {
      return;
    }
    this.defeatPresented = true;
    this.resources.interaction.suspend();
    this.resources.controls.showDefeatDialog();
  }
}
