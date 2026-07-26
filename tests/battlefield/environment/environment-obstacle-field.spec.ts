import { describe, expect, it } from 'vitest';
import { BattlefieldEnvironmentObstacleField } from '../../../assets/bundles/battlefield/environment/collision/battlefield-environment-obstacle-field';
import { BattlefieldEnvironmentGenerator } from '../../../assets/bundles/battlefield/environment/generation/battlefield-environment-generator';
import { BattlefieldEnvironmentPrototype } from '../../../assets/bundles/battlefield/environment/catalog/battlefield-environment-catalog';
import { BattlefieldEnvironmentWorldState } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-state';
import { prepareBattlefieldEnvironment } from '../../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';

describe('战场环境平面障碍场', () => {
  it('阻止玩家穿过仪式祭台的圆形占地区域', () => {
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);
    const field = new BattlefieldEnvironmentObstacleField();
    field.rebuild(world, prepareBattlefieldEnvironment().prototypes, 0, 0);

    const altar = world.get(BattlefieldEnvironmentPrototype.RitualAltar);
    const altarX = altar.data.transform.x[0] ?? 0;
    const altarZ = altar.data.transform.z[0] ?? 0;
    const altarRadius = altar.data.collision.radius[0] ?? 0;
    const playerRadius = 0.44;
    const result = { x: 0, z: 0 };
    field.resolve(
      altarX - altarRadius - playerRadius - 0.1,
      altarZ,
      altarX - altarRadius + 0.2,
      altarZ,
      playerRadius,
      result,
    );

    expect(Math.hypot(result.x - altarX, result.z - altarZ))
      .toBeGreaterThanOrEqual(altarRadius + playerRadius - 0.0001);
  });

  it('三维空间移动可以越过高度区间之外的环境障碍', () => {
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);
    const preparation = prepareBattlefieldEnvironment();
    const field = new BattlefieldEnvironmentObstacleField();
    field.rebuild(world, preparation.prototypes, 0, 0);

    const altar = world.get(BattlefieldEnvironmentPrototype.RitualAltar);
    const altarX = altar.data.transform.x[0] ?? 0;
    const altarZ = altar.data.transform.z[0] ?? 0;
    const altarRadius = altar.data.collision.radius[0] ?? 0;
    const preparedAltar = preparation.prototypes.find(
      (entry) => entry.definition.prototype === BattlefieldEnvironmentPrototype.RitualAltar,
    );
    expect(preparedAltar).toBeDefined();
    const scale = altar.data.transform.scale[0] ?? 1;
    const highY = (altar.data.transform.y[0] ?? 0)
      + (preparedAltar?.plan.bounds.maxY ?? 0) * scale
      + 2;
    const result = { x: 0, y: 0, z: 0 };

    field.resolveSpatial(
      altarX - altarRadius - 1,
      highY,
      altarZ,
      altarX,
      highY,
      altarZ,
      0.35,
      result,
    );

    expect(result).toEqual({ x: altarX, y: highY, z: altarZ });
  });
});
