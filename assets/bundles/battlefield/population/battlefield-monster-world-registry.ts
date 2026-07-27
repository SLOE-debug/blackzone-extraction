import { type PlanarCrowdSeparationSystem } from '../../../core/monsters/crowd/planar-crowd-separation-system';
import { type BattlefieldMonsterEffectRuntime } from '../combat/effects/battlefield-monster-effect-runtime';
import { type BattlefieldMonsterTargetGroup } from './battlefield-monster-target-group';
import { type BattlefieldMonsterTargetRegistry } from './battlefield-monster-target-registry';

/** 以单一事务入口把怪物群同步接入 Crowd、目标查询与通用 Effect。 */
export class BattlefieldMonsterWorldRegistry {
  constructor(
    private readonly crowd: PlanarCrowdSeparationSystem,
    private readonly targets: BattlefieldMonsterTargetRegistry,
    private readonly effects: BattlefieldMonsterEffectRuntime,
  ) {}

  public register(group: BattlefieldMonsterTargetGroup): void {
    this.crowd.register(group.crowdPopulation);
    try {
      this.targets.register(group);
      try {
        this.effects.register(group);
      } catch (error: unknown) {
        this.targets.unregister(group);
        throw error;
      }
    } catch (error: unknown) {
      this.crowd.unregister(group.populationId);
      throw error;
    }
  }

  public unregister(group: BattlefieldMonsterTargetGroup): void {
    this.effects.unregister(group);
    this.targets.unregister(group);
    this.crowd.unregister(group.populationId);
  }
}
