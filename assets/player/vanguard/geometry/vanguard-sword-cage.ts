import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import { VanguardMetalSurface } from './vanguard-surface';

interface BladeSection {
  readonly frontRidge: number;
  readonly rightEdge: number;
  readonly backRidge: number;
  readonly leftEdge: number;
}

/** 构建具有中央脊线、收尖剑身、护手与黄铜扣件的金属拓扑。 */
function createVanguardSwordCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMetalSurface.Count);
  const base = addBladeSection(builder, 0.82, 1.38, 0.15, 0.105, 0.045);
  const upperMiddle = addBladeSection(builder, 0.89, 1.02, 0.18, 0.085, 0.042);
  const lowerMiddle = addBladeSection(builder, 0.96, 0.57, 0.215, 0.06, 0.034);
  connectBladeSections(builder, base, upperMiddle);
  connectBladeSections(builder, upperMiddle, lowerMiddle);
  const tip = builder.vertex(1.04, 0.16, 0.25, VanguardBone.Sword);
  builder.orientedTriangle(VanguardMetalSurface.Steel, lowerMiddle.frontRidge, lowerMiddle.rightEdge, tip, 0.7, -0.2, 0.7);
  builder.orientedTriangle(VanguardMetalSurface.Steel, lowerMiddle.rightEdge, lowerMiddle.backRidge, tip, 0.7, -0.2, -0.7);
  builder.orientedTriangle(VanguardMetalSurface.Steel, lowerMiddle.backRidge, lowerMiddle.leftEdge, tip, -0.7, -0.2, -0.7);
  builder.orientedTriangle(VanguardMetalSurface.Steel, lowerMiddle.leftEdge, lowerMiddle.frontRidge, tip, -0.7, -0.2, 0.7);
  addGuard(builder);
  addPommel(builder);
  addBuckle(builder);
  return builder.build();
}

/** 添加一个明确由左右刃口和前后脊线组成的剑身截面。 */
function addBladeSection(
  builder: VanguardCageBuilder,
  centerX: number,
  centerY: number,
  centerZ: number,
  halfWidth: number,
  ridgeDepth: number,
): BladeSection {
  return Object.freeze({
    frontRidge: builder.vertex(centerX, centerY, centerZ + ridgeDepth, VanguardBone.Sword),
    rightEdge: builder.vertex(centerX + halfWidth, centerY + 0.012, centerZ, VanguardBone.Sword),
    backRidge: builder.vertex(centerX, centerY, centerZ - ridgeDepth, VanguardBone.Sword),
    leftEdge: builder.vertex(centerX - halfWidth, centerY - 0.01, centerZ, VanguardBone.Sword),
  });
}

/** 连接两段剑身的四个脊面。 */
function connectBladeSections(
  builder: VanguardCageBuilder,
  upper: Readonly<BladeSection>,
  lower: Readonly<BladeSection>,
): void {
  builder.orientedQuad(VanguardMetalSurface.Steel, upper.frontRidge, upper.rightEdge, lower.rightEdge, lower.frontRidge, 0.7, 0, 0.7, 0.004);
  builder.orientedQuad(VanguardMetalSurface.Steel, upper.rightEdge, upper.backRidge, lower.backRidge, lower.rightEdge, 0.7, 0, -0.7, 0.003);
  builder.orientedQuad(VanguardMetalSurface.Steel, upper.backRidge, upper.leftEdge, lower.leftEdge, lower.backRidge, -0.7, 0, -0.7, 0.003);
  builder.orientedQuad(VanguardMetalSurface.Steel, upper.leftEdge, upper.frontRidge, lower.frontRidge, lower.leftEdge, -0.7, 0, 0.7, 0.004);
}

/** 添加向身体两侧不等长展开的护手。 */
function addGuard(builder: VanguardCageBuilder): void {
  const leftFront = builder.vertex(0.62, 1.42, 0.19, VanguardBone.Sword);
  const centerFront = builder.vertex(0.82, 1.39, 0.2, VanguardBone.Sword);
  const rightFront = builder.vertex(1, 1.34, 0.18, VanguardBone.Sword);
  const leftBack = builder.vertex(0.63, 1.41, 0.1, VanguardBone.Sword);
  const centerBack = builder.vertex(0.82, 1.38, 0.09, VanguardBone.Sword);
  const rightBack = builder.vertex(0.99, 1.33, 0.1, VanguardBone.Sword);
  builder.orientedQuad(VanguardMetalSurface.Steel, leftFront, centerFront, centerBack, leftBack, 0, 0, 1, 0.005);
  builder.orientedQuad(VanguardMetalSurface.Steel, centerFront, rightFront, rightBack, centerBack, 0, 0, 1, 0.004);
  builder.orientedQuad(VanguardMetalSurface.Steel, leftBack, centerBack, centerFront, leftFront, 0, 0, -1);
  builder.orientedQuad(VanguardMetalSurface.Steel, centerBack, rightBack, rightFront, centerFront, 0, 0, -1);
  builder.orientedQuad(VanguardMetalSurface.Steel, leftFront, leftBack, centerBack, centerFront, -1, 0, 0);
  builder.orientedQuad(VanguardMetalSurface.Steel, centerFront, centerBack, rightBack, rightFront, 1, 0, 0);
}

/** 添加手柄末端的不规则金属剑首。 */
function addPommel(builder: VanguardCageBuilder): void {
  const top = builder.vertex(0.73, 1.7, 0.13, VanguardBone.Sword);
  const front = builder.vertex(0.74, 1.65, 0.2, VanguardBone.Sword);
  const right = builder.vertex(0.8, 1.64, 0.13, VanguardBone.Sword);
  const back = builder.vertex(0.74, 1.65, 0.065, VanguardBone.Sword);
  const left = builder.vertex(0.68, 1.66, 0.13, VanguardBone.Sword);
  builder.orientedTriangle(VanguardMetalSurface.Brass, top, right, front, 0.6, 0.6, 0.6);
  builder.orientedTriangle(VanguardMetalSurface.Brass, top, back, right, 0.6, 0.6, -0.6);
  builder.orientedTriangle(VanguardMetalSurface.Brass, top, left, back, -0.6, 0.6, -0.6);
  builder.orientedTriangle(VanguardMetalSurface.Brass, top, front, left, -0.6, 0.6, 0.6);
}

/** 添加腰带正面的低面数黄铜扣件。 */
function addBuckle(builder: VanguardCageBuilder): void {
  const top = builder.vertex(0, 2.075, 0.282, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const right = builder.vertex(0.075, 2.03, 0.278, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const bottom = builder.vertex(0.005, 1.985, 0.284, VanguardBone.Pelvis);
  const left = builder.vertex(-0.073, 2.03, 0.28, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const center = builder.vertex(0.004, 2.03, 0.3, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  builder.orientedTriangle(VanguardMetalSurface.Brass, top, right, center, 0, 0, 1);
  builder.orientedTriangle(VanguardMetalSurface.Brass, right, bottom, center, 0, 0, 1);
  builder.orientedTriangle(VanguardMetalSurface.Brass, bottom, left, center, 0, 0, 1);
  builder.orientedTriangle(VanguardMetalSurface.Brass, left, top, center, 0, 0, 1);
}

/** 主角长剑与黄铜扣件固定拓扑。 */
export const VANGUARD_SWORD_CAGE = createVanguardSwordCage();
