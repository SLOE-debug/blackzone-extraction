import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import {
  createVanguardMantleControlBinding,
  type VanguardMantleControlBinding,
} from './vanguard-mantle-control-binding';
import {
  VANGUARD_MANTLE_HALF_THICKNESS,
  VANGUARD_MANTLE_PANELS,
  VANGUARD_MANTLE_REST_NORMALS,
  VANGUARD_MANTLE_TRIANGLES,
} from './vanguard-mantle-topology';
import {
  VANGUARD_MANTLE_PARTICLE_COUNT,
  VANGUARD_MANTLE_REST_X,
  VANGUARD_MANTLE_REST_Y,
  VANGUARD_MANTLE_REST_Z,
} from '../model/vanguard-mantle-particles';
import { VanguardMatteSurface } from './vanguard-surface';

interface MantlePoint {
  readonly x: number;
  readonly y: number;
  readonly frontZ: number;
  readonly backZ: number;
}

type TriangleIndices = readonly [number, number, number];

interface VanguardMantleCageBuildResult {
  readonly cage: VanguardCageDefinition;
  readonly binding: VanguardMantleControlBinding;
}

/** 构建肩颈短披、左侧长披风和右侧短披片组成的非对称荒原披风。 */
function createVanguardMantleCage(): VanguardMantleCageBuildResult {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  const controlVertices: number[] = [];
  const particleIndices: number[] = [];
  const normalOffsets: number[] = [];
  addRaisedCollar(builder);
  addShoulderWrap(builder);
  addSimulatedPanels(
    builder,
    controlVertices,
    particleIndices,
    normalOffsets,
  );
  return Object.freeze({
    cage: builder.build(),
    binding: createVanguardMantleControlBinding(
      controlVertices,
      particleIndices,
      normalOffsets,
    ),
  });
}

/** 添加贴近下颌、向外翻折的厚领口。 */
function addRaisedCollar(builder: VanguardCageBuilder): void {
  const upperFrontLeft = builder.vertex(-0.25, 3.13, 0.205, VanguardBone.Neck, VanguardBone.Head, 0.22);
  const upperFrontRight = builder.vertex(0.24, 3.125, 0.2, VanguardBone.Neck, VanguardBone.Head, 0.22);
  const upperBackRight = builder.vertex(0.23, 3.14, -0.16, VanguardBone.Neck, VanguardBone.Head, 0.22);
  const upperBackLeft = builder.vertex(-0.24, 3.145, -0.165, VanguardBone.Neck, VanguardBone.Head, 0.22);
  const lowerFrontLeft = builder.vertex(-0.38, 3.035, 0.26, VanguardBone.Chest, VanguardBone.Neck, 0.35);
  const lowerFrontRight = builder.vertex(0.4, 3.03, 0.255, VanguardBone.Chest, VanguardBone.Neck, 0.35);
  const lowerBackRight = builder.vertex(0.37, 3.045, -0.205, VanguardBone.Chest, VanguardBone.Neck, 0.35);
  const lowerBackLeft = builder.vertex(-0.37, 3.05, -0.21, VanguardBone.Chest, VanguardBone.Neck, 0.35);

  builder.orientedQuad(VanguardMatteSurface.Mantle, upperFrontLeft, upperFrontRight, lowerFrontRight, lowerFrontLeft, 0, 0.4, 1, 0.014);
  builder.orientedQuad(VanguardMatteSurface.Mantle, upperFrontRight, upperBackRight, lowerBackRight, lowerFrontRight, 1, 0.2, 0, 0.009);
  builder.orientedQuad(VanguardMatteSurface.Mantle, upperBackRight, upperBackLeft, lowerBackLeft, lowerBackRight, 0, 0.2, -1, 0.009);
  builder.orientedQuad(VanguardMatteSurface.Mantle, upperBackLeft, upperFrontLeft, lowerFrontLeft, lowerBackLeft, -1, 0.2, 0, 0.011);
}

/** 添加三层前后错开的梯形布带，形成真实缠绕肩颈的披巾层次。 */
function addShoulderWrap(builder: VanguardCageBuilder): void {
  addTrapezoidBand(builder, Object.freeze([
    point(-0.34, 3.1, 0.285, -0.205),
    point(0.36, 3.09, 0.28, -0.2),
    point(0.64, 2.91, 0.255, -0.19),
    point(-0.62, 2.93, 0.26, -0.195),
  ]));
  addTrapezoidBand(builder, Object.freeze([
    point(-0.7, 2.94, 0.3, -0.205),
    point(0.74, 2.91, 0.29, -0.2),
    point(0.58, 2.73, 0.315, -0.215),
    point(-0.72, 2.71, 0.31, -0.22),
  ]));
  addTrapezoidBand(builder, Object.freeze([
    point(-0.74, 2.75, 0.325, -0.225),
    point(0.61, 2.73, 0.315, -0.22),
    point(0.38, 2.62, 0.34, -0.235),
    point(-0.56, 2.6, 0.345, -0.24),
  ]));
}

function addTrapezoidBand(
  builder: VanguardCageBuilder,
  points: readonly MantlePoint[],
): void {
  addThickPanel(
    builder,
    points,
    Object.freeze([triangle(0, 1, 2), triangle(0, 2, 3)]),
    Object.freeze([0, 1, 2, 3]),
  );
}

/** 添加共享中面粒子、具有正反厚度且保持固定拓扑的自由披片。 */
function addSimulatedPanels(
  builder: VanguardCageBuilder,
  controlVertices: number[],
  particleIndices: number[],
  normalOffsets: number[],
): void {
  const front = new Array<number>(VANGUARD_MANTLE_PARTICLE_COUNT);
  const back = new Array<number>(VANGUARD_MANTLE_PARTICLE_COUNT);
  for (let particle = 0; particle < VANGUARD_MANTLE_PARTICLE_COUNT; particle++) {
    front[particle] = addSimulatedControlVertex(
      builder,
      particle,
      VANGUARD_MANTLE_HALF_THICKNESS,
      controlVertices,
      particleIndices,
      normalOffsets,
    );
    back[particle] = addSimulatedControlVertex(
      builder,
      particle,
      -VANGUARD_MANTLE_HALF_THICKNESS,
      controlVertices,
      particleIndices,
      normalOffsets,
    );
  }
  for (const panel of VANGUARD_MANTLE_PANELS) {
    const triangleEnd = panel.triangleStart + panel.triangleCount;
    for (let triangle = panel.triangleStart; triangle < triangleEnd; triangle++) {
      const triangleOffset = triangle * 3;
      const a = VANGUARD_MANTLE_TRIANGLES[triangleOffset] ?? 0;
      const b = VANGUARD_MANTLE_TRIANGLES[triangleOffset + 1] ?? 0;
      const c = VANGUARD_MANTLE_TRIANGLES[triangleOffset + 2] ?? 0;
      builder.orientedTriangle(
        VanguardMatteSurface.Mantle,
        front[a] ?? 0,
        front[b] ?? 0,
        front[c] ?? 0,
        0,
        0.1,
        1,
      );
      builder.orientedTriangle(
        VanguardMatteSurface.Mantle,
        back[c] ?? 0,
        back[b] ?? 0,
        back[a] ?? 0,
        0,
        0.1,
        -1,
      );
    }
    for (let edge = 0; edge < panel.boundary.length; edge++) {
      const current = panel.boundary[edge] ?? 0;
      const next = panel.boundary[(edge + 1) % panel.boundary.length] ?? 0;
      const outwardX = ((VANGUARD_MANTLE_REST_X[current] ?? 0)
        + (VANGUARD_MANTLE_REST_X[next] ?? 0)) * 0.5 - panel.centerX;
      const outwardY = ((VANGUARD_MANTLE_REST_Y[current] ?? 0)
        + (VANGUARD_MANTLE_REST_Y[next] ?? 0)) * 0.5 - panel.centerY;
      builder.orientedQuad(
        VanguardMatteSurface.Mantle,
        front[current] ?? 0,
        back[current] ?? 0,
        back[next] ?? 0,
        front[next] ?? 0,
        outwardX,
        outwardY,
        0,
        0.003,
      );
    }
  }
}

function addSimulatedControlVertex(
  builder: VanguardCageBuilder,
  particle: number,
  normalOffset: number,
  controlVertices: number[],
  particleIndices: number[],
  normalOffsets: number[],
): number {
  const controlVertex = builder.resolvedVertex(
    (VANGUARD_MANTLE_REST_X[particle] ?? 0)
      + (VANGUARD_MANTLE_REST_NORMALS.x[particle] ?? 0) * normalOffset,
    (VANGUARD_MANTLE_REST_Y[particle] ?? 0)
      + (VANGUARD_MANTLE_REST_NORMALS.y[particle] ?? 0) * normalOffset,
    (VANGUARD_MANTLE_REST_Z[particle] ?? 0)
      + (VANGUARD_MANTLE_REST_NORMALS.z[particle] ?? 1) * normalOffset,
    VanguardBone.Chest,
  );
  controlVertices.push(controlVertex);
  particleIndices.push(particle);
  normalOffsets.push(normalOffset);
  return controlVertex;
}

/** 按显式三角切分生成前后布面，并沿给定外轮廓封闭厚度。 */
function addThickPanel(
  builder: VanguardCageBuilder,
  points: readonly MantlePoint[],
  triangles: readonly TriangleIndices[],
  boundary: readonly number[],
): void {
  const front = points.map((panelPoint) => builder.vertex(
    panelPoint.x,
    panelPoint.y,
    panelPoint.frontZ,
    VanguardBone.Chest,
  ));
  const back = points.map((panelPoint) => builder.vertex(
    panelPoint.x * 0.99,
    panelPoint.y + 0.01,
    panelPoint.backZ,
    VanguardBone.Chest,
  ));
  for (const [a, b, c] of triangles) {
    builder.orientedTriangle(
      VanguardMatteSurface.Mantle,
      front[a] ?? 0,
      front[b] ?? 0,
      front[c] ?? 0,
      0,
      0.1,
      1,
    );
    builder.orientedTriangle(
      VanguardMatteSurface.Mantle,
      back[c] ?? 0,
      back[b] ?? 0,
      back[a] ?? 0,
      0,
      0.1,
      -1,
    );
  }
  for (let index = 0; index < boundary.length; index++) {
    const next = (index + 1) % boundary.length;
    const currentVertex = boundary[index];
    const nextVertex = boundary[next];
    if (currentVertex === undefined || nextVertex === undefined) {
      throw new Error('披风厚面边界索引不存在。');
    }
    const currentPoint = points[currentVertex];
    const nextPoint = points[nextVertex];
    if (currentPoint === undefined || nextPoint === undefined) {
      throw new Error('披风厚面边界点不存在。');
    }
    builder.orientedQuad(
      VanguardMatteSurface.Mantle,
      front[currentVertex] ?? 0,
      back[currentVertex] ?? 0,
      back[nextVertex] ?? 0,
      front[nextVertex] ?? 0,
      currentPoint.x + nextPoint.x,
      currentPoint.y + nextPoint.y - 5.2,
      0,
      0.003,
    );
  }
}

function point(x: number, y: number, frontZ: number, backZ: number): MantlePoint {
  return Object.freeze({ x, y, frontZ, backZ });
}

function triangle(a: number, b: number, c: number): TriangleIndices {
  return Object.freeze([a, b, c]);
}

const VANGUARD_MANTLE_BUILD = createVanguardMantleCage();

/** 主角分层非对称荒原披风固定拓扑。 */
export const VANGUARD_MANTLE_CAGE = VANGUARD_MANTLE_BUILD.cage;

/** 自由披片在独立披风控制笼中的局部覆盖关系。 */
export const VANGUARD_MANTLE_LOCAL_CONTROL_BINDING = VANGUARD_MANTLE_BUILD.binding;
