import {
  appendFacetedBlade,
  appendIrregularTube,
  HORIZONTAL_TUBE_BASIS,
  type BattlefieldEnvironmentTubeRing,
} from '../battlefield-environment-geometry-kernels';
import {
  BattlefieldEnvironmentMeshBuilder,
  type BattlefieldEnvironmentPoint,
} from '../battlefield-environment-mesh-builder';
import { type BattlefieldEnvironmentMeshPlan } from '../battlefield-environment-mesh-plan';
import { environmentColor } from '../battlefield-environment-colors';

const TREE_BARK = environmentColor(58, 43, 34);
const TREE_BARK_DARK = environmentColor(35, 31, 27);
const TREE_CANOPY = environmentColor(33, 61, 43);
const TREE_CANOPY_DARK = environmentColor(20, 39, 31);
const MUSHROOM_STEM = environmentColor(116, 135, 112);
const MUSHROOM_CAP = environmentColor(64, 218, 172);
const MUSHROOM_GILL = environmentColor(38, 108, 91);
const GLOW_STALK = environmentColor(41, 112, 83);
const GLOW_LEAF = environmentColor(54, 190, 116);
const GLOW_BULB = environmentColor(102, 255, 180);
const NEST_ROOT = environmentColor(43, 31, 27);
const NEST_CANOPY = environmentColor(19, 49, 35);
const NEST_CANOPY_HIGHLIGHT = environmentColor(33, 75, 49);
const NEST_CANOPY_DARK = environmentColor(12, 31, 25);

/** 编译枯死弯曲树干、错位枝条和三簇不规则树冠。 */
export function createDeadTreeMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const builder = new BattlefieldEnvironmentMeshBuilder();
  appendIrregularTube(builder, TREE_BARK, Object.freeze([
    ring(0, 0, 0, 0.55, 0.48, 0.08),
    ring(0.08, 1.45, -0.03, 0.48, 0.42, -0.04),
    ring(-0.12, 3.05, 0.1, 0.39, 0.34, 0.12),
    ring(0.18, 4.55, -0.08, 0.27, 0.24, -0.08),
    ring(0.38, 5.85, 0.16, 0.09, 0.075, 0.18),
  ]), 6, 11);
  appendBranch(builder, -0.15, 3.15, 0.05, -1.2, 4.65, 0.45, 31);
  appendBranch(builder, 0.05, 3.75, -0.02, 1.35, 5.05, -0.55, 47);
  appendBranch(builder, 0.2, 4.55, 0.08, -0.62, 5.82, -0.85, 59);
  appendCanopy(builder, -1.18, 4.92, 0.48, 1.35, 71, TREE_CANOPY_DARK);
  appendCanopy(builder, 1.38, 5.32, -0.52, 1.55, 83, TREE_CANOPY);
  appendCanopy(builder, 0.02, 6.18, 0.1, 1.7, 97, TREE_CANOPY);
  return builder.build();
}

/** 编译弯曲菌柄、厚实菌褶和低段数发光菌盖。 */
export function createLuminousMushroomMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const builder = new BattlefieldEnvironmentMeshBuilder();
  appendIrregularTube(builder, MUSHROOM_STEM, Object.freeze([
    ring(0, 0, 0, 0.28, 0.24, 0),
    ring(0.05, 0.65, -0.03, 0.24, 0.21, 0.11),
    ring(-0.04, 1.35, 0.07, 0.19, 0.17, -0.08),
    ring(0.08, 1.82, 0.02, 0.14, 0.13, 0.17),
  ]), 6, 121);
  appendIrregularTube(builder, MUSHROOM_GILL, Object.freeze([
    ring(0.08, 1.67, 0.02, 0.72, 0.64, 0.08),
    ring(0.04, 1.86, 0.01, 1.08, 0.94, -0.02),
    ring(-0.02, 2.15, 0.03, 1.22, 1.05, 0.12),
  ]), 9, 137);
  appendIrregularTube(builder, MUSHROOM_CAP, Object.freeze([
    ring(-0.02, 2.02, 0.03, 1.18, 1.02, 0.12),
    ring(0.03, 2.35, -0.02, 0.92, 0.82, -0.04),
    ring(-0.08, 2.62, 0.06, 0.22, 0.2, 0.18),
  ]), 9, 149);
  return builder.build();
}

/** 编译多株发光嫩枝、分面叶片和不规则荧光球苞。 */
export function createGlowPlantMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const builder = new BattlefieldEnvironmentMeshBuilder();
  appendGlowStem(builder, 0, 0, 0, -0.12, 1.55, 0.08, 173);
  appendGlowStem(builder, -0.22, 0, 0.06, -0.72, 1.08, 0.18, 181);
  appendGlowStem(builder, 0.18, 0, -0.08, 0.68, 1.22, -0.26, 193);
  appendLeaf(builder, -0.08, 0.46, 0.02, -0.8, 0.82, 0.34);
  appendLeaf(builder, 0.05, 0.68, -0.03, 0.82, 0.92, -0.32);
  appendLeaf(builder, -0.02, 0.88, 0.02, -0.48, 1.18, -0.58);
  appendBulb(builder, -0.12, 1.66, 0.08, 0.32, 211);
  appendBulb(builder, -0.74, 1.18, 0.2, 0.25, 223);
  appendBulb(builder, 0.7, 1.31, -0.28, 0.28, 227);
  return builder.build();
}

/**
 * 编译完全闭合的多层密林巢穴。
 *
 * 三重双面树冠壳覆盖侧面、顶部和内部观察方向，怪物可以穿过几何向外出现，
 * 玩家则由独立圆形占地阻止进入。
 */
export function createMonsterNestMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const builder = new BattlefieldEnvironmentMeshBuilder();
  appendNestCanopy(builder, 6.8, 0.03, 12, 251, NEST_CANOPY);
  appendNestCanopy(builder, 4.45, 0.48, 10, 269, NEST_CANOPY_HIGHLIGHT);
  appendNestCanopy(builder, 2.35, 0.72, 8, 283, NEST_CANOPY_DARK);
  for (let trunk = 0; trunk < 12; trunk++) {
    const angle = trunk / 12 * Math.PI * 2 + (trunk % 2) * 0.08;
    const radius = 5.65 + Math.sin(trunk * 2.4) * 0.36;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const leanX = Math.cos(angle) * -0.55 + Math.sin(angle * 2.1) * 0.22;
    const leanZ = Math.sin(angle) * -0.55 + Math.cos(angle * 1.7) * 0.22;
    appendIrregularTube(builder, trunk % 3 === 0 ? TREE_BARK : NEST_ROOT, Object.freeze([
      ring(x, 0, z, 0.48, 0.42, angle),
      ring(x + leanX * 0.2, 2.2, z + leanZ * 0.2, 0.39, 0.34, angle + 0.08),
      ring(x + leanX * 0.58, 4.65, z + leanZ * 0.58, 0.27, 0.24, angle - 0.07),
      ring(x + leanX, 6.85, z + leanZ, 0.08, 0.07, angle + 0.14),
    ]), 6, 307 + trunk * 13);
  }
  for (let root = 0; root < 10; root++) {
    const angle = root / 10 * Math.PI * 2 + 0.14;
    const innerX = Math.cos(angle) * 4.8;
    const innerZ = Math.sin(angle) * 4.8;
    const outerX = Math.cos(angle) * 7.45;
    const outerZ = Math.sin(angle) * 7.45;
    appendFacetedBlade(
      builder,
      NEST_ROOT,
      point(innerX - Math.sin(angle) * 0.28, 0.04, innerZ + Math.cos(angle) * 0.28),
      point(innerX + Math.sin(angle) * 0.28, 0.04, innerZ - Math.cos(angle) * 0.28),
      point(outerX, 0.12, outerZ),
      point((innerX + outerX) * 0.5, 0.58, (innerZ + outerZ) * 0.5),
    );
  }
  return builder.build();
}

function appendBranch(
  builder: BattlefieldEnvironmentMeshBuilder,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  seed: number,
): void {
  appendIrregularTube(builder, TREE_BARK_DARK, Object.freeze([
    ring(startX, startY, startZ, 0.25, 0.22, 0),
    ring((startX + endX) * 0.52, (startY + endY) * 0.52, (startZ + endZ) * 0.52,
      0.16, 0.14, 0.12),
    ring(endX, endY, endZ, 0.055, 0.045, -0.08),
  ]), 5, seed);
}

function appendCanopy(
  builder: BattlefieldEnvironmentMeshBuilder,
  x: number,
  y: number,
  z: number,
  radius: number,
  seed: number,
  color: ReturnType<typeof environmentColor>,
): void {
  appendIrregularTube(builder, color, Object.freeze([
    ring(x, y - radius * 0.55, z, radius * 0.52, radius * 0.46, 0.08),
    ring(x + radius * 0.08, y, z - radius * 0.04, radius, radius * 0.82, -0.06),
    ring(x - radius * 0.12, y + radius * 0.56, z + radius * 0.08,
      radius * 0.42, radius * 0.36, 0.15),
  ]), 7, seed);
}

function appendGlowStem(
  builder: BattlefieldEnvironmentMeshBuilder,
  x: number,
  y: number,
  z: number,
  endX: number,
  endY: number,
  endZ: number,
  seed: number,
): void {
  appendIrregularTube(builder, GLOW_STALK, Object.freeze([
    ring(x, y, z, 0.09, 0.075, 0),
    ring((x + endX) * 0.55, endY * 0.55, (z + endZ) * 0.55, 0.065, 0.055, 0.1),
    ring(endX, endY, endZ, 0.035, 0.03, -0.08),
  ]), 5, seed);
}

function appendLeaf(
  builder: BattlefieldEnvironmentMeshBuilder,
  rootX: number,
  rootY: number,
  rootZ: number,
  tipX: number,
  tipY: number,
  tipZ: number,
): void {
  appendFacetedBlade(
    builder,
    GLOW_LEAF,
    point(rootX - 0.08, rootY, rootZ),
    point(rootX + 0.08, rootY + 0.02, rootZ),
    point((rootX + tipX) * 0.55, (rootY + tipY) * 0.55 + 0.1, (rootZ + tipZ) * 0.55),
    point(tipX, tipY, tipZ),
  );
}

function appendBulb(
  builder: BattlefieldEnvironmentMeshBuilder,
  x: number,
  y: number,
  z: number,
  radius: number,
  seed: number,
): void {
  appendIrregularTube(builder, GLOW_BULB, Object.freeze([
    ring(x, y - radius * 0.7, z, radius * 0.35, radius * 0.3, 0),
    ring(x + radius * 0.08, y, z - radius * 0.06, radius, radius * 0.88, 0.13),
    ring(x - radius * 0.1, y + radius * 0.72, z + radius * 0.07,
      radius * 0.16, radius * 0.14, -0.08),
  ]), 6, seed);
}

function appendNestCanopy(
  builder: BattlefieldEnvironmentMeshBuilder,
  radius: number,
  baseY: number,
  segments: number,
  seed: number,
  color: ReturnType<typeof environmentColor>,
): void {
  const rings: readonly BattlefieldEnvironmentTubeRing[] = Object.freeze([
    ring(0, baseY, 0, radius * 0.94, radius, 0.02),
    ring(0.18, 2.75, -0.12, radius * 1.04, radius * 0.98, -0.07),
    ring(-0.24, 5.65, 0.18, radius * 0.9, radius * 0.86, 0.11),
    ring(0.12, 7.75, -0.08, radius * 0.52, radius * 0.48, -0.12),
    ring(-0.06, 8.85, 0.04, radius * 0.08, radius * 0.075, 0.2),
  ]);
  appendIrregularTube(
    builder,
    color,
    rings,
    segments,
    seed,
    HORIZONTAL_TUBE_BASIS,
    true,
  );
}

function ring(
  x: number,
  y: number,
  z: number,
  radiusU: number,
  radiusV: number,
  rotation: number,
): BattlefieldEnvironmentTubeRing {
  return Object.freeze({ x, y, z, radiusU, radiusV, rotation });
}

function point(x: number, y: number, z: number): BattlefieldEnvironmentPoint {
  return Object.freeze({ x, y, z });
}
