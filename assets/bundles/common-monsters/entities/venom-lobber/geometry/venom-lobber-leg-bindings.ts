import {
  VENOM_LOBBER_LEG_COUNT,
  VENOM_LOBBER_LEG_RADIAL_SEGMENTS,
  VENOM_LOBBER_LEG_SEGMENT_COUNT,
} from '../model/venom-lobber-leg-rig';

/** Venom Lobber 固定拓扑中的六足顶点语义流。 */
export interface VenomLobberLegVertexBindings {
  readonly legIds: Uint8Array;
  readonly segmentIds: Uint8Array;
  readonly segmentWeights: Float32Array;
}

/** 根据腿部连续拓扑区段编译每顶点腿标识、刚性段标识与权重。 */
export function createVenomLobberLegVertexBindings(
  vertexCount: number,
  legStart: number,
  legEnd: number,
): VenomLobberLegVertexBindings {
  const bridgeVertexCount = VENOM_LOBBER_LEG_RADIAL_SEGMENTS * 6;
  const capVertexCount = VENOM_LOBBER_LEG_RADIAL_SEGMENTS * 3;
  const verticesPerLeg = bridgeVertexCount * VENOM_LOBBER_LEG_SEGMENT_COUNT
    + capVertexCount * 2;
  if (legEnd - legStart !== verticesPerLeg * VENOM_LOBBER_LEG_COUNT) {
    throw new Error('Venom Lobber 腿部拓扑与三段绑定容量不一致。');
  }
  const legIds = new Uint8Array(vertexCount);
  const segmentIds = new Uint8Array(vertexCount);
  const segmentWeights = new Float32Array(vertexCount);
  for (let legId = 0; legId < VENOM_LOBBER_LEG_COUNT; legId++) {
    const legBase = legStart + legId * verticesPerLeg;
    for (let segmentId = 0; segmentId < VENOM_LOBBER_LEG_SEGMENT_COUNT; segmentId++) {
      const segmentStart = legBase + segmentId * bridgeVertexCount;
      writeBindingRange(
        legIds,
        segmentIds,
        segmentWeights,
        segmentStart,
        segmentStart + bridgeVertexCount,
        legId,
        segmentId,
      );
    }
    const capsStart = legBase + bridgeVertexCount * VENOM_LOBBER_LEG_SEGMENT_COUNT;
    writeBindingRange(
      legIds,
      segmentIds,
      segmentWeights,
      capsStart,
      capsStart + capVertexCount,
      legId,
      0,
    );
    writeBindingRange(
      legIds,
      segmentIds,
      segmentWeights,
      capsStart + capVertexCount,
      capsStart + capVertexCount * 2,
      legId,
      VENOM_LOBBER_LEG_SEGMENT_COUNT - 1,
    );
  }
  return Object.freeze({ legIds, segmentIds, segmentWeights });
}

function writeBindingRange(
  legIds: Uint8Array,
  segmentIds: Uint8Array,
  segmentWeights: Float32Array,
  start: number,
  end: number,
  legId: number,
  segmentId: number,
): void {
  for (let vertex = start; vertex < end; vertex++) {
    legIds[vertex] = legId + 1;
    segmentIds[vertex] = segmentId + 1;
    segmentWeights[vertex] = 1;
  }
}
