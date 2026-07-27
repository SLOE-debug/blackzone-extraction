/** 多次平面击退写入同一实体时采用的速度合成方式。 */
export enum PlanarKnockbackCombineMode {
  Replace = 'replace',
  Accumulate = 'accumulate',
}

/** 平面击退使用的通用 ECS Effect。 */
export interface PlanarKnockbackEffect {
  readonly directionX: number;
  readonly directionZ: number;
  readonly initialSpeed: number;
  readonly remainingSeconds: number;
  readonly resistanceScale: number;
  readonly combineMode: PlanarKnockbackCombineMode;
  readonly maximumSpeed: number;
}

/** 以目标初速度启动的通用垂直腾空 Effect。 */
export interface VerticalLaunchEffect {
  readonly initialVelocity: number;
  readonly gravityScale: number;
  readonly resistanceScale: number;
}

/** 怪物对平面击退与方向腾空的显式响应能力。 */
export interface MonsterLaunchResponse {
  readonly launchable: boolean;
  /** 目标腾空高度倍率。 */
  readonly heightScale: number;
  /** 水平飞行速度倍率。 */
  readonly horizontalScale: number;
  /** 普通平面击退倍率。 */
  readonly knockbackScale: number;
}

/** 同时描述水平飞行与目标腾空高度的方向腾空 Effect。 */
export interface DirectionalLaunchEffect {
  readonly directionX: number;
  readonly directionZ: number;
  readonly targetHeight: number;
  readonly horizontalSpeed: number;
  readonly horizontalDrag: number;
  readonly gravityScale: number;
  /** 用于落地伤害计算的基础伤害；零表示本次腾空不造成落地伤害。 */
  readonly landingDamageBase: number;
}

/** 怪物领域状态接收的独立腾空状态与外部高度。 */
export interface PlanarMonsterEffectPopulation {
  /** 把通用腾空模拟的显式状态与正交高度写入稳定实体。 */
  setAirborneEffect(entityId: number, active: boolean, elevation: number): boolean;
}
