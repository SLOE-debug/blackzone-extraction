import {
  appendIrregularTube,
  type BattlefieldEnvironmentTubeRing,
} from '../battlefield-environment-geometry-kernels';
import { BattlefieldEnvironmentMeshBuilder } from '../battlefield-environment-mesh-builder';
import { type BattlefieldEnvironmentMeshPlan } from '../battlefield-environment-mesh-plan';
import { environmentColor } from '../battlefield-environment-colors';

const CRYSTAL_DEEP = environmentColor(42, 94, 112);
const CRYSTAL_CORE = environmentColor(68, 212, 224);
const CRYSTAL_BRIGHT = environmentColor(136, 255, 238);
const ROCK_BASE = environmentColor(64, 69, 64);
const ROCK_MOSS = environmentColor(52, 83, 61);
const POOL_RIM = environmentColor(30, 48, 43);
const POOL_WATER = environmentColor(26, 110, 91);
const POOL_GLOW = environmentColor(48, 196, 142);

/** 编译多根倾斜尖晶、断裂副晶和不规则基座。 */
export function createCrystalClusterMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const builder = new BattlefieldEnvironmentMeshBuilder();
  appendRockMass(builder, 0, 0, 0, 1.25, 301, ROCK_BASE);
  appendCrystalShard(builder, -0.2, 0.38, 0.06, -0.35, 3.55, 0.18, 0.58, 313, CRYSTAL_CORE);
  appendCrystalShard(builder, 0.48, 0.28, -0.28, 0.82, 2.55, -0.5, 0.42, 331, CRYSTAL_BRIGHT);
  appendCrystalShard(builder, -0.58, 0.24, -0.36, -0.92, 2.05, -0.62, 0.36, 347, CRYSTAL_DEEP);
  appendCrystalShard(builder, 0.72, 0.22, 0.32, 1.04, 1.75, 0.58, 0.3, 359, CRYSTAL_CORE);
  return builder.build();
}

/** 编译多层非均匀轮廓和苔藓分面的岩体。 */
export function createRockFormationMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const builder = new BattlefieldEnvironmentMeshBuilder();
  appendRockMass(builder, 0, 0, 0, 1.45, 373, ROCK_BASE);
  appendIrregularTube(builder, ROCK_MOSS, Object.freeze([
    ring(-0.18, 0.72, 0.12, 0.82, 0.67, 0.12),
    ring(0.1, 1.48, -0.08, 0.66, 0.55, -0.07),
    ring(-0.12, 2.05, 0.18, 0.25, 0.21, 0.18),
  ]), 7, 389);
  return builder.build();
}

/** 编译带下沉边缘、碎裂岩圈和发光水面的腐化水洼。 */
export function createCorruptedPoolMeshPlan(): BattlefieldEnvironmentMeshPlan {
  const builder = new BattlefieldEnvironmentMeshBuilder();
  appendIrregularTube(builder, POOL_RIM, Object.freeze([
    ring(0, -0.05, 0, 3.2, 2.55, 0.08),
    ring(0.08, 0.08, -0.05, 3.35, 2.68, -0.04),
    ring(-0.04, 0.18, 0.07, 2.92, 2.28, 0.11),
  ]), 12, 401);
  appendIrregularTube(builder, POOL_WATER, Object.freeze([
    ring(-0.02, 0.13, 0.03, 2.85, 2.22, 0.08),
    ring(0.04, 0.17, -0.02, 2.72, 2.12, -0.02),
  ]), 12, 419);
  appendIrregularTube(builder, POOL_GLOW, Object.freeze([
    ring(0.65, 0.175, -0.22, 0.62, 0.36, 0.1),
    ring(0.68, 0.19, -0.2, 0.48, 0.28, -0.06),
  ]), 7, 431);
  appendIrregularTube(builder, POOL_GLOW, Object.freeze([
    ring(-0.9, 0.176, 0.5, 0.44, 0.3, -0.08),
    ring(-0.88, 0.192, 0.48, 0.32, 0.21, 0.12),
  ]), 6, 443);
  return builder.build();
}

function appendCrystalShard(
  builder: BattlefieldEnvironmentMeshBuilder,
  baseX: number,
  baseY: number,
  baseZ: number,
  tipX: number,
  tipY: number,
  tipZ: number,
  radius: number,
  seed: number,
  color: ReturnType<typeof environmentColor>,
): void {
  appendIrregularTube(builder, color, Object.freeze([
    ring(baseX, baseY, baseZ, radius, radius * 0.82, 0.08),
    ring(
      baseX + (tipX - baseX) * 0.62,
      baseY + (tipY - baseY) * 0.62,
      baseZ + (tipZ - baseZ) * 0.62,
      radius * 0.62,
      radius * 0.5,
      -0.06,
    ),
    ring(tipX, tipY, tipZ, 0.055, 0.045, 0.17),
  ]), 5, seed);
}

function appendRockMass(
  builder: BattlefieldEnvironmentMeshBuilder,
  x: number,
  y: number,
  z: number,
  radius: number,
  seed: number,
  color: ReturnType<typeof environmentColor>,
): void {
  appendIrregularTube(builder, color, Object.freeze([
    ring(x, y, z, radius * 0.78, radius * 0.68, 0.1),
    ring(x - radius * 0.12, y + radius * 0.48, z + radius * 0.06,
      radius, radius * 0.82, -0.06),
    ring(x + radius * 0.08, y + radius * 1.04, z - radius * 0.12,
      radius * 0.72, radius * 0.61, 0.14),
    ring(x - radius * 0.16, y + radius * 1.46, z + radius * 0.09,
      radius * 0.24, radius * 0.2, -0.08),
  ]), 7, seed);
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
