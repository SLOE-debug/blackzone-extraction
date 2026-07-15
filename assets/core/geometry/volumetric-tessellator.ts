import { type TriangleMeshWriter } from './triangle-mesh-writer';

const EPSILON = 0.000001;

/** 将三维曲线和椭球离散为带法线的固定拓扑三角形网格。 */
export class VolumetricTessellator {
  /**
   * 沿三次贝塞尔曲线写入圆形截面的管状网格。
   */
  public static appendCubicTube(
    writer: TriangleMeshWriter,
    p0x: number,
    p0y: number,
    p0z: number,
    p1x: number,
    p1y: number,
    p1z: number,
    p2x: number,
    p2y: number,
    p2z: number,
    p3x: number,
    p3y: number,
    p3z: number,
    startRadius: number,
    endRadius: number,
    segments: number,
    radialSegments: number,
  ): void {
    const firstVertex = writer.vertexCount;
    let previousTangentX = 1;
    let previousTangentY = 0;
    let previousTangentZ = 0;
    let previousSideX = 0;
    let previousSideY = 1;

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
      const z = inverse2 * inverse * p0z
        + 3 * inverse2 * t * p1z
        + 3 * inverse * t2 * p2z
        + t2 * t * p3z;

      let tangentX = 3 * inverse2 * (p1x - p0x)
        + 6 * inverse * t * (p2x - p1x)
        + 3 * t2 * (p3x - p2x);
      let tangentY = 3 * inverse2 * (p1y - p0y)
        + 6 * inverse * t * (p2y - p1y)
        + 3 * t2 * (p3y - p2y);
      let tangentZ = 3 * inverse2 * (p1z - p0z)
        + 6 * inverse * t * (p2z - p1z)
        + 3 * t2 * (p3z - p2z);
      const tangentLength = Math.sqrt(
        tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ,
      );

      if (tangentLength > EPSILON) {
        tangentX /= tangentLength;
        tangentY /= tangentLength;
        tangentZ /= tangentLength;
        previousTangentX = tangentX;
        previousTangentY = tangentY;
        previousTangentZ = tangentZ;
      } else {
        tangentX = previousTangentX;
        tangentY = previousTangentY;
        tangentZ = previousTangentZ;
      }

      const horizontalLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
      let sideX = previousSideX;
      let sideY = previousSideY;
      if (horizontalLength > EPSILON) {
        sideX = -tangentY / horizontalLength;
        sideY = tangentX / horizontalLength;
        previousSideX = sideX;
        previousSideY = sideY;
      }
      const upX = -tangentZ * sideY;
      const upY = tangentZ * sideX;
      const upZ = tangentX * sideY - tangentY * sideX;
      const radius = startRadius + (endRadius - startRadius) * t;

      for (let radial = 0; radial < radialSegments; radial++) {
        const angle = radial / radialSegments * Math.PI * 2;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const normalX = sideX * cosine + upX * sine;
        const normalY = sideY * cosine + upY * sine;
        const normalZ = upZ * sine;
        writer.vertex(
          x + normalX * radius,
          y + normalY * radius,
          z + normalZ * radius,
          normalX,
          normalY,
          normalZ,
        );
      }
    }

    for (let segment = 0; segment < segments; segment++) {
      const currentRing = firstVertex + segment * radialSegments;
      const nextRing = currentRing + radialSegments;
      for (let radial = 0; radial < radialSegments; radial++) {
        const nextRadial = (radial + 1) % radialSegments;
        const current = currentRing + radial;
        const currentNext = currentRing + nextRadial;
        const next = nextRing + radial;
        const nextNext = nextRing + nextRadial;
        writer.triangle(current, currentNext, next);
        writer.triangle(currentNext, nextNext, next);
      }
    }
  }

  /**
   * 写入一个绕 Z 轴旋转的椭球网格。
   */
  public static appendEllipsoid(
    writer: TriangleMeshWriter,
    centerX: number,
    centerY: number,
    centerZ: number,
    radiusX: number,
    radiusY: number,
    radiusZ: number,
    rotation: number,
    longitudeSegments: number,
    latitudeSegments: number,
  ): void {
    const firstVertex = writer.vertexCount;
    const rotationCosine = Math.cos(rotation);
    const rotationSine = Math.sin(rotation);

    for (let latitude = 0; latitude <= latitudeSegments; latitude++) {
      const latitudeAngle = latitude / latitudeSegments * Math.PI - Math.PI * 0.5;
      const latitudeCosine = Math.cos(latitudeAngle);
      const latitudeSine = Math.sin(latitudeAngle);

      for (let longitude = 0; longitude <= longitudeSegments; longitude++) {
        const longitudeAngle = longitude / longitudeSegments * Math.PI * 2;
        const longitudeCosine = Math.cos(longitudeAngle);
        const longitudeSine = Math.sin(longitudeAngle);
        const unitX = latitudeCosine * longitudeCosine;
        const unitY = latitudeCosine * longitudeSine;
        const unitZ = latitudeSine;
        const localX = unitX * radiusX;
        const localY = unitY * radiusY;
        let normalX = unitX / radiusX;
        let normalY = unitY / radiusY;
        let normalZ = unitZ / radiusZ;
        const normalLength = Math.sqrt(
          normalX * normalX + normalY * normalY + normalZ * normalZ,
        );
        normalX /= normalLength;
        normalY /= normalLength;
        normalZ /= normalLength;
        const rotatedNormalX = normalX * rotationCosine - normalY * rotationSine;
        const rotatedNormalY = normalX * rotationSine + normalY * rotationCosine;

        writer.vertex(
          centerX + localX * rotationCosine - localY * rotationSine,
          centerY + localX * rotationSine + localY * rotationCosine,
          centerZ + unitZ * radiusZ,
          rotatedNormalX,
          rotatedNormalY,
          normalZ,
        );
      }
    }

    const ringVertexCount = longitudeSegments + 1;
    for (let latitude = 0; latitude < latitudeSegments; latitude++) {
      const currentRing = firstVertex + latitude * ringVertexCount;
      const nextRing = currentRing + ringVertexCount;
      for (let longitude = 0; longitude < longitudeSegments; longitude++) {
        const current = currentRing + longitude;
        const currentNext = current + 1;
        const next = nextRing + longitude;
        const nextNext = next + 1;
        writer.triangle(current, currentNext, next);
        writer.triangle(currentNext, nextNext, next);
      }
    }
  }
}
