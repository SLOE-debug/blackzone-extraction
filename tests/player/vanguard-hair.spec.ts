import { describe, expect, it } from 'vitest';
import {
  getPatchTriangleCount,
  type VanguardCagePatch,
} from '../../assets/player/vanguard/geometry/vanguard-cage';
import { VANGUARD_BODY_CAGE } from '../../assets/player/vanguard/geometry/vanguard-body-cage';
import { VANGUARD_HAIR_CAGE } from '../../assets/player/vanguard/geometry/vanguard-hair-cage';
import { VanguardMatteSurface } from '../../assets/player/vanguard/geometry/vanguard-surface';
import { VanguardBone } from '../../assets/player/vanguard/model/vanguard-bone';

describe('主角连续帽下短发', () => {
  it('侧头、头顶与后脑共用一整片头部拓扑且没有外层碎发片', () => {
    const overlayHairPatches = VANGUARD_HAIR_CAGE.patches.filter(
      (patch) => patch.surface === VanguardMatteSurface.Hair,
    );
    expect(overlayHairPatches).toHaveLength(0);

    const scalpPatches = VANGUARD_BODY_CAGE.patches.filter(
      (patch) => patch.surface === VanguardMatteSurface.Hair,
    );
    const adjacency = Array.from(
      { length: VANGUARD_BODY_CAGE.vertices.length },
      () => new Set<number>(),
    );
    const scalpVertices = new Set<number>();
    let triangleCount = 0;
    for (const patch of scalpPatches) {
      connectPatch(adjacency, scalpVertices, patch);
      triangleCount += getPatchTriangleCount(patch.kind);
    }

    const first = scalpVertices.values().next().value as number | undefined;
    if (first === undefined) {
      throw new Error('主角头部没有连续短发面。');
    }
    const visited = visitConnectedVertices(adjacency, first);
    expect(visited.size).toBe(scalpVertices.size);
    expect(triangleCount).toBe(30);

    const scalpVertexSpecs = [...scalpVertices].map((index) => {
      const vertex = VANGUARD_BODY_CAGE.vertices[index];
      if (vertex === undefined) {
        throw new Error('主角短发面引用了不存在的头部顶点。');
      }
      return vertex;
    });
    expect(scalpVertexSpecs.every((vertex) => vertex.boneA === VanguardBone.Head)).toBe(true);
    expect(Math.max(...scalpVertexSpecs.map((vertex) => Math.abs(vertex.localAX))))
      .toBeGreaterThan(0.2);
    expect(Math.min(...scalpVertexSpecs.map((vertex) => vertex.localAZ)))
      .toBeLessThan(-0.2);
    expect(Math.max(...scalpVertexSpecs.map((vertex) => vertex.localAY)))
      .toBeGreaterThan(0.3);

    const exposedCrownSkin = VANGUARD_BODY_CAGE.patches.filter((patch) => (
      patch.surface === VanguardMatteSurface.Skin
      && getPatchVertices(patch).every((index) => {
        const vertex = VANGUARD_BODY_CAGE.vertices[index];
        return vertex?.boneA === VanguardBone.Head && vertex.localAY >= 0.23;
      })
    ));
    expect(exposedCrownSkin).toHaveLength(0);
  });
});

function visitConnectedVertices(
  adjacency: readonly ReadonlySet<number>[],
  first: number,
): ReadonlySet<number> {
  const visited = new Set<number>();
  const pending = [first];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const neighbor of adjacency[current] ?? []) {
      pending.push(neighbor);
    }
  }
  return visited;
}

function connectPatch(
  adjacency: readonly Set<number>[],
  usedVertices: Set<number>,
  patch: Readonly<VanguardCagePatch>,
): void {
  const vertices = getPatchVertices(patch);
  for (let index = 0; index < vertices.length; index++) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (current === undefined || next === undefined) {
      throw new Error('主角短发面片缺少边界顶点。');
    }
    usedVertices.add(current);
    usedVertices.add(next);
    adjacency[current]?.add(next);
    adjacency[next]?.add(current);
  }
}

function getPatchVertices(patch: Readonly<VanguardCagePatch>): readonly number[] {
  return patch.d === patch.c
    ? [patch.a, patch.b, patch.c]
    : [patch.a, patch.b, patch.c, patch.d];
}
