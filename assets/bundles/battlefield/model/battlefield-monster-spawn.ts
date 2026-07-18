import { BATTLEFIELD_ENVIRONMENT_LANDMARKS } from '../environment/model/battlefield-environment-landmarks';

/** 战场基础怪物群体的确定性生成参数。 */
export const BATTLEFIELD_MONSTER_SPAWN = Object.freeze({
  count: 18,
  worldDiameter: 4.6,
  modelScale: 0.14,
  seed: 0x4b1ac7,
  center: Object.freeze({
    x: BATTLEFIELD_ENVIRONMENT_LANDMARKS.primaryNest.x,
    y: 0.05,
    z: BATTLEFIELD_ENVIRONMENT_LANDMARKS.primaryNest.z,
  }),
});
