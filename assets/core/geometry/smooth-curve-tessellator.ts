import { type TriangleMeshWriter } from './triangle-mesh-writer';

const EPSILON = 0.000001;

/** 将三次贝塞尔曲线和椭圆离散为固定拓扑三角形网格。 */
export class SmoothCurveTessellator {
  /**
   * 写入一条带可选圆形末端的三次贝塞尔带状网格。
   */
  public static appendCubicRibbon(
    writer: TriangleMeshWriter,
    p0x: number,
    p0y: number,
    p1x: number,
    p1y: number,
    p2x: number,
    p2y: number,
    p3x: number,
    p3y: number,
    startWidth: number,
    endWidth: number,
    segments: number,
    endCapSegments: number,
    z: number,
  ): void {
    const firstVertex = writer.vertexCount;
    let previousTangentX = 1;
    let previousTangentY = 0;

    for (let segment = 0; segment <= segments; segment++) {
      const t = segment / segments;
      const inverse = 1 - t;
      const inverse2 = inverse * inverse;
      const t2 = t * t;
      const x = inverse2 * inverse * p0x
        + 3 * inverse2 * t * p1x
        + 3 * inverse * t2 * p2x
        + t2 * t * p3x;
      const y = inverse2 * inverse * p0y
        + 3 * inverse2 * t * p1y
        + 3 * inverse * t2 * p2y
        + t2 * t * p3y;

      let tangentX = 3 * inverse2 * (p1x - p0x)
        + 6 * inverse * t * (p2x - p1x)
        + 3 * t2 * (p3x - p2x);
      let tangentY = 3 * inverse2 * (p1y - p0y)
        + 6 * inverse * t * (p2y - p1y)
        + 3 * t2 * (p3y - p2y);
      const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);

      if (tangentLength > EPSILON) {
        tangentX /= tangentLength;
        tangentY /= tangentLength;
        previousTangentX = tangentX;
        previousTangentY = tangentY;
      } else {
        tangentX = previousTangentX;
        tangentY = previousTangentY;
      }

      const halfWidth = (startWidth + (endWidth - startWidth) * t) * 0.5;
      const normalX = -tangentY * halfWidth;
      const normalY = tangentX * halfWidth;
      writer.vertex(x + normalX, y + normalY, z);
      writer.vertex(x - normalX, y - normalY, z);
    }

    for (let segment = 0; segment < segments; segment++) {
      const left0 = firstVertex + segment * 2;
      const right0 = left0 + 1;
      const left1 = left0 + 2;
      const right1 = left0 + 3;
      writer.triangle(left0, right0, left1);
      writer.triangle(right0, right1, left1);
    }

    if (endCapSegments >= 3) {
      this.appendEllipse(writer, p3x, p3y, endWidth * 0.52, endWidth * 0.52, 0, endCapSegments, z);
    }
  }

  /** 写入一个旋转椭圆的三角扇。 */
  public static appendEllipse(
    writer: TriangleMeshWriter,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    segments: number,
    z: number,
  ): void {
    const centerIndex = writer.vertex(centerX, centerY, z);
    const firstPerimeter = writer.vertexCount;
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);

    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const localX = Math.cos(angle) * radiusX;
      const localY = Math.sin(angle) * radiusY;
      writer.vertex(
        centerX + localX * cosine - localY * sine,
        centerY + localX * sine + localY * cosine,
        z,
      );
    }

    for (let segment = 0; segment < segments; segment++) {
      writer.triangle(
        centerIndex,
        firstPerimeter + segment,
        firstPerimeter + (segment + 1) % segments,
      );
    }
  }
}
