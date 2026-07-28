import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import {
  type MonsterLaunchResponse,
  PlanarKnockbackCombineMode,
} from '../../assets/core/contracts/monster-effects';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { BattlefieldMonsterEffectRuntime } from '../../assets/bundles/battlefield/combat/effects/battlefield-monster-effect-runtime';
import { type BattlefieldMonsterTargetGroup } from '../../assets/bundles/battlefield/population/battlefield-monster-target-group';

export interface BattlefieldMonsterEffectTestGroup extends BattlefieldMonsterTargetGroup {
  readonly elevations: Float32Array;
  readonly airborne: Uint8Array;
  readonly damageEvents: Array<{ entityId: number; amount: number }>;
}

/** 创建不依赖具体怪物 Bundle 的最小 Effect 群体夹具。 */
export function createMonsterEffectTestGroup(
  populationId: number,
  positions: readonly number[],
  launchResponse: Readonly<MonsterLaunchResponse> = {
    launchable: true,
    heightScale: 1,
    horizontalScale: 1,
    knockbackScale: 1,
  },
): BattlefieldMonsterEffectTestGroup {
  const count = positions.length;
  const lifecycle = new Uint8Array(count);
  lifecycle.fill(MonsterLifecycleState.Alive);
  const participation = new Uint8Array(count);
  participation.fill(1);
  const radius = new Float32Array(count);
  radius.fill(0.5);
  const inverseMass = new Float32Array(count);
  inverseMass.fill(1);
  const elevations = new Float32Array(count);
  const airborne = new Uint8Array(count);
  const damageEvents: Array<{ entityId: number; amount: number }> = [];
  return {
    populationId,
    launchResponse,
    crowdPopulation: {
      populationId,
      count,
      lifecycle,
      participation,
      previousX: Float32Array.from(positions),
      previousY: new Float32Array(count),
      x: Float32Array.from(positions),
      y: new Float32Array(count),
      radius,
      centerHeight: Float32Array.from({ length: count }, () => 1),
      halfHeight: Float32Array.from({ length: count }, () => 0.5),
      elevation: elevations,
      inverseMass,
    },
    elevations,
    airborne,
    damageEvents,
    damageMonster(entityId: number, amount: number): void {
      damageEvents.push({ entityId, amount });
    },
    setAirborneEffect(entityId: number, active: boolean, elevation: number): boolean {
      airborne[entityId] = active ? 1 : 0;
      elevations[entityId] = elevation;
      return true;
    },
  };
}

/** 创建带 Crowd 宽相位的 Effect 运行时并登记全部群体。 */
export function createMonsterEffectRuntime(
  gravity: number,
  ...groups: BattlefieldMonsterTargetGroup[]
): {
  readonly effects: BattlefieldMonsterEffectRuntime;
  readonly crowd: PlanarCrowdSeparationSystem;
} {
  const crowd = new PlanarCrowdSeparationSystem();
  const effects = new BattlefieldMonsterEffectRuntime(gravity, crowd);
  for (const group of groups) {
    crowd.register(group.crowdPopulation);
    effects.register(group);
  }
  crowd.rebuild();
  return { effects, crowd };
}

/** 创建供动量传播测试使用的累积式平面击退。 */
export function createKineticTestKnockback(initialSpeed: number) {
  return {
    directionX: 1,
    directionZ: 0,
    initialSpeed,
    remainingSeconds: 1,
    resistanceScale: 1,
    combineMode: PlanarKnockbackCombineMode.Accumulate,
    maximumSpeed: 52,
  } as const;
}
