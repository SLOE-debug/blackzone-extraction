/** 怪群动量传播的稳定数值与性能保险配置。 */
export interface BattlefieldKineticPropagationConfig {
  readonly durationSeconds: number;
  readonly transferRatio: number;
  readonly sourceRetention: number;
  readonly minimumSpeed: number;
  readonly maximumSpeed: number;
  readonly maximumGeneration: number;
  readonly maximumCarriersPerSkill: number;
  readonly pairCooldownSeconds: number;
  readonly propagatedKnockbackDurationSeconds: number;
  readonly propagationFloorSpeed: number;
  readonly propagationFloorDecay: number;
  readonly minimumPropagationFloorSpeed: number;
  readonly collisionDamageMinimumScale: number;
  readonly collisionDamageMaximumScale: number;
  readonly collisionDamageMaximumSpeed: number;
  readonly candidateCapacity: number;
  readonly pairLedgerCapacity: number;
}

export const BATTLEFIELD_KINETIC_PROPAGATION_CONFIG = Object.freeze({
  durationSeconds: 1,
  transferRatio: 0.84,
  sourceRetention: 0.8,
  minimumSpeed: 1.2,
  maximumSpeed: 52,
  maximumGeneration: 10,
  maximumCarriersPerSkill: 128,
  pairCooldownSeconds: 0.06,
  propagatedKnockbackDurationSeconds: 0.48,
  propagationFloorSpeed: 9,
  propagationFloorDecay: 0.62,
  minimumPropagationFloorSpeed: 1.5,
  collisionDamageMinimumScale: 0.12,
  collisionDamageMaximumScale: 0.45,
  collisionDamageMaximumSpeed: 30,
  candidateCapacity: 512,
  pairLedgerCapacity: 65536,
}) satisfies Readonly<BattlefieldKineticPropagationConfig>;
