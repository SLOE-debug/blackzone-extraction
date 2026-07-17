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
}

/** 在进入 SoA 前校验场景提供的主角参数。 */
export function validateVanguardOptions(options: Readonly<VanguardPopulationOptions>): void {
  const values = [
    options.position.x,
    options.position.y,
    options.position.z,
    options.heading,
  ];
  if (!values.every(Number.isFinite)) {
    throw new Error('主角位置和朝向参数必须是有限数值。');
  }
  if (options.action !== VanguardAction.Idle) {
    throw new Error(`主角动作未实现：${options.action}`);
  }
}
