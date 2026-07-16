import { VanguardAction } from './vanguard-action';

/** 可由任意场景提供的主角初始位置。 */
export interface VanguardPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 创建可复用主角实体所需的强类型参数。 */
export interface VanguardPopulationOptions {
  readonly position: Readonly<VanguardPosition>;
  readonly heading: number;
  readonly action: VanguardAction;
  readonly walkSpeed: number;
  readonly weaponReady: number;
}

/** 在进入 SoA 前校验场景提供的主角参数。 */
export function validateVanguardOptions(options: Readonly<VanguardPopulationOptions>): void {
  const values = [
    options.position.x,
    options.position.y,
    options.position.z,
    options.heading,
    options.walkSpeed,
    options.weaponReady,
  ];
  if (!values.every(Number.isFinite)) {
    throw new Error('主角位置、朝向和动作参数必须是有限数值。');
  }
  if (options.walkSpeed < 0) {
    throw new Error('主角走路速度不能小于零。');
  }
  if (options.weaponReady < 0 || options.weaponReady > 1) {
    throw new Error('主角持枪姿态权重必须位于零到一之间。');
  }
}
