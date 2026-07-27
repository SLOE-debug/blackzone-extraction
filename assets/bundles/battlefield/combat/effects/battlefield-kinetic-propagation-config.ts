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
  readonly collisionDamageMinimumScale: number;
  readonly collisionDamageMaximumScale: number;
  readonly collisionDamageMaximumSpeed: number;
  readonly candidateCapacity: number;
  readonly pairLedgerCapacity: number;
}

export const BATTLEFIELD_KINETIC_PROPAGATION_CONFIG = Object.freeze({
  durationSeconds: 0.7,
  transferRatio: 0.68,
  sourceRetention: 0.74,
  minimumSpeed: 3.2,
  maximumSpeed: 38,
  maximumGeneration: 8,
  maximumCarriersPerSkill: 96,
  pairCooldownSeconds: 0.1,
  collisionDamageMinimumScale: 0.12,
  collisionDamageMaximumScale: 0.45,
  collisionDamageMaximumSpeed: 30,
  candidateCapacity: 512,
  pairLedgerCapacity: 65536,
}) satisfies Readonly<BattlefieldKineticPropagationConfig>;
