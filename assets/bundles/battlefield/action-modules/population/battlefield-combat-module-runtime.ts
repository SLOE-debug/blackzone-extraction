import { BattlefieldGrabModule } from '../actions/battlefield-grab-module';
import { BattlefieldThrowModule } from '../actions/battlefield-throw-module';
import { BattlefieldCombatEventBuffer } from '../events/battlefield-combat-event-buffer';
import {
  createBattlefieldActionPreview,
  type MutableBattlefieldActionPreview,
} from '../model/battlefield-action-preview';
import {
  type BattlefieldActionMonsterGateway,
  type BattlefieldThrowMovementConstraint,
} from '../model/battlefield-action-runtime-contracts';
import {
  BattlefieldCombatModuleId,
  BattlefieldCombatModuleUnavailableReason,
} from '../model/battlefield-combat-module';
import {
  type BattlefieldActionPlayerPose,
  type BattlefieldCombatModuleIntent,
} from '../model/battlefield-combat-module-intent';
import { BattlefieldManipulationState } from '../model/battlefield-manipulation-state';
import { BattlefieldCombatModuleRegistry } from '../registry/battlefield-combat-module-registry';
import { BattlefieldThrownSimulation } from '../simulation/battlefield-thrown-simulation';

interface BattlefieldCombatModuleExecutor {
  execute(
    intent: Readonly<BattlefieldCombatModuleIntent>,
    player: Readonly<BattlefieldActionPlayerPose>,
    preview: MutableBattlefieldActionPreview,
  ): void;
}

/**
 * 编排模块意图、携带姿态、投掷模拟、碰撞事件和后续 Reaction 扩展点。
 *
 * 具体抓取与投掷行为位于独立模块，运行时只按统一接口分发。
 */
export class BattlefieldCombatModuleRuntime {
  public readonly registry = new BattlefieldCombatModuleRegistry();
  public readonly events = new BattlefieldCombatEventBuffer();
  public readonly preview = createBattlefieldActionPreview();
  private readonly state = new BattlefieldManipulationState();
  private readonly grab: BattlefieldGrabModule;
  private readonly throwAction: BattlefieldThrowModule;
  private readonly executors: readonly (BattlefieldCombatModuleExecutor | null)[];
  private readonly thrownSimulation: BattlefieldThrownSimulation;
  private readonly intent: BattlefieldCombatModuleIntent = {
    moduleId: BattlefieldCombatModuleId.Grab,
    active: false,
    released: false,
    directionX: 0,
    directionZ: 1,
    amplitude: 0,
  };
  private readonly playerPose: BattlefieldActionPlayerPose = {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    alive: true,
  };
  private disposed = false;

  constructor(
    private readonly monsters: BattlefieldActionMonsterGateway,
    movement: BattlefieldThrowMovementConstraint,
  ) {
    this.grab = new BattlefieldGrabModule(this.state, monsters, movement, this.events);
    this.throwAction = new BattlefieldThrowModule(this.state, monsters, movement, this.events);
    this.thrownSimulation = new BattlefieldThrownSimulation(this.state, monsters, this.events);
    this.executors = Object.freeze([
      this.grab,
      this.throwAction,
      null,
    ] satisfies readonly (BattlefieldCombatModuleExecutor | null)[]);
  }

  public get carrying(): boolean {
    return this.state.carrying;
  }

  public get thrown(): boolean {
    return this.state.flying;
  }

  /** Input 阶段开始一帧并保存唯一模块意图，不修改怪物状态。 */
  public captureIntent(intent: Readonly<BattlefieldCombatModuleIntent>): void {
    this.ensureActive();
    validateIntent(intent);
    this.events.beginFrame();
    this.intent.moduleId = intent.moduleId;
    this.intent.active = intent.active;
    this.intent.released = intent.released;
    this.intent.directionX = intent.directionX;
    this.intent.directionZ = intent.directionZ;
    this.intent.amplitude = intent.amplitude;
  }

  /** ActionExecution 阶段执行模块并把携带对象绑定到玩家前上方。 */
  public executeActions(player: Readonly<BattlefieldActionPlayerPose>, deltaTime: number): void {
    this.ensureActive();
    copyPlayerPose(player, this.playerPose);
    resetPreview(this.preview);
    const executor = this.executors[this.intent.moduleId] ?? null;
    executor?.execute(this.intent, this.playerPose, this.preview);
    if (this.state.carrying) {
      this.synchronizeCarriedPose(deltaTime);
    }
    this.intent.released = false;
  }

  /** MovementAndThrownSimulation 阶段推进低弧线并同步怪物权威姿态。 */
  public simulateThrown(deltaTime: number): void {
    this.ensureActive();
    this.thrownSimulation.update(deltaTime);
  }

  /** Collision 阶段解析怪物或地面首次撞击，并产生标准事件链。 */
  public resolveThrownCollision(): void {
    this.ensureActive();
    this.thrownSimulation.resolveCollision();
  }

  /** 返回模块当前前置条件，供轮盘保留禁用槽位。 */
  public getUnavailableReason(
    moduleId: BattlefieldCombatModuleId,
  ): BattlefieldCombatModuleUnavailableReason {
    switch (moduleId) {
      case BattlefieldCombatModuleId.Grab:
        return this.state.carrying || this.state.flying
          ? BattlefieldCombatModuleUnavailableReason.AlreadyCarrying
          : BattlefieldCombatModuleUnavailableReason.None;
      case BattlefieldCombatModuleId.Throw:
        return this.state.carrying
          ? BattlefieldCombatModuleUnavailableReason.None
          : BattlefieldCombatModuleUnavailableReason.NeedsCarriedTarget;
      case BattlefieldCombatModuleId.Reserved:
        return BattlefieldCombatModuleUnavailableReason.ReservedSlot;
    }
  }

  /** 当前版本没有 Reaction；保留独立解析入口供事件监听器顺序消费并追加子事件。 */
  public resolveEvents(): void {
    this.ensureActive();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    if (this.state.carrying || this.state.flying) {
      this.monsters.releaseManipulation(
        this.state.data.reference.populationId[0] ?? 0,
        this.state.data.reference.entityId[0] ?? 0,
      );
    }
    this.state.clear();
    this.disposed = true;
  }

  private synchronizeCarriedPose(deltaTime: number): void {
    const carried = this.state.data.carried;
    const heading = this.playerPose.heading;
    const x = this.playerPose.x + Math.sin(heading) * (carried.offsetZ[0] ?? 1.05);
    const y = this.playerPose.y + (carried.offsetY[0] ?? 1.7);
    const z = this.playerPose.z + Math.cos(heading) * (carried.offsetZ[0] ?? 1.05);
    carried.duration[0] = (carried.duration[0] ?? 0) + Math.max(0, deltaTime);
    carried.x[0] = x;
    carried.y[0] = y;
    carried.z[0] = z;
    if (!this.monsters.synchronizeManipulatedPose(
      this.state.data.reference.populationId[0] ?? 0,
      this.state.data.reference.entityId[0] ?? 0,
      x,
      y,
      z,
      heading,
    )) {
      this.state.clear();
    }
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('战场行为模块运行时已经释放。');
    }
  }
}

function validateIntent(intent: Readonly<BattlefieldCombatModuleIntent>): void {
  if (!Number.isFinite(intent.directionX)
    || !Number.isFinite(intent.directionZ)
    || !Number.isFinite(intent.amplitude)
    || Math.abs(Math.hypot(intent.directionX, intent.directionZ) - 1) > 0.001
    || intent.amplitude < 0
    || intent.amplitude > 1) {
    throw new Error('行为模块意图必须使用单位世界方向和零到一输入幅度。');
  }
}

function copyPlayerPose(
  source: Readonly<BattlefieldActionPlayerPose>,
  target: BattlefieldActionPlayerPose,
): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  target.heading = source.heading;
  target.alive = source.alive;
}

function resetPreview(preview: MutableBattlefieldActionPreview): void {
  preview.active = false;
  preview.valid = false;
  preview.blocked = false;
}
