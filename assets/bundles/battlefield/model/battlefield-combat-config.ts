/** 战场怪物使用世界单位表达的感知、追击与啃咬参数。 */
export const BATTLEFIELD_COMBAT_CONFIG = Object.freeze({
  monster: Object.freeze({
    detectionRadius: 44,
    disengageRadius: 58,
    attackReach: 0.62,
    impactTolerance: 0.24,
    pursuitSpeedMultiplier: 3.15,
    damage: 9,
    biteTiming: Object.freeze({
      windupSeconds: 0.32,
      strikeSeconds: 0.16,
      recoverySeconds: 0.42,
      cooldownSeconds: 0.78,
    }),
  }),
});
