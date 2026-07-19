import { describe, expect, it } from 'vitest';
import { BattlefieldEnvironmentGenerator } from '../../../assets/bundles/battlefield/environment/generation/battlefield-environment-generator';
import { prepareBattlefieldEnvironment } from '../../../assets/bundles/battlefield/environment/compilation/battlefield-environment-preparation';
import { BattlefieldEnvironmentWorldState } from '../../../assets/bundles/battlefield/environment/model/battlefield-environment-state';
import {
  evaluateBattlefieldEnvironmentSectionRange,
} from '../../../assets/bundles/battlefield/environment/rendering/battlefield-environment-mesh-evaluator';
import {
  BattlefieldEnvironmentUpdateCursor,
  type MutableBattlefieldEnvironmentUpdateRange,
} from '../../../assets/bundles/battlefield/environment/rendering/battlefield-environment-update-cursor';

describe('战场环境分帧更新游标', () => {
  it('按顶点预算连续覆盖全部区段且不会遗漏实体', () => {
    const sections = Object.freeze([
      Object.freeze({ entityCount: 5, verticesPerEntity: 12 }),
      Object.freeze({ entityCount: 3, verticesPerEntity: 20 }),
    ]);
    const cursor = new BattlefieldEnvironmentUpdateCursor(sections);
    const range: MutableBattlefieldEnvironmentUpdateRange = {
      sectionIndex: 0,
      firstEntity: 0,
      entityCount: 0,
      vertexCount: 0,
    };
    const covered = [0, 0];
    cursor.restart();
    while (cursor.writeNext(32, range)) {
      covered[range.sectionIndex] = (covered[range.sectionIndex] ?? 0) + range.entityCount;
      expect(range.vertexCount).toBe(range.entityCount * sections[range.sectionIndex]!.verticesPerEntity);
      expect(range.vertexCount).toBeLessThanOrEqual(32);
    }
    expect(covered).toEqual([5, 3]);
    expect(cursor.active).toBe(false);
  });

  it('分段求值与一次覆盖完整区段得到相同顶点流', () => {
    const preparation = prepareBattlefieldEnvironment();
    const prepared = preparation.prototypes[0];
    if (prepared === undefined) {
      throw new Error('环境测试缺少首个原型。');
    }
    const world = new BattlefieldEnvironmentWorldState();
    new BattlefieldEnvironmentGenerator().populate(0, 0, world);
    const state = world.get(prepared.definition.prototype);
    const vertexCount = prepared.plan.vertexCount * state.count;
    const complete = {
      positions: new Float32Array(vertexCount * 3),
      colors: new Float32Array(vertexCount * 4),
    };
    const incremental = {
      positions: new Float32Array(vertexCount * 3),
      colors: new Float32Array(vertexCount * 4),
    };
    evaluateBattlefieldEnvironmentSectionRange(
      state,
      prepared.plan,
      complete,
      0,
      state.count,
    );
    const split = Math.floor(state.count * 0.5);
    evaluateBattlefieldEnvironmentSectionRange(
      state,
      prepared.plan,
      incremental,
      0,
      split,
    );
    evaluateBattlefieldEnvironmentSectionRange(
      state,
      prepared.plan,
      incremental,
      split,
      state.count - split,
    );
    expect(incremental.positions).toEqual(complete.positions);
    expect(incremental.colors).toEqual(complete.colors);
  });
});
