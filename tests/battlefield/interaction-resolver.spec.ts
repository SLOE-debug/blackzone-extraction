import { describe, expect, it } from 'vitest';
import {
  BattlefieldInteractionAction,
  type BattlefieldInteractionProvider,
} from '../../assets/bundles/battlefield/interaction/model/battlefield-interaction';
import { BattlefieldInteractionResolver } from '../../assets/bundles/battlefield/interaction/population/battlefield-interaction-resolver';

describe('战场近距离交互解析', () => {
  it('选择不同模块提供的最近候选并把激活路由回原提供者', () => {
    const farther = new TestProvider(1, 4);
    const nearer = new TestProvider(2, 1);
    const resolver = new BattlefieldInteractionResolver();
    resolver.register(farther);
    resolver.register(nearer);

    expect(resolver.resolve(0, 0)?.sourceId).toBe(2);
    expect(resolver.currentAction).toBe(BattlefieldInteractionAction.OpenContainer);
    expect(resolver.activateCurrent()).toBe(true);
    expect(farther.activated).toBe(false);
    expect(nearer.activated).toBe(true);
  });
});

class TestProvider implements BattlefieldInteractionProvider {
  public activated = false;

  constructor(
    private readonly id: number,
    private readonly distanceSquared: number,
  ) {}

  public writeNearestInteraction(
    _playerX: number,
    _playerZ: number,
    result: {
      sourceId: number;
      action: BattlefieldInteractionAction;
      x: number;
      z: number;
      distanceSquared: number;
    },
  ): boolean {
    result.sourceId = this.id;
    result.action = BattlefieldInteractionAction.OpenContainer;
    result.x = this.distanceSquared;
    result.z = 0;
    result.distanceSquared = this.distanceSquared;
    return true;
  }

  public activateInteraction(
    sourceId: number,
    action: BattlefieldInteractionAction,
  ): boolean {
    this.activated = sourceId === this.id
      && action === BattlefieldInteractionAction.OpenContainer;
    return this.activated;
  }
}
