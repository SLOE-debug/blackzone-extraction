import { type Material, Node } from 'cc';
import { type PlanarMovementConstraint } from '../../../core/contracts/planar-movement-constraint';
import { VanguardAnimationSystem } from '../animation/vanguard-animation-system';
import { writeVanguardWeaponSockets } from '../animation/vanguard-weapon-socket-pose';
import { writeVanguardWeaponRigPose } from '../animation/vanguard-weapon-rig-output';
import { VanguardDamageSystem } from '../combat/vanguard-damage-system';
import {
  type VanguardControlIntent,
  validateVanguardControlIntent,
} from '../model/vanguard-control-intent';
import { type VanguardPopulationOptions } from '../model/vanguard-options';
import { VANGUARD_CONFIG } from '../model/vanguard-config';
import { VANGUARD_MAX_HEALTH, VanguardLifePhase } from '../model/vanguard-life';
import { VanguardState } from '../model/vanguard-state';
import { type MutableVanguardWeaponSocketPose } from '../model/vanguard-weapon-socket';
import { type MutableVanguardWeaponRigPose } from '../model/vanguard-weapon-rig-pose';
import { VanguardMovementSystem } from '../movement/vanguard-movement-system';
import { VanguardRenderer } from '../rendering/vanguard-renderer';
import { VanguardMantleSimulationSystem } from '../simulation/vanguard-mantle-system';

const MINIMUM_DELTA_TIME = 1 / 240;
const MAXIMUM_DELTA_TIME = 0.05;

/** 可复用主角的公开运行时门面，只编排姿态更新、渲染和资源生命周期。 */
export class VanguardPopulation {
  private readonly state: VanguardState;
  private readonly damageSystem = new VanguardDamageSystem();
  private readonly movement: VanguardMovementSystem;
  private readonly animation = new VanguardAnimationSystem();
  private readonly mantle = new VanguardMantleSimulationSystem();
  private readonly renderer: VanguardRenderer;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    options: Readonly<VanguardPopulationOptions>,
    movementConstraint: PlanarMovementConstraint,
  ) {
    this.state = new VanguardState(options);
    this.movement = new VanguardMovementSystem(movementConstraint);
    this.animation.initialize(this.state);
    this.mantle.initialize(this.state);
    this.renderer = new VanguardRenderer(parent, this.state, surfaceMaterialTemplate);
  }

  /** 当前主角脚底的世界 X 坐标。 */
  public get positionX(): number {
    return this.state.data.transform.x[0] ?? 0;
  }

  /** 当前主角脚底的世界 Y 坐标。 */
  public get positionY(): number {
    return this.state.data.transform.y[0] ?? 0;
  }

  /** 当前主角脚底的世界 Z 坐标。 */
  public get positionZ(): number {
    return this.state.data.transform.z[0] ?? 0;
  }

  /** 当前主角绕世界 Y 轴的朝向弧度，零值朝向世界正 Z。 */
  public get heading(): number {
    return this.state.data.transform.heading[0] ?? 0;
  }

  /** 当前主角参与近战距离计算的世界碰撞半径。 */
  public get collisionRadius(): number {
    return VANGUARD_CONFIG.collisionRadius;
  }

  /** 当前剩余生命值。 */
  public get health(): number {
    return this.state.data.vitality.health[0] ?? 0;
  }

  /** 主角稳定的最大生命值。 */
  public get maximumHealth(): number {
    return VANGUARD_MAX_HEALTH;
  }

  /** 主角是否仍可移动并被怪物锁定。 */
  public get isAlive(): boolean {
    return (this.state.data.vitality.phase[0] as VanguardLifePhase)
      === VanguardLifePhase.Alive;
  }

  /** 写入下一帧持续使用的移动与瞄准意图。 */
  public setControlIntent(intent: Readonly<VanguardControlIntent>): void {
    this.ensureActive();
    validateVanguardControlIntent(intent);
    const data = this.state.data.intent;
    data.moveX[0] = intent.moveX;
    data.moveZ[0] = intent.moveZ;
    data.aimX[0] = intent.aimX;
    data.aimZ[0] = intent.aimZ;
    data.aimPitch[0] = intent.aimPitch;
    data.aiming[0] = intent.aiming ? 1 : 0;
    data.weaponPose[0] = intent.weaponPose;
    data.weaponAction[0] = intent.weaponAction;
    data.weaponActionProgress[0] = intent.weaponActionProgress;
  }

  /** 把当前左右手骨骼上的掌心挂点写入调用方复用的世界坐标。 */
  public writeWeaponSockets(
    result: MutableVanguardWeaponSocketPose,
  ): void {
    this.ensureActive();
    writeVanguardWeaponSockets(this.state, 0, result);
  }

  /** 写出由瞄准、重量、后坐和动作层共同决定的武器权威世界姿态。 */
  public writeWeaponRigPose(result: MutableVanguardWeaponRigPose): void {
    this.ensureActive();
    writeVanguardWeaponRigPose(this.state, 0, result);
  }

  /** 对主角施加聚合战斗伤害。 */
  public damage(amount: number): void {
    this.ensureActive();
    this.damageSystem.damage(this.state, amount);
  }

  /** 按承伤、移动、动画、披风模拟和渲染的固定顺序推进主角。 */
  public update(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime)) {
      throw new Error('主角帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(MINIMUM_DELTA_TIME, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    this.damageSystem.update(this.state, safeDeltaTime);
    this.movement.update(this.state, safeDeltaTime);
    this.animation.update(this.state, safeDeltaTime);
    this.mantle.update(this.state, safeDeltaTime);
    this.renderer.update(this.state);
  }

  /** 释放主角动态网格和材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.renderer.dispose();
    this.disposed = true;
  }

  /** 阻止释放后的帧更新。 */
  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('主角已经释放。');
    }
  }
}
