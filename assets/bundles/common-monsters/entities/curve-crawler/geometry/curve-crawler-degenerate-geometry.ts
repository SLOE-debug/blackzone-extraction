import { type TriangleMeshWriter } from '../../../../../core/geometry/triangle-mesh-writer';

/**
 * 将固定数量的顶点和三角形写成零面积表面，用于隐藏已坍缩的动态拓扑。
 */
export function writeCurveCrawlerDegenerateGeometry(
  writer: TriangleMeshWriter,
  vertexCount: number,
  indexCount: number,
  x: number,
  y: number,
  z: number,
): void {
  const firstVertex = writer.vertexCount;
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    writer.vertex(x, y, z, 0, 0, 1);
  }
  for (let index = 0; index < indexCount; index += 3) {
    writer.triangle(firstVertex, firstVertex, firstVertex);
  }
}
