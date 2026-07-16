import { type MonsterObservationFootprint } from '../../core/contracts/monster-observation';
import { LOBBY_OBSERVATION_SPIDER_CONFIG } from './lobby-observation-spider-config';

/** 大厅观察蜘蛛在一次观察循环中的场景阶段。 */
export enum LobbyObservationSpiderPhase {
  Roaming,
  SidePositioning,
  TurningTowardGlass,
  Approaching,
  Watching,
  Retreating,
  TurningToRoam,
}

/** 计算指定偏航下完整足迹投影到玻璃法线后的最前安全深度。 */
export function getObservationWatchingDepth(
  scale: number,
  yaw: number,
  footprint: Readonly<MonsterObservationFootprint>,
): number {
  const projectedReach = Math.abs(Math.cos(yaw)) * footprint.forwardReach
    + Math.abs(Math.sin(yaw)) * footprint.lateralReach;
  return LOBBY_OBSERVATION_SPIDER_CONFIG.glassZ
    - projectedReach * scale
    - LOBBY_OBSERVATION_SPIDER_CONFIG.watchingClearance;
}

/** 计算日常巡爬轨迹的中心纵深。 */
export function getObservationRoamingDepth(
  scale: number,
  footprint: Readonly<MonsterObservationFootprint>,
): number {
  const watchingYaw = LOBBY_OBSERVATION_SPIDER_CONFIG.watchingInwardYaw;
  return getObservationWatchingDepth(scale, watchingYaw, footprint)
    - LOBBY_OBSERVATION_SPIDER_CONFIG.retreatDepthPerScale * scale;
}

/** 返回阶段持续时间，游荡阶段按轮次产生稳定变化。 */
export function getObservationPhaseDuration(
  phase: LobbyObservationSpiderPhase,
  cycleIndex: number,
): number {
  const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
  switch (phase) {
    case LobbyObservationSpiderPhase.Roaming:
      return config.minimumRoamingDuration
        + getCycleVariation(cycleIndex) * config.roamingDurationRange;
    case LobbyObservationSpiderPhase.SidePositioning:
      return config.sidePositioningDuration;
    case LobbyObservationSpiderPhase.TurningTowardGlass:
      return config.turningDuration;
    case LobbyObservationSpiderPhase.Approaching:
      return config.approachDuration;
    case LobbyObservationSpiderPhase.Watching:
      return config.watchingDuration;
    case LobbyObservationSpiderPhase.Retreating:
      return config.retreatDuration;
    case LobbyObservationSpiderPhase.TurningToRoam:
      return config.returnTurningDuration;
    default:
      throw new Error(`未知的大厅观察蜘蛛阶段：${String(phase)}`);
  }
}

/** 返回当前椭圆游荡轨迹的切线朝向。 */
export function getObservationRoamingTangentYaw(
  elapsedTime: number,
  scale: number,
): number {
  const config = LOBBY_OBSERVATION_SPIDER_CONFIG;
  const pathAngle = elapsedTime * config.roamingPathRate - 1.1;
  const tangentX = Math.cos(pathAngle)
    * config.roamingHorizontalAmplitude
    * config.roamingPathRate;
  const tangentZ = -Math.sin(pathAngle)
    * config.roamingDepthAmplitudePerScale
    * scale
    * config.roamingPathRate;
  return Math.atan2(tangentX, tangentZ);
}

/** 每轮在观察窗左右两侧交替选择观察位置。 */
export function getObservationWatchingX(cycleIndex: number): number {
  const side = cycleIndex % 2 === 0 ? -1 : 1;
  return side * LOBBY_OBSERVATION_SPIDER_CONFIG.watchingSideOffset;
}

/** 从侧边观察位置略微朝大厅中央偏头。 */
export function getObservationWatchingYaw(watchingX: number): number {
  return -Math.sign(watchingX) * LOBBY_OBSERVATION_SPIDER_CONFIG.watchingInwardYaw;
}

/** 计算 from 到 to 的最短有符号转角。 */
export function getObservationShortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** 为位移曲线提供零起速、零收速且二阶连续的插值比例。 */
export function getObservationSmootherStep(value: number): number {
  const clamped = Math.max(0, Math.min(value, 1));
  return clamped * clamped * clamped
    * (clamped * (clamped * 6 - 15) + 10);
}

/** 生成不依赖运行时对象分配、但每轮不同的稳定等待系数。 */
function getCycleVariation(cycleIndex: number): number {
  const value = Math.sin((cycleIndex + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
