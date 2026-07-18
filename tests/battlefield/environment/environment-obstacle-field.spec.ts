import { describe, expect, it } from 'vitest';
import { BattlefieldEnvironmentObstacleField } from '../../../assets/bundles/battlefield/environment/collision/battlefield-environment-obstacle-field';
import { BattlefieldEnvironmentGenerator } from '../../../assets/bundles/battlefield/environment/generation/battlefield-environment-generator';
import { BattlefieldEnvironmentPrototype } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-prototype';
import { BattlefieldEnvironmentWorldState } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-state';

describe('战场环境平面障碍场', () => {
  it('阻止玩家进入密林巢穴的圆形遮蔽区域', () => {
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);
    const field = new BattlefieldEnvironmentObstacleField();
    field.rebuild(world, 0, 0);

    const nest = world.get(BattlefieldEnvironmentPrototype.MonsterNest);
    const nestX = nest.data.transform.x[0] ?? 0;
    const nestZ = nest.data.transform.z[0] ?? 0;
    const nestRadius = nest.data.collision.radius[0] ?? 0;
    const playerRadius = 0.44;
    const result = { x: 0, z: 0 };
    field.resolve(
      nestX - nestRadius - playerRadius - 0.1,
      nestZ,
      nestX - nestRadius + 0.2,
      nestZ,
      playerRadius,
      result,
    );

    expect(Math.hypot(result.x - nestX, result.z - nestZ))
      .toBeGreaterThanOrEqual(nestRadius + playerRadius - 0.0001);
  });
});
