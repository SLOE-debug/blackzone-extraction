import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import { VanguardMatteSurface } from './vanguard-surface';

interface ScarfSection {
  readonly frontLeft: number;
  readonly frontRight: number;
  readonly backRight: number;
  readonly backLeft: number;
}

/** 构建有厚度领巾和两条长短不一的布面尾部。 */
function createVanguardScarfCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  addCollar(builder);
  addTail(builder, -1, VanguardBone.LeftScarfTail, true);
  addTail(builder, 1, VanguardBone.RightScarfTail, false);
  return builder.build();
}

/** 添加贴合颈肩轮廓、前部略下垂的厚领巾。 */
function addCollar(builder: VanguardCageBuilder): void {
  const upperFrontLeft = builder.vertex(-0.22, 3.055, 0.2, VanguardBone.Neck, VanguardBone.Head, 0.2);
  const upperFrontRight = builder.vertex(0.21, 3.05, 0.195, VanguardBone.Neck, VanguardBone.Head, 0.2);
  const upperBackRight = builder.vertex(0.2, 3.07, -0.15, VanguardBone.Neck, VanguardBone.Head, 0.2);
  const upperBackLeft = builder.vertex(-0.21, 3.07, -0.155, VanguardBone.Neck, VanguardBone.Head, 0.2);
  const lowerFrontLeft = builder.vertex(-0.27, 2.95, 0.23, VanguardBone.Neck, VanguardBone.Chest, 0.38);
  const lowerFrontRight = builder.vertex(0.26, 2.94, 0.225, VanguardBone.Neck, VanguardBone.Chest, 0.38);
  const lowerBackRight = builder.vertex(0.24, 2.98, -0.18, VanguardBone.Neck, VanguardBone.Chest, 0.38);
  const lowerBackLeft = builder.vertex(-0.25, 2.99, -0.185, VanguardBone.Neck, VanguardBone.Chest, 0.38);
  builder.orientedQuad(VanguardMatteSurface.Scarf, upperFrontLeft, upperFrontRight, lowerFrontRight, lowerFrontLeft, 0, 0, 1);
  builder.orientedQuad(VanguardMatteSurface.Scarf, upperFrontRight, upperBackRight, lowerBackRight, lowerFrontRight, 1, 0, 0, 0.006);
  builder.orientedQuad(VanguardMatteSurface.Scarf, upperBackRight, upperBackLeft, lowerBackLeft, lowerBackRight, 0, 0, -1, 0.006);
  builder.orientedQuad(VanguardMatteSurface.Scarf, upperBackLeft, upperFrontLeft, lowerFrontLeft, lowerBackLeft, -1, 0, 0, 0.006);
}

/** 添加一条由三段不等宽截面组成的连续围巾尾部。 */
function addTail(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  bone: VanguardBone,
  frontVisible: boolean,
): void {
  const root = addTailSection(builder, side, bone, 3.04, side * 0.12, frontVisible ? 0.205 : -0.12, 0.13, VanguardBone.Neck, 0.25);
  const middle = addTailSection(builder, side, bone, frontVisible ? 2.7 : 2.79, side * (frontVisible ? 0.28 : 0.24), frontVisible ? 0.245 : -0.16, frontVisible ? 0.16 : 0.12);
  const lower = addTailSection(builder, side, bone, frontVisible ? 2.38 : 2.58, side * (frontVisible ? 0.42 : 0.34), frontVisible ? 0.25 : -0.14, frontVisible ? 0.12 : 0.085);
  connectTailBand(builder, root, middle, side, frontVisible ? 0.012 : 0.007);
  connectTailBand(builder, middle, lower, side, frontVisible ? 0.015 : 0.008);
  const tip = builder.vertex(
    side * (frontVisible ? 0.49 : 0.39),
    frontVisible ? 2.23 : 2.48,
    frontVisible ? 0.23 : -0.12,
    bone,
  );
  builder.orientedTriangle(VanguardMatteSurface.Scarf, lower.frontLeft, lower.frontRight, tip, 0, -0.4, frontVisible ? 1 : -1);
  builder.orientedTriangle(VanguardMatteSurface.Scarf, lower.backRight, lower.backLeft, tip, 0, -0.4, frontVisible ? -1 : 1);
}

/** 添加围巾尾部一个具有真实厚度的不等宽截面。 */
function addTailSection(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  boneA: VanguardBone,
  y: number,
  centerX: number,
  centerZ: number,
  halfWidth: number,
  boneB: VanguardBone = boneA,
  weightB = 0,
): ScarfSection {
  const thickness = 0.026;
  return Object.freeze({
    frontLeft: builder.vertex(centerX - halfWidth, y, centerZ + thickness, boneA, boneB, weightB),
    frontRight: builder.vertex(centerX + halfWidth, y - side * 0.004, centerZ + thickness * 0.85, boneA, boneB, weightB),
    backRight: builder.vertex(centerX + halfWidth * 0.96, y, centerZ - thickness, boneA, boneB, weightB),
    backLeft: builder.vertex(centerX - halfWidth * 0.98, y + side * 0.003, centerZ - thickness, boneA, boneB, weightB),
  });
}

/** 连接围巾尾部的正反布面和两侧厚度面。 */
function connectTailBand(
  builder: VanguardCageBuilder,
  upper: Readonly<ScarfSection>,
  lower: Readonly<ScarfSection>,
  side: -1 | 1,
  ridge: number,
): void {
  builder.orientedQuad(VanguardMatteSurface.Scarf, upper.frontLeft, upper.frontRight, lower.frontRight, lower.frontLeft, 0, 0, 1, ridge);
  builder.orientedQuad(VanguardMatteSurface.Scarf, upper.backRight, upper.backLeft, lower.backLeft, lower.backRight, 0, 0, -1, ridge * 0.5);
  builder.orientedQuad(VanguardMatteSurface.Scarf, upper.backLeft, upper.frontLeft, lower.frontLeft, lower.backLeft, -side, 0, 0);
  builder.orientedQuad(VanguardMatteSurface.Scarf, upper.frontRight, upper.backRight, lower.backRight, lower.frontRight, side, 0, 0);
}

/** 主角红色围巾固定拓扑。 */
export const VANGUARD_SCARF_CAGE = createVanguardScarfCage();
