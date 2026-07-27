/** 平面击退使用的通用 ECS Effect。 */
export interface PlanarKnockbackEffect {
  readonly directionX: number;
  readonly directionZ: number;
  readonly initialSpeed: number;
  readonly remainingSeconds: number;
  readonly resistanceScale: number;
}

/** 以目标初速度启动的通用垂直腾空 Effect。 */
export interface VerticalLaunchEffect {
  readonly initialVelocity: number;
  readonly gravityScale: number;
  readonly resistanceScale: number;
}

/** 怪物领域状态接收的独立腾空状态与外部高度。 */
export interface PlanarMonsterEffectPopulation {
  /** 把通用腾空模拟的显式状态与正交高度写入稳定实体。 */
  setAirborneEffect(entityId: number, active: boolean, elevation: number): boolean;
}
