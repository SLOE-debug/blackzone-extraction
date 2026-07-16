import {
  MonsterObservationEventType,
  type MonsterObservationEvent,
  type MonsterObservationFootprint,
} from '../../core/contracts/monster-observation';
import { damp, dampAngle, lerp } from '../../core/math/scalar';
import { LOBBY_OBSERVATION_SPIDER_CONFIG } from '../model/lobby-observation-spider-config';
import {
  getObservationPhaseDuration,
  getObservationRoamingDepth,
  getObservationRoamingTangentYaw,
  getObservationShortestAngle,
  getObservationSmootherStep,
  getObservationWatchingDepth,
  getObservationWatchingX,
  getObservationWatchingYaw,
  LobbyObservationSpiderPhase,
} from '../model/lobby-observation-spider-sequence';

const EMPTY_FOOTPRINT: Readonly<MonsterObservationFootprint> = Object.freeze({
  forwardReach: 0,
  lateralReach: 0,
});

/**
 * 编排大厅观察蜘蛛的世界轨迹，并把阶段变化转换成通用怪物观察事件。
 *
 * 该类只拥有场景空间与玻璃安全距离，不包含蜘蛛腿部动画细节。
 */
export class LobbyObservationSpiderMotion {
  private footprint = EMPTY_FOOTPRINT;
  private phase = LobbyObservationSpiderPhase.Roaming;
  private phaseTime = 0;
  private phaseDuration: number;
  private elapsedTime = 0;
  private cycleIndex = 0;
  private phaseStartX: number;
  private phaseStartZ: number;
  private phaseStartYaw: number;
  private turnPivotX = 0;
  private turnPivotZ = 0;
  private turnSignedAngle = 0;
  private currentEvent: MonsterObservationEvent;
  private pendingEvent: MonsterObservationEvent | null;
  private _x = -LOBBY_OBSERVATION_SPIDER_CONFIG.roamingHorizontalAmplitude;
  private _z: number;
  private _yaw = Math.PI * 0.5;
  private _forwardSpeed = 0;
  private _lateralSpeed = 0;
  private _turnRate = 0;

  constructor(initialScale: number) {
    this._z = getObservationRoamingDepth(initialScale, this.footprint);
    this.phaseStartX = this._x;
    this.phaseStartZ = this._z;
    this.phaseStartYaw = this._yaw;
    this.phaseDuration = getObservationPhaseDuration(this.phase, this.cycleIndex);
    this.currentEvent = createTimedEvent(
      MonsterObservationEventType.Wander,
      this.phaseDuration,
    );
    this.pendingEvent = this.currentEvent;
  }

  public get x(): number {
    return this._x;
  }

  public get z(): number {
    return this._z;
  }

  public get yaw(): number {
    return this._yaw;
  }

  public get forwardSpeed(): number {
    return this._forwardSpeed;
  }

  public get lateralSpeed(): number {
    return this._lateralSpeed;
  }

  public get turnRate(): number {
    return this._turnRate;
  }

  /** 当前阶段对应的稳定事件，供异步创建完成的怪物立即对齐状态。 */
  public get observationEvent(): MonsterObservationEvent {
    return this.currentEvent;
  }

  /** 使用怪物实际足迹修正初始纵深，避免偏头观察时外侧脚穿过玻璃。 */
  public setFootprint(
    footprint: Readonly<MonsterObservationFootprint>,
    scale: number,
  ): void {
    if (!Number.isFinite(footprint.forwardReach) || footprint.forwardReach <= 0
      || !Number.isFinite(footprint.lateralReach) || footprint.lateralReach <= 0) {
      throw new Error('观察怪物足迹必须由有限正数构成。');
    }
    this.footprint = Object.freeze({
      forwardReach: footprint.forwardReach,
      lateralReach: footprint.lateralReach,
    });
    this._z = getObservationRoamingDepth(scale, this.footprint);
    this.capturePhaseStart();
  }

  /** 推进场景轨迹，并计算相对于怪物朝向的真实局部速度。 */
  public update(deltaTime: number, scale: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }

    const previousX = this._x;
    const previousZ = this._z;
    const previousYaw = this._yaw;
    this.elapsedTime += deltaTime;
    this.phaseTime += deltaTime;
    this.updatePhasePose(deltaTime, scale);
    this.constrainBehindGlass(scale);
    this.updateLocalMotion(previousX, previousZ, previousYaw, deltaTime, scale);

    if (this.phaseTime >= this.phaseDuration) {
      this.enterNextPhase(scale);
    }
  }

  /** 取出自上次读取后发生的阶段事件；没有切换时返回 null。 */
  public takePendingEvent(): MonsterObservationEvent | null {
    const event = this.pendingEvent;
    this.pendingEvent = null;
    return event;
  }

  /** 根据当前阶段写入连续位置和朝向。 */
  private updatePhasePose(deltaTime: number, scale: number): void {
    switch (this.phase) {
      case LobbyObservationSpiderPhase.Roaming:
        this.updateRoamingPose(deltaTime, scale);
        break;
      case LobbyObservationSpiderPhase.SidePositioning:
        this.updateSidePositioningPose(deltaTime, scale);
        break;
      case LobbyObservationSpiderPhase.TurningTowardGlass:
      case LobbyObservationSpiderPhase.TurningToRoam:
        this.updatePivotTurnPose();
        break;
      case LobbyObservationSpiderPhase.Approaching:
        this.updateApproachingPose(scale);
        break;
      case LobbyObservationSpiderPhase.Watching:
        this.updateWatchingPose(deltaTime, scale);
        break;
      case LobbyObservationSpiderPhase.Retreating:
        this.updateRetreatingPose(scale);
        break;
      default:
        throw new Error(`未知的大厅观察蜘蛛阶段：${String(this.phase)}`);
    }
  }

  /** 沿具有真实纵深的椭圆路径巡爬，使路径端点自然转弯而非原地掉头。 */
  private updateRoamingPose(deltaTime: number, scale: number): void {
    const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
    const pathAngle = this.elapsedTime * config.roamingPathRate - 1.1;
    const targetX = Math.sin(pathAngle) * config.roamingHorizontalAmplitude;
    const depthAmplitude = config.roamingDepthAmplitudePerScale * scale;
    const targetZ = getObservationRoamingDepth(scale, this.footprint)
      + Math.cos(pathAngle) * depthAmplitude;
    const tangentX = Math.cos(pathAngle)
      * config.roamingHorizontalAmplitude
      * config.roamingPathRate;
    const tangentZ = -Math.sin(pathAngle) * depthAmplitude * config.roamingPathRate;
    const targetYaw = Math.atan2(tangentX, tangentZ);

    this._x = damp(this._x, targetX, config.roamingPositionResponse, deltaTime);
    this._z = damp(this._z, targetZ, config.roamingPositionResponse, deltaTime);
    this._yaw = dampAngle(this._yaw, targetYaw, config.roamingYawResponse, deltaTime);
  }

  /** 先沿当前地面站位移动到观察通道，保留随后独立换脚转身的空间。 */
  private updateSidePositioningPose(deltaTime: number, scale: number): void {
    const progress = getObservationSmootherStep(this.phaseTime / this.phaseDuration);
    const targetX = getObservationWatchingX(this.cycleIndex);
    const targetZ = getObservationRoamingDepth(scale, this.footprint);
    const travelX = targetX - this.phaseStartX;
    const travelZ = targetZ - this.phaseStartZ;
    const targetYaw = Math.hypot(travelX, travelZ) > 0.001
      ? Math.atan2(travelX, travelZ)
      : this.phaseStartYaw;

    this._x = lerp(this.phaseStartX, targetX, progress);
    this._z = lerp(this.phaseStartZ, targetZ, progress);
    this._yaw = dampAngle(this._yaw, targetYaw, 3.4, deltaTime);
  }

  /** 绕内侧支撑脚附近的世界支点转动身体，避免绕身体中心原地打转。 */
  private updatePivotTurnPose(): void {
    const progress = getObservationSmootherStep(this.phaseTime / this.phaseDuration);
    const angle = this.turnSignedAngle * progress;
    const relativeX = this.phaseStartX - this.turnPivotX;
    const relativeZ = this.phaseStartZ - this.turnPivotZ;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    this._x = this.turnPivotX + relativeX * cosine + relativeZ * sine;
    this._z = this.turnPivotZ - relativeX * sine + relativeZ * cosine;
    this._yaw = this.phaseStartYaw + angle;
  }

  /** 使用完整缓入缓出曲线靠近玻璃，让腿部拥有可见的加速、匀速和收步过程。 */
  private updateApproachingPose(scale: number): void {
    const progress = getObservationSmootherStep(this.phaseTime / this.phaseDuration);
    const targetX = getObservationWatchingX(this.cycleIndex);
    const targetYaw = getObservationWatchingYaw(targetX);
    const targetZ = getObservationWatchingDepth(scale, targetYaw, this.footprint);
    this._x = lerp(this.phaseStartX, targetX, progress);
    this._z = lerp(this.phaseStartZ, targetZ, progress);
    this._yaw = targetYaw;
  }

  /** 在玻璃前保持细微呼吸式漂移，但任何时刻都不越过安全深度。 */
  private updateWatchingPose(deltaTime: number, scale: number): void {
    const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
    const watchingX = getObservationWatchingX(this.cycleIndex);
    const targetYaw = getObservationWatchingYaw(watchingX)
      + Math.sin(this.elapsedTime * 0.29) * 0.045;
    const safeDepth = getObservationWatchingDepth(scale, targetYaw, this.footprint);
    const retreatingDrift = (0.5 + Math.sin(this.elapsedTime * 0.37) * 0.5)
      * config.watchingDepthDriftPerScale
      * scale;
    const targetX = watchingX
      + Math.sin(this.elapsedTime * 0.46) * config.watchingDriftAmplitude;

    this._x = damp(this._x, targetX, 2.2, deltaTime);
    this._z = damp(this._z, safeDepth - retreatingDrift, 2.2, deltaTime);
    this._yaw = dampAngle(this._yaw, targetYaw, 0.9, deltaTime);
  }

  /** 保持面向玻璃并用反向步态退回，避免观察结束后突然高速滑走。 */
  private updateRetreatingPose(scale: number): void {
    const progress = getObservationSmootherStep(this.phaseTime / this.phaseDuration);
    const targetX = getObservationWatchingX(this.cycleIndex);
    const targetZ = getObservationRoamingDepth(scale, this.footprint);
    this._x = lerp(this.phaseStartX, targetX, progress);
    this._z = lerp(this.phaseStartZ, targetZ, progress);
    this._yaw = this.phaseStartYaw;
  }

  /** 完成当前阶段并发布下一阶段对应的通用怪物事件。 */
  private enterNextPhase(scale: number): void {
    switch (this.phase) {
      case LobbyObservationSpiderPhase.Roaming:
        this.enterPhase(LobbyObservationSpiderPhase.SidePositioning, scale);
        break;
      case LobbyObservationSpiderPhase.SidePositioning:
        this.enterPhase(LobbyObservationSpiderPhase.TurningTowardGlass, scale);
        break;
      case LobbyObservationSpiderPhase.TurningTowardGlass:
        this.enterPhase(LobbyObservationSpiderPhase.Approaching, scale);
        break;
      case LobbyObservationSpiderPhase.Approaching:
        this.enterPhase(LobbyObservationSpiderPhase.Watching, scale);
        break;
      case LobbyObservationSpiderPhase.Watching:
        this.enterPhase(LobbyObservationSpiderPhase.Retreating, scale);
        break;
      case LobbyObservationSpiderPhase.Retreating:
        this.enterPhase(LobbyObservationSpiderPhase.TurningToRoam, scale);
        break;
      case LobbyObservationSpiderPhase.TurningToRoam:
        this.cycleIndex++;
        this.enterPhase(LobbyObservationSpiderPhase.Roaming, scale);
        break;
      default:
        throw new Error(`未知的大厅观察蜘蛛阶段：${String(this.phase)}`);
    }
  }

  /** 初始化阶段起点、转身支点和对外观察事件。 */
  private enterPhase(phase: LobbyObservationSpiderPhase, scale: number): void {
    this.phase = phase;
    this.phaseTime = 0;
    this.phaseDuration = getObservationPhaseDuration(phase, this.cycleIndex);
    this.capturePhaseStart();

    switch (phase) {
      case LobbyObservationSpiderPhase.Roaming:
      case LobbyObservationSpiderPhase.SidePositioning:
        this.publishEvent(createTimedEvent(
          MonsterObservationEventType.Wander,
          this.phaseDuration,
        ));
        break;
      case LobbyObservationSpiderPhase.TurningTowardGlass:
        this.preparePivotTurn(
          getObservationWatchingYaw(getObservationWatchingX(this.cycleIndex)),
          scale,
        );
        break;
      case LobbyObservationSpiderPhase.Approaching:
        this.publishEvent(createTimedEvent(
          MonsterObservationEventType.Approach,
          this.phaseDuration,
        ));
        break;
      case LobbyObservationSpiderPhase.Watching:
        this.publishEvent(createTimedEvent(
          MonsterObservationEventType.Observe,
          this.phaseDuration,
        ));
        break;
      case LobbyObservationSpiderPhase.Retreating:
        this.publishEvent(createTimedEvent(
          MonsterObservationEventType.Retreat,
          this.phaseDuration,
        ));
        break;
      case LobbyObservationSpiderPhase.TurningToRoam:
        this.preparePivotTurn(
          getObservationRoamingTangentYaw(this.elapsedTime, scale),
          scale,
        );
        break;
      default:
        throw new Error(`未知的大厅观察蜘蛛阶段：${String(phase)}`);
    }
  }

  /** 以转向内侧的脚群为近似支点，预计算整段圆弧转身。 */
  private preparePivotTurn(targetYaw: number, scale: number): void {
    this.turnSignedAngle = getObservationShortestAngle(this.phaseStartYaw, targetYaw);
    const turnDirection = Math.sign(this.turnSignedAngle);
    const pivotRadius = this.footprint.lateralReach * scale * 0.42;
    const rightX = Math.cos(this.phaseStartYaw);
    const rightZ = -Math.sin(this.phaseStartYaw);
    this.turnPivotX = this.phaseStartX + rightX * pivotRadius * turnDirection;
    this.turnPivotZ = this.phaseStartZ + rightZ * pivotRadius * turnDirection;
    this.publishEvent(Object.freeze({
      type: MonsterObservationEventType.Turn,
      duration: this.phaseDuration,
      signedAngle: this.turnSignedAngle,
    }));
  }

  /** 缓存当前姿态作为下一段参数曲线的固定起点。 */
  private capturePhaseStart(): void {
    this.phaseStartX = this._x;
    this.phaseStartZ = this._z;
    this.phaseStartYaw = this._yaw;
  }

  /** 保存当前语义阶段，并让场景持有者仅消费一次切换事件。 */
  private publishEvent(event: MonsterObservationEvent): void {
    this.currentEvent = event;
    this.pendingEvent = event;
  }

  /** 以当前偏航角下的完整矩形投影限制脚尖最靠前位置。 */
  private constrainBehindGlass(scale: number): void {
    this._z = Math.min(
      this._z,
      getObservationWatchingDepth(scale, this._yaw, this.footprint),
    );
  }

  /** 将世界位移投影到蜘蛛前向与右向，供蜘蛛内部按真实距离推进腿部相位。 */
  private updateLocalMotion(
    previousX: number,
    previousZ: number,
    previousYaw: number,
    deltaTime: number,
    scale: number,
  ): void {
    const deltaX = this._x - previousX;
    const deltaZ = this._z - previousZ;
    const forwardX = Math.sin(this._yaw);
    const forwardZ = Math.cos(this._yaw);
    const rightX = Math.cos(this._yaw);
    const rightZ = -Math.sin(this._yaw);
    const inverseScaledDeltaTime = 1 / Math.max(deltaTime * scale, 0.0001);
    this._forwardSpeed = (deltaX * forwardX + deltaZ * forwardZ)
      * inverseScaledDeltaTime;
    this._lateralSpeed = (deltaX * rightX + deltaZ * rightZ)
      * inverseScaledDeltaTime;
    this._turnRate = getObservationShortestAngle(previousYaw, this._yaw) / deltaTime;
  }
}

/** 创建不携带额外方向数据的冻结观察事件。 */
function createTimedEvent(
  type: Exclude<MonsterObservationEventType, MonsterObservationEventType.Turn>,
  duration: number,
): MonsterObservationEvent {
  return Object.freeze({ type, duration }) as MonsterObservationEvent;
}
