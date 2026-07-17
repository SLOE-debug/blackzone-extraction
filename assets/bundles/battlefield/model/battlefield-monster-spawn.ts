import { BATTLEFIELD_LAYOUT } from './battlefield-layout';

/** 战场基础怪物群体的确定性生成参数。 */
export const BATTLEFIELD_MONSTER_SPAWN = Object.freeze({
  count: 18,
  worldDiameter: 22,
  modelScale: 0.14,
  seed: 0x4b1ac7,
  center: BATTLEFIELD_LAYOUT.playerPosition,
});
