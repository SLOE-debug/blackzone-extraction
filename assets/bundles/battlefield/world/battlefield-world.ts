import { WorldScheduler } from '../../../core/world/world-scheduler';
import { type MutableBattlefieldAimTarget } from '../population/battlefield-monster-population';
import { type BattlefieldMonsterCombatTarget } from '../population/battlefield-monster-contracts';
import { type BattlefieldWeaponOwnerPose } from '../equipment/population/battlefield-player-weapon-runtime';
import { BattlefieldPerformanceStage } from '../debug/battlefield-performance-contracts';
import { type BattlefieldWorldResources } from './battlefield-world-resources';
import { BattlefieldCameraWorldSystem } from './systems/battlefield-camera-world-system';
import { BattlefieldControlWorldSystem } from './systems/battlefield-control-world-system';
import { BattlefieldEnvironmentWorldSystem } from './systems/battlefield-environment-world-system';
import { BattlefieldGroundWorldSystem } from './systems/battlefield-ground-world-system';
import { BattlefieldMonsterWorldSystem } from './systems/battlefield-monster-world-system';
import { BattlefieldPlayerWorldSystem } from './systems/battlefield-player-world-system';
import { BattlefieldStatusWorldSystem } from './systems/battlefield-status-world-system';
import { BattlefieldTreasureWorldSystem } from './systems/battlefield-treasure-world-system';
import { BattlefieldWeaponWorldSystem } from './systems/battlefield-weapon-world-system';

interface MutableBattlefieldMonsterCombatTarget extends BattlefieldMonsterCombatTarget {
  x: number;
  z: number;
  collisionRadius: number;
}

interface MutableBattlefieldWeaponOwnerPose extends BattlefieldWeaponOwnerPose {
  rootX: number;
  rootY: number;
  rootZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  rotationW: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
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
  public readonly weaponOwnerPose: MutableBattlefieldWeaponOwnerPose = {
    rootX: 0,
    rootY: 0,
    rootZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    rotationW: 1,
    forwardX: 0,
    forwardY: 0,
    forwardZ: 1,
    alive: true,
  };
  public readonly weaponAimTarget: MutableBattlefieldAimTarget = { x: 0, y: 0, z: 0 };
  public weaponFiringRequested = false;
  private defeatPresented = false;

  constructor(public readonly resources: Readonly<BattlefieldWorldResources>) {
    this.scheduler.register(new BattlefieldControlWorldSystem());
    this.scheduler.register(new BattlefieldPlayerWorldSystem());
    this.scheduler.register(new BattlefieldCameraWorldSystem());
    this.scheduler.register(new BattlefieldEnvironmentWorldSystem());
    this.scheduler.register(new BattlefieldGroundWorldSystem());
    this.scheduler.register(new BattlefieldWeaponWorldSystem());
    this.scheduler.register(new BattlefieldMonsterWorldSystem());
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
      this.resources.controls.update();
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
    this.weaponFiringRequested = false;
    this.resources.interaction.suspend();
    this.resources.controls.showDefeatDialog();
  }
}
