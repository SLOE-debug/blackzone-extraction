import { describe, expect, it } from 'vitest';
import { BattlefieldProjectileImpactBuffer } from '../../assets/bundles/battlefield/equipment/projectile/model/battlefield-projectile-impact-buffer';
import {
  findSweptSphereBoxContact,
  findSweptSphereCapsuleContact,
} from '../../assets/core/geometry/swept-volume-collision';

describe('战场实体弹丸连续碰撞', () => {
  it('高速球体扫掠盒体时返回本帧最早接触时刻', () => {
    const contact = findSweptSphereBoxContact(
      -10, 0, 0,
      10, 0, 0,
      1, 2, 3,
      0.5,
    );
    expect(contact).toBeCloseTo(0.425, 6);
  });

  it('球体扫掠胶囊的柱面和端帽均不会穿透', () => {
    const sideContact = findSweptSphereCapsuleContact(
      -5, 0, 0,
      5, 0, 0,
      0, -2, 0,
      0, 2, 0,
      1,
    );
    const capContact = findSweptSphereCapsuleContact(
      0, 5, 0,
      0, -5, 0,
      0, -2, 0,
      0, 2, 0,
      1,
    );
    expect(sideContact).toBeCloseTo(0.4, 6);
    expect(capContact).toBeCloseTo(0.2, 6);
  });

  it('固定 Impact Buffer 按碰撞顺序保存群体、实体与衰减伤害', () => {
    const impacts = new BattlefieldProjectileImpactBuffer(3);
    impacts.include(1, 4, 38);
    impacts.include(2, 7, 29.64);
    expect(impacts.count).toBe(2);
    expect(Array.from(impacts.populationIds.slice(0, 2))).toEqual([1, 2]);
    expect(Array.from(impacts.entityIds.slice(0, 2))).toEqual([4, 7]);
    expect(impacts.damage[1]).toBeCloseTo(29.64, 4);
  });
});
