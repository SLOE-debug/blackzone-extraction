import { type UnlitColorBufferGeometry } from '../../../../../core/geometry/buffer-geometry';
import { VENOM_POOL_VERTEX_COUNT } from './venom-pool-geometry';

const TRIANGLE_VERTEX_COUNT = 3;
const QUAD_VERTEX_COUNT = 6;
const MOUND_SEGMENTS = 8;
const CRACK_COUNT = 3;
const CRACK_SEGMENTS = 2;
const SHARD_COUNT = 6;

type CocoonColor = readonly [number, number, number];

const COCOON_PALETTE = Object.freeze({
  center: Object.freeze([0x0b / 255, 0x1d / 255, 0x16 / 255] as const),
  body: Object.freeze([0x12 / 255, 0x30 / 255, 0x22 / 255] as const),
  edge: Object.freeze([0x1d / 255, 0x48 / 255, 0x30 / 255] as const),
});

/** 写入低多边形毒茧土包、三条裂纹与六块开裂甲壳。 */
export function writeVenomCocoonGeometry(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  cocoonOpen: number,
  lifecycleLegProgress: number,
  seed: number,
): void {
  const open = Math.max(0, Math.min(cocoonOpen, 1));
  const retiring = lifecycleLegProgress >= 0.999 && open < 0.999;
  const closedVisibility = retiring ? 0 : 1 - open;
  const moundRadius = radius * 0.72 * closedVisibility;
  const moundHeight = radius * 0.3 * closedVisibility;
  let cursor = writeMound(
    geometry,
    vertexOffset,
    x,
    y,
    moundRadius,
    moundHeight,
    seed,
  );
  cursor = writeCracks(
    geometry,
    cursor,
    x,
    y,
    radius,
    moundRadius,
    moundHeight,
    closedVisibility,
    seed,
  );
  cursor = writeShards(
    geometry,
    cursor,
    x,
    y,
    radius,
    open,
    retiring,
    seed,
  );
  while (cursor < vertexOffset + VENOM_POOL_VERTEX_COUNT) {
    writeVertex(geometry, cursor++, x, y, 0.065, COCOON_PALETTE.center, 0);
  }
}

function writeMound(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  height: number,
  seed: number,
): number {
  let cursor = vertexOffset;
  for (let segment = 0; segment < MOUND_SEGMENTS; segment++) {
    const next = (segment + 1) % MOUND_SEGMENTS;
    const radiusA = radius * calculateOuterVariation(segment, seed);
    const radiusB = radius * calculateOuterVariation(next, seed);
    const angleA = segment / MOUND_SEGMENTS * Math.PI * 2;
    const angleB = next / MOUND_SEGMENTS * Math.PI * 2;
    writeVertex(
      geometry,
      cursor,
      x + radius * 0.06,
      y - radius * 0.04,
      0.08 + height * (0.88 + segment % 3 * 0.045),
      segment % 2 === 0 ? COCOON_PALETTE.body : COCOON_PALETTE.edge,
      0.78,
    );
    writeVertex(
      geometry,
      cursor + 1,
      x + Math.cos(angleA) * radiusA,
      y + Math.sin(angleA) * radiusA,
      0.07,
      COCOON_PALETTE.center,
      0.74,
    );
    writeVertex(
      geometry,
      cursor + 2,
      x + Math.cos(angleB) * radiusB,
      y + Math.sin(angleB) * radiusB,
      0.07,
      COCOON_PALETTE.body,
      0.7,
    );
    cursor += TRIANGLE_VERTEX_COUNT;
  }
  return cursor;
}

function writeCracks(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  moundRadius: number,
  moundHeight: number,
  visibility: number,
  seed: number,
): number {
  let cursor = vertexOffset;
  for (let crack = 0; crack < CRACK_COUNT; crack++) {
    const angle = crack * 2.094395102 + seed * 0.17;
    for (let segment = 0; segment < CRACK_SEGMENTS; segment++) {
      const startDistance = moundRadius * (0.08 + segment * 0.26);
      const endDistance = moundRadius * (0.3 + segment * 0.28);
      const bend = (crack - 1) * 0.12 * segment;
      cursor = writeRaisedRibbonSegment(
        geometry,
        cursor,
        x + Math.cos(angle + bend) * startDistance,
        y + Math.sin(angle + bend) * startDistance,
        0.08 + moundHeight * (0.88 - segment * 0.27),
        x + Math.cos(angle + bend + 0.08) * endDistance,
        y + Math.sin(angle + bend + 0.08) * endDistance,
        0.08 + moundHeight * (0.6 - segment * 0.24),
        radius * 0.018 * visibility,
        COCOON_PALETTE.center,
        visibility * 0.9,
      );
    }
  }
  return cursor;
}

function writeShards(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  open: number,
  retiring: boolean,
  seed: number,
): number {
  let cursor = vertexOffset;
  const shardRadius = radius * 0.082 * open;
  const shardSink = retiring ? -(1 - open) * radius * 0.22 : 0;
  for (let shard = 0; shard < SHARD_COUNT; shard++) {
    const angle = shard * 1.047197551 + seed * 0.11;
    const spread = radius * (0.2 + open * (0.17 + shard % 2 * 0.035));
    const openingLift = retiring ? 0 : Math.sin(open * Math.PI) * radius * 0.13;
    cursor = writeTetrahedron(
      geometry,
      cursor,
      x + Math.cos(angle) * spread,
      y + Math.sin(angle) * spread,
      0.08 + shardSink + openingLift + (shard % 2) * radius * 0.018,
      shardRadius * (0.88 + shard % 3 * 0.08),
      shard % 2 === 0 ? COCOON_PALETTE.body : COCOON_PALETTE.edge,
      open * 0.82,
    );
  }
  return cursor;
}

function writeRaisedRibbonSegment(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  halfWidth: number,
  color: CocoonColor,
  brightness: number,
): number {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const inverseLength = 1 / Math.max(Math.hypot(deltaX, deltaY), 0.0001);
  const normalX = -deltaY * inverseLength * halfWidth;
  const normalY = deltaX * inverseLength * halfWidth;
  writeVertex(
    geometry, vertexOffset, startX + normalX, startY + normalY, startZ, color, brightness,
  );
  writeVertex(
    geometry, vertexOffset + 1, endX + normalX, endY + normalY, endZ, color, brightness,
  );
  writeVertex(
    geometry, vertexOffset + 2, endX - normalX, endY - normalY, endZ, color, brightness,
  );
  writeVertex(
    geometry, vertexOffset + 3, startX + normalX, startY + normalY, startZ, color, brightness,
  );
  writeVertex(
    geometry, vertexOffset + 4, endX - normalX, endY - normalY, endZ, color, brightness,
  );
  writeVertex(
    geometry, vertexOffset + 5, startX - normalX, startY - normalY, startZ, color, brightness,
  );
  return vertexOffset + QUAD_VERTEX_COUNT;
}

function writeTetrahedron(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  color: CocoonColor,
  brightness: number,
): number {
  const coordinates = [
    x, y, z + radius,
    x + radius, y, z - radius * 0.45,
    x - radius * 0.52, y + radius * 0.86, z - radius * 0.45,
    x - radius * 0.52, y - radius * 0.86, z - radius * 0.45,
  ] as const;
  const faces = [0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2] as const;
  for (let vertex = 0; vertex < faces.length; vertex++) {
    const source = (faces[vertex] ?? 0) * 3;
    writeVertex(
      geometry,
      vertexOffset + vertex,
      coordinates[source] ?? x,
      coordinates[source + 1] ?? y,
      coordinates[source + 2] ?? z,
      color,
      brightness * (0.82 + vertex % 3 * 0.08),
    );
  }
  return vertexOffset + faces.length;
}

function writeVertex(
  geometry: UnlitColorBufferGeometry,
  vertex: number,
  x: number,
  y: number,
  z: number,
  color: CocoonColor,
  brightness: number,
): void {
  const positionOffset = vertex * 3;
  geometry.positions[positionOffset] = x;
  geometry.positions[positionOffset + 1] = y;
  geometry.positions[positionOffset + 2] = z;
  const colorOffset = vertex * 4;
  geometry.colors[colorOffset] = color[0] * brightness;
  geometry.colors[colorOffset + 1] = color[1] * brightness;
  geometry.colors[colorOffset + 2] = color[2] * brightness;
  geometry.colors[colorOffset + 3] = 1;
}

function calculateOuterVariation(segment: number, seed: number): number {
  return 0.78 + ((segment * 5 + seed * 3) % 7) * 0.055;
}
