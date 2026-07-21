const NORMAL_EPSILON = 0.000001;

/** Sequential Flat Mesh 支持的连续位置流。 */
export type SequentialPositionArray = Float32Array | Float64Array;

/**
 * 从每组三个独立顶点的位置重算硬分面法线。
 *
 * @param positions 只包含完整独立三角形的连续位置流。
 * @param normals 接收单位面法线的最终 Float32 顶点流。
 * @param targetVertexOffset 当前位置流首顶点在目标法线流中的偏移。
 */
export function writeSequentialFlatNormals(
  positions: SequentialPositionArray,
  normals: Float32Array,
  targetVertexOffset = 0,
): void {
  writeSequentialFlatNormalRange(
    positions,
    normals,
    0,
    positions.length / 3,
    targetVertexOffset,
  );
}

/**
 * 从位置流指定连续区段重算硬分面法线，不创建 TypedArray 子视图。
 *
 * @param positions 包含独立三角形的完整位置流。
 * @param normals 接收单位面法线的目标流。
 * @param sourceVertexOffset 位置流中的首顶点偏移。
 * @param vertexCount 需要处理的连续顶点数量，必须为三的倍数。
 * @param targetVertexOffset 法线流中的首顶点偏移。
 */
export function writeSequentialFlatNormalRange(
  positions: SequentialPositionArray,
  normals: Float32Array,
  sourceVertexOffset: number,
  vertexCount: number,
  targetVertexOffset = sourceVertexOffset,
): void {
  if (!Number.isInteger(sourceVertexOffset)
    || !Number.isInteger(vertexCount)
    || !Number.isInteger(targetVertexOffset)
    || sourceVertexOffset < 0
    || vertexCount < 0
    || targetVertexOffset < 0
    || vertexCount % 3 !== 0) {
    throw new Error('Sequential Flat Mesh 位置流必须由完整三角形组成。');
  }
  const sourceComponentOffset = sourceVertexOffset * 3;
  const componentCount = vertexCount * 3;
  if (positions.length < sourceComponentOffset + componentCount
    || normals.length < (targetVertexOffset + vertexCount) * 3) {
    throw new Error('Sequential Flat Mesh 法线目标范围无效。');
  }

  for (let localOffset = 0; localOffset < componentCount; localOffset += 9) {
    const offset = sourceComponentOffset + localOffset;
    const ax = positions[offset] ?? 0;
    const ay = positions[offset + 1] ?? 0;
    const az = positions[offset + 2] ?? 0;
    const edgeABX = (positions[offset + 3] ?? 0) - ax;
    const edgeABY = (positions[offset + 4] ?? 0) - ay;
    const edgeABZ = (positions[offset + 5] ?? 0) - az;
    const edgeACX = (positions[offset + 6] ?? 0) - ax;
    const edgeACY = (positions[offset + 7] ?? 0) - ay;
    const edgeACZ = (positions[offset + 8] ?? 0) - az;
    const crossX = edgeABY * edgeACZ - edgeABZ * edgeACY;
    const crossY = edgeABZ * edgeACX - edgeABX * edgeACZ;
    const crossZ = edgeABX * edgeACY - edgeABY * edgeACX;
    const inverseLength = 1 / Math.max(Math.hypot(crossX, crossY, crossZ), NORMAL_EPSILON);
    const normalX = crossX * inverseLength;
    const normalY = crossY * inverseLength;
    const normalZ = crossZ * inverseLength;
    const firstTargetOffset = targetVertexOffset * 3 + localOffset;
    for (let vertex = 0; vertex < 3; vertex++) {
      const targetOffset = firstTargetOffset + vertex * 3;
      normals[targetOffset] = normalX;
      normals[targetOffset + 1] = normalY;
      normals[targetOffset + 2] = normalZ;
    }
  }
}
