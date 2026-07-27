import { type BattlefieldKineticPropagationConfig } from './battlefield-kinetic-propagation-config';

/** 软化怪物碰撞传播时的击退抗性，避免多层传播指数级衰减。 */
export function calculateKineticResistance(knockbackScale: number): number {
  const scale = Math.max(0, Math.min(1, knockbackScale));
  return 0.65 + scale * 0.35;
}

/** 返回指定传播代数必须保留的最低可见速度。 */
export function calculatePropagationFloor(
  generation: number,
  config: Readonly<BattlefieldKineticPropagationConfig>,
): number {
  return Math.max(
    config.minimumPropagationFloorSpeed,
    config.propagationFloorSpeed
      * Math.pow(config.propagationFloorDecay, Math.max(0, generation - 1)),
  );
}
