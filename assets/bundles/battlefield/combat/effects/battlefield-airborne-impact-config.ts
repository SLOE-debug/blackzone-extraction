/** 方向腾空落地时按撞击速度换算伤害的稳定配置。 */
export interface BattlefieldAirborneImpactConfig {
  readonly minimumDamageImpactSpeed: number;
  readonly fullDamageImpactSpeed: number;
  readonly minimumDamageScale: number;
  readonly maximumDamageScale: number;
}

export const BATTLEFIELD_AIRBORNE_IMPACT_CONFIG = Object.freeze({
  minimumDamageImpactSpeed: 5.5,
  fullDamageImpactSpeed: 13,
  minimumDamageScale: 0.3,
  maximumDamageScale: 1,
}) satisfies Readonly<BattlefieldAirborneImpactConfig>;
