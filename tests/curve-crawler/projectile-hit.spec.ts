import { describe, expect, it } from 'vitest';
import {
  calculateCurveCrawlerAimElevation,
  calculateCurveCrawlerLateralHitHalfExtent,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-combat-volume';
import { CurveCrawlerLifePhase } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-life';
import { CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';
import { CurveCrawlerProjectileHitSystem } from '../../assets/bundles/common-monsters/entities/curve-crawler/population/curve-crawler-projectile-hit-system';
import {
  completeCurveCrawlerTestEmergence,
  createNormalizedCurveCrawlerTestOptions,
} from './state-test-fixture';

describe('Curve Crawler 子弹线段命中', () => {
  it('沿子弹前进方向选择最先接触的存活实体', () => {
    const state = createState();
    state.data.transform.x.set([30, 70, 50]);
    state.data.transform.y.set([0, 0, 0]);
    configureHitShape(state);
    state.data.vitality.phase[2] = CurveCrawlerLifePhase.Gone;
    const elevation = calculateCurveCrawlerAimElevation(4, 0, 0, 0);
    const result = {
      entityId: -1,
      x: 0,
      y: 0,
      elevation: 0,
      segmentProgress: 0,
    };

    expect(new CurveCrawlerProjectileHitSystem().findFirst(state, {
      startX: 0,
      startY: 0,
      startElevation: elevation,
      endX: 100,
      endY: 0,
      endElevation: elevation,
      impactRadius: 0.2,
    }, result)).toBe(true);
    expect(result.entityId).toBe(0);
    expect(result.x).toBe(30);
    expect(result.segmentProgress).toBeGreaterThanOrEqual(0);
    expect(result.segmentProgress).toBeLessThan(0.3);
  });

  it('忽略线段命中半径之外的实体', () => {
    const state = createState();
    configureHitShape(state);
    state.data.transform.x.fill(5);
    state.data.transform.y.fill(30);

    expect(new CurveCrawlerProjectileHitSystem().findFirst(state, {
      startX: 0,
      startY: 0,
      startElevation: 1,
      endX: 10,
      endY: 0,
      endElevation: 1,
      impactRadius: 0.1,
    }, {
      entityId: -1,
      x: 0,
      y: 0,
      elevation: 0,
      segmentProgress: 0,
    })).toBe(false);
  });

  it('三维弹道从近处蜘蛛上方越过后命中指定高度的远处蜘蛛', () => {
    const state = createState();
    state.data.transform.x.set([30, 70, 180]);
    state.data.transform.y.fill(0);
    configureHitShape(state);
    state.data.vitality.phase[2] = CurveCrawlerLifePhase.Gone;
    const elevation = calculateCurveCrawlerAimElevation(4, 0, 0, 0);
    const result = {
      entityId: -1,
      x: 0,
      y: 0,
      elevation: 0,
      segmentProgress: 0,
    };

    expect(new CurveCrawlerProjectileHitSystem().findFirst(state, {
      startX: 0,
      startY: 0,
      startElevation: 10,
      endX: 70,
      endY: 0,
      endElevation: elevation,
      impactRadius: 0.1,
    }, result)).toBe(true);
    expect(result.entityId).toBe(1);
    expect(result.elevation).toBeCloseTo(elevation, 6);
  });

  it('远离躯干但仍穿过远端腿部范围时判定命中', () => {
    const state = createState();
    configureHitShape(state);
    state.data.transform.x.fill(0);
    state.data.transform.y.fill(0);
    state.data.vitality.phase[1] = CurveCrawlerLifePhase.Gone;
    state.data.vitality.phase[2] = CurveCrawlerLifePhase.Gone;
    const lateralHalfExtent = calculateCurveCrawlerLateralHitHalfExtent(
      4,
      10,
      0.8,
      0,
      0,
      0,
    );
    const result = {
      entityId: -1,
      x: 0,
      y: 0,
      elevation: 0,
      segmentProgress: 0,
    };

    expect(lateralHalfExtent).toBeGreaterThan(9);
    expect(new CurveCrawlerProjectileHitSystem().findFirst(state, {
      startX: -20,
      startY: 9,
      startElevation: 0.3,
      endX: 20,
      endY: 9,
      endElevation: 0.3,
      impactRadius: 0,
    }, result)).toBe(true);
    expect(result.entityId).toBe(0);
  });

  it('单一碰撞体随蜘蛛朝向旋转并在远端腿外保持不命中', () => {
    const state = createState();
    configureHitShape(state);
    state.data.transform.x.fill(0);
    state.data.transform.y.fill(0);
    state.data.transform.heading[0] = Math.PI * 0.5;
    state.data.vitality.phase[1] = CurveCrawlerLifePhase.Gone;
    state.data.vitality.phase[2] = CurveCrawlerLifePhase.Gone;
    const hitSystem = new CurveCrawlerProjectileHitSystem();
    const result = {
      entityId: -1,
      x: 0,
      y: 0,
      elevation: 0,
      segmentProgress: 0,
    };

    expect(hitSystem.findFirst(state, {
      startX: 9,
      startY: -20,
      startElevation: 0.3,
      endX: 9,
      endY: 20,
      endElevation: 0.3,
      impactRadius: 0,
    }, result)).toBe(true);
    expect(hitSystem.findFirst(state, {
      startX: 10.2,
      startY: -20,
      startElevation: 0.3,
      endX: 10.2,
      endY: 20,
      endElevation: 0.3,
      impactRadius: 0,
    }, result)).toBe(false);
  });
});

function createState(): CurveCrawlerState {
  const state = new CurveCrawlerState(createNormalizedCurveCrawlerTestOptions({
    count: 3,
    spawnArea: { width: 20, height: 20 },
    seed: 113,
  }));
  completeCurveCrawlerTestEmergence(state);
  return state;
}

function configureHitShape(state: CurveCrawlerState): void {
  state.data.transform.heading.fill(0);
  state.data.morphology.bodyWidth.fill(4);
  state.data.morphology.bodyLength.fill(6);
  state.data.morphology.legLength.fill(10);
  state.data.morphology.legWidth.fill(0.8);
  state.data.animation.bodyPulse.fill(0);
  state.data.animation.crouchAmount.fill(0);
  state.data.animation.biteAmount.fill(0);
  state.data.animation.turnAmount.fill(0);
}
