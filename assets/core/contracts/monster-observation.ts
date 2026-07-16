import { type Disposable } from './disposable';

/** 怪物在观察面外活动时能够接收的高层语义事件。 */
export enum MonsterObservationEventType {
  Wander,
  Turn,
  Approach,
  Observe,
  Retreat,
}

/** 不包含额外方向参数的观察行为事件。 */
interface TimedMonsterObservationEvent {
  readonly duration: number;
}

/** 怪物在观察区域外继续游荡或调整站位。 */
export interface MonsterWanderEvent extends TimedMonsterObservationEvent {
  readonly type: MonsterObservationEventType.Wander;
}

/** 怪物通过自身步态完成一次有方向的转身。 */
export interface MonsterTurnEvent extends TimedMonsterObservationEvent {
  readonly type: MonsterObservationEventType.Turn;
  /** 本次转身的有符号弧度，正负号用于选择内外侧支撑腿。 */
  readonly signedAngle: number;
}

/** 怪物主动靠近观察面。 */
export interface MonsterApproachEvent extends TimedMonsterObservationEvent {
  readonly type: MonsterObservationEventType.Approach;
}

/** 怪物停留在观察面前并观察内部目标。 */
export interface MonsterObserveEvent extends TimedMonsterObservationEvent {
  readonly type: MonsterObservationEventType.Observe;
}

/** 怪物保持警觉并从观察面前退回安全区域。 */
export interface MonsterRetreatEvent extends TimedMonsterObservationEvent {
  readonly type: MonsterObservationEventType.Retreat;
}

/** 所有可观察怪物共享的阶段切换事件。 */
export type MonsterObservationEvent = Readonly<
  | MonsterWanderEvent
  | MonsterTurnEvent
  | MonsterApproachEvent
  | MonsterObserveEvent
  | MonsterRetreatEvent
>;

/** 怪物局部平面内用于观察面安全距离计算的保守足迹。 */
export interface MonsterObservationFootprint {
  /** 怪物朝正前方迈步时，从身体原点到最前端脚尖的距离。 */
  readonly forwardReach: number;
  /** 怪物朝正前方站立时，从身体原点到最外侧脚尖的距离。 */
  readonly lateralReach: number;
}

/**
 * 场景编排器控制观察型怪物时使用的稳定门面。
 *
 * 场景只描述语义阶段和真实运动结果，具体动作由每种怪物自行实现。
 */
export interface MonsterObservationPopulation extends Disposable {
  /** 当前受控群体包含的实体数量。 */
  readonly count: number;
  /** 未应用场景缩放前的局部保守足迹。 */
  readonly observationFootprint: Readonly<MonsterObservationFootprint>;

  /** 推进怪物自身的行为、动画和渲染状态。 */
  update(deltaTime: number): void;

  /** 通知怪物进入新的观察行为阶段。 */
  enterObservationEvent(event: MonsterObservationEvent): void;

  /**
   * 同步场景根节点产生的实际局部运动，供步态按真实位移推进。
   *
   * @param forwardSpeed 沿怪物正前方的有符号速度，负值表示后退。
   * @param lateralSpeed 沿怪物右侧方向的有符号速度。
   * @param turnRate 绕竖直轴的有符号角速度，单位为弧度每秒。
   */
  synchronizeObservationMotion(
    forwardSpeed: number,
    lateralSpeed: number,
    turnRate: number,
  ): void;
}
