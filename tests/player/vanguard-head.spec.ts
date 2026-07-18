import { describe, expect, it } from 'vitest';
import { VANGUARD_BODY_CAGE } from '../../assets/player/vanguard/geometry/vanguard-body-cage';
import { VanguardBone } from '../../assets/player/vanguard/model/vanguard-bone';

describe('主角连续头部拓扑', () => {
  it('双耳外脊的每条边都恰好被两个头部面共享', () => {
    const edgeCounts = new Map<string, number>();
    for (const patch of VANGUARD_BODY_CAGE.patches) {
      const vertices = patch.d === patch.c
        ? [patch.a, patch.b, patch.c]
        : [patch.a, patch.b, patch.c, patch.d];
      for (let index = 0; index < vertices.length; index++) {
        const current = vertices[index];
        const next = vertices[(index + 1) % vertices.length];
        if (current === undefined || next === undefined) {
          throw new Error('主角头部面片缺少边界顶点。');
        }
        const key = createEdgeKey(current, next);
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }

    const earRidges = VANGUARD_BODY_CAGE.vertices
      .map((vertex, index) => ({ vertex, index }))
      .filter(({ vertex }) => vertex.boneA === VanguardBone.Head
        && Math.abs(vertex.localAX) > 0.3)
      .map(({ index }) => index);
    expect(earRidges).toHaveLength(4);

    for (const ridge of earRidges) {
      const incidentEdges = [...edgeCounts.entries()].filter(([key]) => (
        key.startsWith(`${ridge}:`) || key.endsWith(`:${ridge}`)
      ));
      expect(incidentEdges.length).toBeGreaterThanOrEqual(3);
      for (const [, count] of incidentEdges) {
        expect(count).toBe(2);
      }
    }
  });
});

function createEdgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
