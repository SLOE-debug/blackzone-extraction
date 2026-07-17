import {
  getPatchTriangleCount,
  type VanguardCageDefinition,
  type VanguardCagePatch,
  VanguardCagePatchKind,
} from './vanguard-cage';
import {
  VanguardRenderVertexKind,
  type VanguardMeshPlan,
  type VanguardSemanticSpan,
} from './vanguard-mesh-plan';

const VANGUARD_COLOR_VARIANT_COUNT = 7;

/**
 * 将领域控制笼编译为单实体固定拓扑计划。
 *
 * 编译期展开 Triangle、Quad 与 FacetedQuad；运行期不再判断面片类型或重写索引。
 */
export function compileVanguardMeshPlan(
  definition: Readonly<VanguardCageDefinition>,
  surfaceCount: number,
): VanguardMeshPlan {
  if (!Number.isInteger(surfaceCount) || surfaceCount <= 0) {
    throw new Error('主角网格计划的表面数量必须是正整数。');
  }
  if (surfaceCount > 256) {
    throw new Error('主角网格计划的表面数量超过 Uint8 语义索引范围。');
  }
  if (definition.surfaceTriangleCounts.length !== surfaceCount) {
    throw new Error('主角控制笼表面数量与编译契约不一致。');
  }

  const vertexCount = definition.triangleCount * 3;
  if (vertexCount > 65535) {
    throw new Error('主角单实体网格计划超过 Uint16 顶点索引上限。');
  }
  const controlVertexCount = definition.vertices.length;
  if (controlVertexCount > 65535) {
    throw new Error('主角控制笼超过 Uint16 映射索引上限。');
  }

  const controlBoneA = new Uint8Array(controlVertexCount);
  const controlBoneB = new Uint8Array(controlVertexCount);
  const controlLocalA = new Float64Array(controlVertexCount * 3);
  const controlLocalB = new Float64Array(controlVertexCount * 3);
  const controlWeightB = new Float64Array(controlVertexCount);
  compileControlVertices(
    definition,
    controlBoneA,
    controlBoneB,
    controlLocalA,
    controlLocalB,
    controlWeightB,
  );

  const renderVertexKinds: number[] = [];
  const renderToControlVertex: number[] = [];
  const renderToFacetedCenter: number[] = [];
  const facetedCenterA: number[] = [];
  const facetedCenterB: number[] = [];
  const facetedCenterC: number[] = [];
  const facetedCenterD: number[] = [];
  const facetedCenterRidges: number[] = [];
  const observedSurfaceTriangleCounts = new Array<number>(surfaceCount).fill(0);
  let observedTriangleCount = 0;
  let previousSurface = -1;

  for (const patch of definition.patches) {
    assertPatchContract(patch, controlVertexCount, surfaceCount);
    if (patch.surface < previousSurface) {
      throw new Error('主角控制笼面片必须按表面语义连续排列。');
    }
    previousSurface = patch.surface;
    const patchTriangleCount = getPatchTriangleCount(patch.kind);
    observedSurfaceTriangleCounts[patch.surface] = (
      observedSurfaceTriangleCounts[patch.surface] ?? 0
    ) + patchTriangleCount;
    observedTriangleCount += patchTriangleCount;
    switch (patch.kind) {
      case VanguardCagePatchKind.Triangle:
        appendControlTriangle(renderVertexKinds, renderToControlVertex, renderToFacetedCenter,
          patch.a, patch.b, patch.c);
        break;
      case VanguardCagePatchKind.Quad:
        if (patch.flipDiagonal) {
          appendControlTriangle(renderVertexKinds, renderToControlVertex, renderToFacetedCenter,
            patch.a, patch.b, patch.d);
          appendControlTriangle(renderVertexKinds, renderToControlVertex, renderToFacetedCenter,
            patch.b, patch.c, patch.d);
        } else {
          appendControlTriangle(renderVertexKinds, renderToControlVertex, renderToFacetedCenter,
            patch.a, patch.b, patch.c);
          appendControlTriangle(renderVertexKinds, renderToControlVertex, renderToFacetedCenter,
            patch.a, patch.c, patch.d);
        }
        break;
      case VanguardCagePatchKind.FacetedQuad:
        appendFacetedQuad(
          renderVertexKinds,
          renderToControlVertex,
          renderToFacetedCenter,
          facetedCenterA,
          facetedCenterB,
          facetedCenterC,
          facetedCenterD,
          facetedCenterRidges,
          patch.a,
          patch.b,
          patch.c,
          patch.d,
          patch.ridge,
        );
        break;
      }
  }

  assertSurfaceTriangleCounts(
    definition,
    observedSurfaceTriangleCounts,
    observedTriangleCount,
  );

  if (renderVertexKinds.length !== vertexCount) {
    throw new Error('主角编译后的最终顶点数量与控制笼三角形数量不一致。');
  }
  if (facetedCenterA.length > 65535) {
    throw new Error('主角派生中心点数量超过 Uint16 映射索引上限。');
  }

  const indices = new Uint16Array(vertexCount);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    indices[vertex] = vertex;
  }
  const semanticSpans = compileSemanticSpans(definition.surfaceTriangleCounts);
  const semanticIds = new Uint8Array(vertexCount);
  const colorVariantIds = new Uint8Array(vertexCount);
  compileSemanticIds(semanticSpans, semanticIds, colorVariantIds);

  return Object.freeze({
    vertexCount,
    indexCount: indices.length,
    indices,
    controlVertexCount,
    controlBoneA,
    controlBoneB,
    controlLocalA,
    controlLocalB,
    controlWeightB,
    renderVertexKinds: Uint8Array.from(renderVertexKinds),
    renderToControlVertex: Uint16Array.from(renderToControlVertex),
    renderToFacetedCenter: Uint16Array.from(renderToFacetedCenter),
    facetedCenterA: Uint16Array.from(facetedCenterA),
    facetedCenterB: Uint16Array.from(facetedCenterB),
    facetedCenterC: Uint16Array.from(facetedCenterC),
    facetedCenterD: Uint16Array.from(facetedCenterD),
    facetedCenterRidges: Float64Array.from(facetedCenterRidges),
    semanticIds,
    colorVariantIds,
    semanticSpans,
  });
}

/** 将对象化控制笼顶点压缩为连续强类型数据。 */
function compileControlVertices(
  definition: Readonly<VanguardCageDefinition>,
  boneA: Uint8Array,
  boneB: Uint8Array,
  localA: Float64Array,
  localB: Float64Array,
  weightB: Float64Array,
): void {
  for (let vertex = 0; vertex < definition.vertices.length; vertex++) {
    const spec = definition.vertices[vertex];
    if (spec === undefined) {
      throw new Error(`主角控制笼顶点不存在：${vertex}`);
    }
    const offset = vertex * 3;
    boneA[vertex] = spec.boneA;
    boneB[vertex] = spec.boneB;
    localA[offset] = spec.localAX;
    localA[offset + 1] = spec.localAY;
    localA[offset + 2] = spec.localAZ;
    localB[offset] = spec.localBX;
    localB[offset + 1] = spec.localBY;
    localB[offset + 2] = spec.localBZ;
    weightB[vertex] = spec.weightB;
  }
}

/** 验证公开编译器接收的面片仍满足控制笼的基础索引契约。 */
function assertPatchContract(
  patch: Readonly<VanguardCagePatch>,
  controlVertexCount: number,
  surfaceCount: number,
): void {
  if (!Number.isInteger(patch.surface) || patch.surface < 0 || patch.surface >= surfaceCount) {
    throw new Error(`主角控制笼面片表面索引无效：${patch.surface}`);
  }
  for (const vertex of [patch.a, patch.b, patch.c, patch.d]) {
    if (!Number.isInteger(vertex) || vertex < 0 || vertex >= controlVertexCount) {
      throw new Error(`主角控制笼面片顶点索引无效：${vertex}`);
    }
  }
}

/** 验证声明的表面三角形统计与实际展开面片完全一致。 */
function assertSurfaceTriangleCounts(
  definition: Readonly<VanguardCageDefinition>,
  observedSurfaceTriangleCounts: readonly number[],
  observedTriangleCount: number,
): void {
  if (observedTriangleCount !== definition.triangleCount) {
    throw new Error('主角控制笼声明的总三角形数量与实际面片不一致。');
  }
  for (let surface = 0; surface < observedSurfaceTriangleCounts.length; surface++) {
    const observed = observedSurfaceTriangleCounts[surface] ?? 0;
    const declared = definition.surfaceTriangleCounts[surface] ?? 0;
    if (observed !== declared) {
      throw new Error(`主角控制笼表面三角形数量不一致：${surface}`);
    }
  }
}

/** 追加一个由三个共享控制点直接展开的独立三角形。 */
function appendControlTriangle(
  kinds: number[],
  controls: number[],
  centers: number[],
  a: number,
  b: number,
  c: number,
): void {
  appendControlVertex(kinds, controls, centers, a);
  appendControlVertex(kinds, controls, centers, b);
  appendControlVertex(kinds, controls, centers, c);
}

/** 追加一个直接控制点顶点指令。 */
function appendControlVertex(
  kinds: number[],
  controls: number[],
  centers: number[],
  controlVertex: number,
): void {
  kinds.push(VanguardRenderVertexKind.Control);
  controls.push(controlVertex);
  centers.push(0);
}

/** 追加一个中心点由四角派生的分面四边形。 */
function appendFacetedQuad(
  kinds: number[],
  controls: number[],
  centers: number[],
  centerA: number[],
  centerB: number[],
  centerC: number[],
  centerD: number[],
  centerRidges: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  ridge: number,
): void {
  const center = centerA.length;
  centerA.push(a);
  centerB.push(b);
  centerC.push(c);
  centerD.push(d);
  centerRidges.push(ridge);
  appendControlVertex(kinds, controls, centers, a);
  appendControlVertex(kinds, controls, centers, b);
  appendFacetedCenterVertex(kinds, controls, centers, center);
  appendControlVertex(kinds, controls, centers, b);
  appendControlVertex(kinds, controls, centers, c);
  appendFacetedCenterVertex(kinds, controls, centers, center);
  appendControlVertex(kinds, controls, centers, c);
  appendControlVertex(kinds, controls, centers, d);
  appendFacetedCenterVertex(kinds, controls, centers, center);
  appendControlVertex(kinds, controls, centers, d);
  appendControlVertex(kinds, controls, centers, a);
  appendFacetedCenterVertex(kinds, controls, centers, center);
}

/** 追加一个运行期派生中心点顶点指令。 */
function appendFacetedCenterVertex(
  kinds: number[],
  controls: number[],
  centers: number[],
  center: number,
): void {
  kinds.push(VanguardRenderVertexKind.FacetedCenter);
  controls.push(0);
  centers.push(center);
}

/** 按控制笼表面顺序建立连续语义跨度。 */
function compileSemanticSpans(triangleCounts: readonly number[]): readonly VanguardSemanticSpan[] {
  const spans: VanguardSemanticSpan[] = [];
  let startVertex = 0;
  for (let semantic = 0; semantic < triangleCounts.length; semantic++) {
    const triangleCount = triangleCounts[semantic];
    if (triangleCount === undefined || !Number.isInteger(triangleCount) || triangleCount < 0) {
      throw new Error(`主角表面三角形数量无效：${semantic}`);
    }
    const vertexCount = triangleCount * 3;
    spans.push(Object.freeze({ semantic, startVertex, vertexCount }));
    startVertex += vertexCount;
  }
  return Object.freeze(spans);
}

/** 编译每个最终顶点的语义和与旧分面着色一致的颜色变体。 */
function compileSemanticIds(
  spans: readonly VanguardSemanticSpan[],
  semanticIds: Uint8Array,
  colorVariantIds: Uint8Array,
): void {
  for (const span of spans) {
    const startTriangle = span.startVertex / 3;
    for (let localVertex = 0; localVertex < span.vertexCount; localVertex++) {
      const vertex = span.startVertex + localVertex;
      const triangle = Math.floor(localVertex / 3);
      semanticIds[vertex] = span.semantic;
      colorVariantIds[vertex] = (triangle * 5 + startTriangle) % VANGUARD_COLOR_VARIANT_COUNT;
    }
  }
}
