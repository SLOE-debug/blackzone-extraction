import { describe, expect, it } from 'vitest';
import { MonsterLifecycleState } from '../../assets/core/contracts/monster-lifecycle';
import { PlanarCrowdCandidateBuffer } from '../../assets/core/monsters/crowd/planar-crowd-candidate-buffer';
import { PlanarCrowdSeparationSystem } from '../../assets/core/monsters/crowd/planar-crowd-separation-system';
import { type PlanarCrowdPopulation } from '../../assets/core/monsters/crowd/planar-crowd-population';

describe('统一平面 Crowd', () => {
  it('跨种族按逆质量分配分离修正，重型实体位移更小', () => {
    const curve = createPopulation(0, 0, 1);
    const venom = createPopulation(1, 0.5, 0.28);
    const system = new PlanarCrowdSeparationSystem({
      cellSize: 4,
      solverIterations: 3,
      stiffness: 0.88,
      maximumCorrectionSpeed: 100,
    });
    system.register(curve);
    system.register(venom);
    const curveBefore = curve.x[0] ?? 0;
    const venomBefore = venom.x[0] ?? 0;
    system.solve(0.1);
    expect(Math.abs((curve.x[0] ?? 0) - curveBefore)).toBeGreaterThan(
      Math.abs((venom.x[0] ?? 0) - venomBefore),
    );
    expect((venom.x[0] ?? 0) - (curve.x[0] ?? 0)).toBeGreaterThanOrEqual(1.9);
  });

  it('同一空间哈希为线段查询返回异构候选且跳过非 Alive 槽位', () => {
    const first = createPopulation(4, 0, 1);
    const second = createPopulation(9, 3, 0.28);
    second.lifecycle[0] = MonsterLifecycleState.Despawning;
    const system = new PlanarCrowdSeparationSystem();
    system.register(first);
    system.register(second);
    system.rebuild();
    const candidates = new PlanarCrowdCandidateBuffer(2);
    system.collectSegmentCandidates(-2, 0, 5, 0, 0.1, candidates);
    expect(candidates.count).toBe(1);
    expect(candidates.populationIds[0]).toBe(4);
  });

  it('圆形宽相位复用同一索引并过滤范围外实体', () => {
    const near = createPopulation(2, 2, 1);
    const far = createPopulation(3, 20, 1);
    const system = new PlanarCrowdSeparationSystem();
    system.register(near);
    system.register(far);
    system.rebuild();
    const candidates = new PlanarCrowdCandidateBuffer(2);
    system.collectCircleCandidates(0, 0, 4, candidates);
    expect(candidates.count).toBe(1);
    expect(candidates.populationIds[0]).toBe(2);
  });

  it('Supercover DDA 穿过网格角并扩张邻域时仍只返回一次实体', () => {
    const population = createPopulation(7, 0, 1);
    const system = new PlanarCrowdSeparationSystem({
      cellSize: 4,
      solverIterations: 1,
      stiffness: 1,
      maximumCorrectionSpeed: 10,
    });
    system.register(population);
    system.rebuild();
    const candidates = new PlanarCrowdCandidateBuffer(1);
    system.collectSegmentCandidates(-8, -8, 8, 8, 0.1, candidates);
    expect(candidates.count).toBe(1);
    expect(candidates.populationIds[0]).toBe(7);
  });
});

function createPopulation(
  populationId: number,
  x: number,
  inverseMass: number,
): PlanarCrowdPopulation {
  return {
    populationId,
    count: 1,
    lifecycle: Uint8Array.of(MonsterLifecycleState.Alive),
    previousX: Float32Array.of(x),
    previousY: Float32Array.of(0),
    x: Float32Array.of(x),
    y: Float32Array.of(0),
    radius: Float32Array.of(1),
    inverseMass: Float32Array.of(inverseMass),
  };
}
