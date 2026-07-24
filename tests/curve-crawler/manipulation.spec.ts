import { describe, expect, it } from 'vitest';
import {
  CombatTag,
  MonsterBodySize,
  MonsterManipulationState,
  type MutablePlanarMonsterManipulationCandidate,
} from '../../assets/core/contracts/monster-manipulation';
import { CurveCrawlerMovementSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/movement/curve-crawler-movement-system';
import { CurveCrawlerHitSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-hit-system';
import { CurveCrawlerManipulationSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-manipulation-system';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import {
  completeCurveCrawlerTestEmergence,
  createNormalizedCurveCrawlerTestOptions,
} from './state-test-fixture';

describe('Curve Crawler 抓取与投掷能力', () => {
  it('生命低于一半后写入 Executable，并在携带期间停止自主位移', () => {
    const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
      count: 1,
      spawnArea: { centerX: 0, centerY: 0, width: 4, height: 4 },
      seed: 811,
    }));
    completeCurveCrawlerTestEmergence(state);
    const hit = new CurveCrawlerHitSystem();
    const manipulation = new CurveCrawlerManipulationSystem();
    const candidate: MutablePlanarMonsterManipulationCandidate = {
      entityId: -1,
      x: 0,
      y: 0,
      elevation: 0,
      healthRatio: 1,
      bodySize: MonsterBodySize.Small,
      grabResistance: 0,
      playerGrabbable: false,
      tags: CombatTag.None,
      throwMass: 0,
      maximumThrowDistance: 0,
      collisionRadius: 0,
      impactStrength: 0,
    };

    hit.damage(state, 0, 51);
    expect(manipulation.writeCandidate(state, 0, candidate)).toBe(true);
    expect(candidate.healthRatio).toBeCloseTo(0.49, 6);
    expect(candidate.tags & CombatTag.Executable).not.toBe(0);
    expect(manipulation.beginCarry(state, 0)).toBe(true);
    expect(state.data.manipulation.state[0]).toBe(MonsterManipulationState.Carried);

    manipulation.synchronizePose(state, 0, 6, 7, 9, 0);
    state.data.intent.targetSpeed[0] = 100;
    new CurveCrawlerMovementSystem().update(state, 0.05);

    expect(state.data.transform.x[0]).toBe(6);
    expect(state.data.transform.y[0]).toBe(7);
    expect(state.data.animation.fragmentOffsetZ[0]).toBe(9);
  });
});
