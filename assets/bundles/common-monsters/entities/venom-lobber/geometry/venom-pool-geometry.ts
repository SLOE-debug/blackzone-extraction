import { type UnlitColorBufferGeometry } from '../../../../../core/geometry/buffer-geometry';

export const VENOM_POOL_OUTER_SEGMENTS = 18;
export const VENOM_POOL_VEIN_COUNT = 3;
export const VENOM_POOL_BUBBLE_COUNT = 4;

const VEIN_SEGMENTS = 2;
const TRIANGLE_VERTEX_COUNT = 3;
const QUAD_VERTEX_COUNT = 6;
const BUBBLE_FACE_COUNT = 4;
const SURFACE_VERTEX_COUNT = VENOM_POOL_OUTER_SEGMENTS * TRIANGLE_VERTEX_COUNT;
const VEIN_VERTEX_COUNT = VENOM_POOL_VEIN_COUNT * VEIN_SEGMENTS * QUAD_VERTEX_COUNT;
const BUBBLE_VERTEX_COUNT = VENOM_POOL_BUBBLE_COUNT
  * BUBBLE_FACE_COUNT
  * TRIANGLE_VERTEX_COUNT;

export const VENOM_POOL_VERTEX_COUNT = SURFACE_VERTEX_COUNT
  + VEIN_VERTEX_COUNT
  + BUBBLE_VERTEX_COUNT;

const OUTER_COSINES = createUnitCircle(VENOM_POOL_OUTER_SEGMENTS, true);
const OUTER_SINES = createUnitCircle(VENOM_POOL_OUTER_SEGMENTS, false);
const LANDING_IMPACT_SECONDS = 0.12;
const LANDING_SPREAD_SECONDS = 0.32;
const RETIRE_SECONDS = 0.7;

interface VenomPoolPalette {
  readonly center: readonly [number, number, number];
  readonly body: readonly [number, number, number];
  readonly edge: readonly [number, number, number];
  readonly vein: readonly [number, number, number];
  readonly bubble: readonly [number, number, number];
}

const NORMAL_PALETTE: VenomPoolPalette = Object.freeze({
  center: Object.freeze([0x12 / 255, 0x38 / 255, 0x2a / 255]),
  body: Object.freeze([0x1c / 255, 0x59 / 255, 0x36 / 255]),
  edge: Object.freeze([0x32 / 255, 0x7a / 255, 0x48 / 255]),
  vein: Object.freeze([0x58 / 255, 0xa8 / 255, 0x66 / 255]),
  bubble: Object.freeze([0x74 / 255, 0xc7 / 255, 0x78 / 255]),
});

const CATALYZED_PALETTE: VenomPoolPalette = Object.freeze({
  center: Object.freeze([0x35 / 255, 0x45 / 255, 0x1d / 255]),
  body: Object.freeze([0x68 / 255, 0x74 / 255, 0x2a / 255]),
  edge: Object.freeze([0xa5 / 255, 0xa5 / 255, 0x3c / 255]),
  vein: Object.freeze([0xd2 / 255, 0xc8 / 255, 0x5a / 255]),
  bubble: Object.freeze([0xe0 / 255, 0xd8 / 255, 0x6a / 255]),
});

const DEATH_PALETTE: VenomPoolPalette = Object.freeze({
  center: Object.freeze([0x0b / 255, 0x1d / 255, 0x16 / 255]),
  body: Object.freeze([0x12 / 255, 0x30 / 255, 0x22 / 255]),
  edge: Object.freeze([0x1d / 255, 0x48 / 255, 0x30 / 255]),
  vein: Object.freeze([0x2e / 255, 0x64 / 255, 0x3d / 255]),
  bubble: Object.freeze([0x58 / 255, 0xa8 / 255, 0x66 / 255]),
});

/** 把一块三层不规则腐蚀液面写入固定 Effect 槽位。 */
export function writeVenomPoolGeometry(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  elapsed: number,
  duration: number,
  catalyzed: boolean,
  seed: number,
): void {
  const safeDuration = Math.max(duration, 0.001);
  const remaining = Math.max(0, safeDuration - elapsed);
  const landingScale = calculateLandingScale(elapsed);
  const retireScale = remaining < RETIRE_SECONDS
    ? smoothStep(remaining / RETIRE_SECONDS)
    : 1;
  const visibleRadius = radius * landingScale * retireScale;
  const brightness = 0.38 + retireScale * 0.62;
  const palette = catalyzed ? CATALYZED_PALETTE : NORMAL_PALETTE;
  let cursor = writeSurface(
    geometry,
    vertexOffset,
    x,
    y,
    visibleRadius,
    brightness,
    palette,
    seed,
  );
  cursor = writeVeins(
    geometry,
    cursor,
    x,
    y,
    visibleRadius,
    elapsed,
    brightness,
    palette,
    seed,
  );
  writeBubbles(
    geometry,
    cursor,
    x,
    y,
    visibleRadius,
    elapsed,
    brightness,
    palette,
    seed,
  );
}

/** 写入出生前 0.12 秒暗斑扩张与随后 0.2 秒三条裂纹展开。 */
export function writeVenomSpawnResidueGeometry(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  elapsed: number,
  seed: number,
): void {
  const stainProgress = smoothStep(Math.min(1, elapsed / 0.12));
  const settleProgress = smoothStep(Math.max(0, Math.min(1, (elapsed - 1.05) / 0.55)));
  const veinProgress = smoothStep(Math.max(0, Math.min(1, (elapsed - 0.12) / 0.2)))
    * (1 - settleProgress);
  const visibleRadius = radius * (0.08 + stainProgress * 0.92) * (1 - settleProgress * 0.78);
  let cursor = writeSurface(
    geometry,
    vertexOffset,
    x,
    y,
    visibleRadius,
    0.52,
    NORMAL_PALETTE,
    seed,
  );
  cursor = writeVeins(
    geometry,
    cursor,
    x,
    y,
    visibleRadius * veinProgress,
    elapsed,
    0.56 * veinProgress,
    NORMAL_PALETTE,
    seed,
  );
  while (cursor < vertexOffset + VENOM_POOL_VERTEX_COUNT) {
    writeVertex(geometry, cursor++, x, y, 0.065, NORMAL_PALETTE.center, 0);
  }
}

/** 写入五枚分面飞溅与主体消失后额外保留的无伤害暗色残迹。 */
export function writeVenomDeathResidueGeometry(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  heading: number,
  scale: number,
  elapsed: number,
  duration: number,
): void {
  const remaining = Math.max(0, duration - elapsed);
  const fade = smoothStep(Math.min(1, remaining / 1.2));
  const retireScale = remaining < 1.2 ? smoothStep(remaining / 1.2) : 1;
  const stainProgress = smoothStep(Math.max(0, Math.min(1, (elapsed - 0.68) / 0.4)));
  let cursor = writeSurface(
    geometry,
    vertexOffset,
    x,
    y,
    scale * (0.12 + stainProgress * 2.18) * retireScale,
    fade * 0.62,
    DEATH_PALETTE,
    29,
  );
  for (let droplet = 0; droplet < 5; droplet++) {
    const angle = heading + droplet * 1.256637061 + 0.23;
    const dropletProgress = Math.max(0, Math.min(1, (elapsed - 0.68) / 0.4));
    const travel = scale * (1.4 + droplet * 0.31) * dropletProgress;
    const lift = Math.sin(dropletProgress * Math.PI)
      * scale * (1.5 + droplet * 0.17);
    cursor = writeTetrahedron(
      geometry,
      cursor,
      x + Math.cos(angle) * travel,
      y + Math.sin(angle) * travel,
      0.07 + lift,
      scale * (0.11 + droplet * 0.012) * fade * (dropletProgress > 0 ? 1 : 0),
      DEATH_PALETTE.bubble,
      fade,
    );
  }
  while (cursor < vertexOffset + VENOM_POOL_VERTEX_COUNT) {
    writeVertex(geometry, cursor++, x, y, 0.062, DEATH_PALETTE.center, fade * 0.4);
  }
}

function writeSurface(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  brightness: number,
  palette: VenomPoolPalette,
  seed: number,
): number {
  let cursor = vertexOffset;
  for (let segment = 0; segment < VENOM_POOL_OUTER_SEGMENTS; segment++) {
    const next = (segment + 1) % VENOM_POOL_OUTER_SEGMENTS;
    const radiusA = radius * calculateOuterVariation(segment, seed);
    const radiusB = radius * calculateOuterVariation(next, seed);
    writeVertex(geometry, cursor, x, y, 0.064, palette.center, brightness);
    writeVertex(
      geometry,
      cursor + 1,
      x + (OUTER_COSINES[segment] ?? 1) * radiusA,
      y + (OUTER_SINES[segment] ?? 0) * radiusA,
      0.068 + ((segment + seed) % 3) * 0.002,
      palette.edge,
      brightness,
    );
    writeVertex(
      geometry,
      cursor + 2,
      x + (OUTER_COSINES[next] ?? 1) * radiusB,
      y + (OUTER_SINES[next] ?? 0) * radiusB,
      0.068 + ((next + seed) % 3) * 0.002,
      palette.body,
      brightness,
    );
    cursor += TRIANGLE_VERTEX_COUNT;
  }
  return cursor;
}

function writeVeins(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  elapsed: number,
  brightness: number,
  palette: VenomPoolPalette,
  seed: number,
): number {
  let cursor = vertexOffset;
  const pulse = 0.76 + Math.sin(elapsed * 2.4) * 0.12;
  for (let vein = 0; vein < VENOM_POOL_VEIN_COUNT; vein++) {
    const angle = (vein * 2.094395102 + seed * 0.731) % (Math.PI * 2);
    const bend = ((seed + vein * 7) % 5 - 2) * 0.08;
    for (let segment = 0; segment < VEIN_SEGMENTS; segment++) {
      const start = 0.2 + segment * 0.29;
      const end = start + 0.22;
      const width = radius * (0.034 - segment * 0.006);
      const angleA = angle + bend * segment;
      const angleB = angle + bend * (segment + 1);
      cursor = writeRibbonSegment(
        geometry,
        cursor,
        x + Math.cos(angleA) * radius * start,
        y + Math.sin(angleA) * radius * start,
        x + Math.cos(angleB) * radius * end,
        y + Math.sin(angleB) * radius * end,
        width,
        palette.vein,
        brightness * pulse,
      );
    }
  }
  return cursor;
}

function writeBubbles(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  radius: number,
  elapsed: number,
  brightness: number,
  palette: VenomPoolPalette,
  seed: number,
): void {
  let cursor = vertexOffset;
  for (let bubble = 0; bubble < VENOM_POOL_BUBBLE_COUNT; bubble++) {
    const angle = bubble * 1.570796327 + seed * 0.417;
    const radial = radius * (0.22 + ((seed + bubble * 3) % 5) * 0.075);
    const phase = elapsed * 2.7 + bubble * 1.63 + seed * 0.19;
    const rise = 0.5 + Math.sin(phase) * 0.5;
    const bubbleRadius = radius * (0.045 + bubble * 0.004) * (0.42 + rise * 0.58);
    cursor = writeTetrahedron(
      geometry,
      cursor,
      x + Math.cos(angle) * radial,
      y + Math.sin(angle) * radial,
      0.074 + rise * bubbleRadius * 0.78,
      bubbleRadius,
      palette.bubble,
      brightness * (0.72 + rise * 0.28),
    );
  }
}

function writeRibbonSegment(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  halfWidth: number,
  color: readonly [number, number, number],
  brightness: number,
): number {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const inverseLength = 1 / Math.max(Math.hypot(deltaX, deltaY), 0.0001);
  const normalX = -deltaY * inverseLength * halfWidth;
  const normalY = deltaX * inverseLength * halfWidth;
  writeVertex(geometry, vertexOffset, startX + normalX, startY + normalY, 0.079, color, brightness);
  writeVertex(geometry, vertexOffset + 1, endX + normalX, endY + normalY, 0.079, color, brightness);
  writeVertex(geometry, vertexOffset + 2, endX - normalX, endY - normalY, 0.079, color, brightness);
  writeVertex(geometry, vertexOffset + 3, startX + normalX, startY + normalY, 0.079, color, brightness);
  writeVertex(geometry, vertexOffset + 4, endX - normalX, endY - normalY, 0.079, color, brightness);
  writeVertex(geometry, vertexOffset + 5, startX - normalX, startY - normalY, 0.079, color, brightness);
  return vertexOffset + QUAD_VERTEX_COUNT;
}

function writeTetrahedron(
  geometry: UnlitColorBufferGeometry,
  vertexOffset: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  color: readonly [number, number, number],
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
      brightness * (0.82 + (vertex % 3) * 0.08),
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
  color: readonly [number, number, number],
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

function calculateLandingScale(elapsed: number): number {
  if (elapsed <= LANDING_IMPACT_SECONDS) {
    return 0.08 + smoothStep(elapsed / LANDING_IMPACT_SECONDS) * 0.34;
  }
  if (elapsed >= LANDING_SPREAD_SECONDS) {
    return 1;
  }
  const progress = (elapsed - LANDING_IMPACT_SECONDS)
    / (LANDING_SPREAD_SECONDS - LANDING_IMPACT_SECONDS);
  return 0.42 + smoothStep(progress) * 0.58;
}

function calculateOuterVariation(segment: number, seed: number): number {
  return 0.78 + ((segment * 5 + seed * 3) % 7) * 0.055;
}

function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(value, 1));
  return clamped * clamped * (3 - clamped * 2);
}

function createUnitCircle(segments: number, cosine: boolean): Float32Array {
  const values = new Float32Array(segments);
  for (let index = 0; index < segments; index++) {
    const angle = index / segments * Math.PI * 2;
    values[index] = cosine ? Math.cos(angle) : Math.sin(angle);
  }
  return values;
}
