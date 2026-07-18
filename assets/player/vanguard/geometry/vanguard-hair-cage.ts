import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import { VanguardMatteSurface } from './vanguard-surface';

/** 构建被宽檐帽压住的侧发、后发与沿下颌生长的一体式短须。 */
function createVanguardHairCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  addHairLocks(builder);
  addBeard(builder);
  return builder.build();
}

/** 添加从帽檐下方露出的不对称发束，避免再次形成圆润童帽头。 */
function addHairLocks(builder: VanguardCageBuilder): void {
  const fringeLeft = builder.vertex(-0.22, 3.735, 0.225, VanguardBone.Head);
  const fringeCenter = builder.vertex(-0.025, 3.74, 0.245, VanguardBone.Head);
  const fringeTip = builder.vertex(-0.11, 3.64, 0.29, VanguardBone.Head);
  const fringeRight = builder.vertex(0.19, 3.73, 0.215, VanguardBone.Head);
  const rightFringeTip = builder.vertex(0.14, 3.66, 0.275, VanguardBone.Head);
  builder.orientedTriangle(VanguardMatteSurface.Hair, fringeLeft, fringeCenter, fringeTip, 0, 0.3, 1);
  builder.orientedTriangle(VanguardMatteSurface.Hair, fringeCenter, fringeRight, rightFringeTip, 0, 0.3, 1);

  const leftTopFront = builder.vertex(-0.25, 3.72, 0.15, VanguardBone.Head);
  const leftTopBack = builder.vertex(-0.29, 3.7, -0.08, VanguardBone.Head);
  const leftLowerBack = builder.vertex(-0.28, 3.48, -0.02, VanguardBone.Head);
  const leftLowerFront = builder.vertex(-0.245, 3.42, 0.13, VanguardBone.Head);
  builder.orientedQuad(VanguardMatteSurface.Hair, leftTopFront, leftTopBack, leftLowerBack, leftLowerFront, -1, 0, 0.2, 0.008);

  const rightTopFront = builder.vertex(0.25, 3.715, 0.145, VanguardBone.Head);
  const rightTopBack = builder.vertex(0.29, 3.69, -0.09, VanguardBone.Head);
  const rightLowerBack = builder.vertex(0.275, 3.5, -0.025, VanguardBone.Head);
  const rightLowerFront = builder.vertex(0.245, 3.44, 0.125, VanguardBone.Head);
  builder.orientedQuad(VanguardMatteSurface.Hair, rightTopBack, rightTopFront, rightLowerFront, rightLowerBack, 1, 0, 0.2, 0.008);

  const backTopLeft = builder.vertex(-0.27, 3.71, -0.12, VanguardBone.Head);
  const backTopCenter = builder.vertex(0.015, 3.735, -0.235, VanguardBone.Head);
  const backTopRight = builder.vertex(0.28, 3.7, -0.13, VanguardBone.Head);
  const backLowerLeft = builder.vertex(-0.23, 3.47, -0.16, VanguardBone.Head);
  const backLowerCenter = builder.vertex(0.01, 3.43, -0.19, VanguardBone.Head);
  const backLowerRight = builder.vertex(0.225, 3.48, -0.165, VanguardBone.Head);
  builder.orientedQuad(VanguardMatteSurface.Hair, backTopLeft, backTopCenter, backLowerCenter, backLowerLeft, -0.3, 0, -1, 0.009);
  builder.orientedQuad(VanguardMatteSurface.Hair, backTopCenter, backTopRight, backLowerRight, backLowerCenter, 0.3, 0, -1, 0.009);
}

/** 用连续颧侧、下颌和下巴面形成厚实胡须，而不是零散贴片。 */
function addBeard(builder: VanguardCageBuilder): void {
  const leftUpper = builder.vertex(-0.215, 3.425, 0.286, VanguardBone.Head);
  const leftMouth = builder.vertex(-0.105, 3.375, 0.318, VanguardBone.Head);
  const leftJaw = builder.vertex(-0.205, 3.315, 0.286, VanguardBone.Head);
  const leftChin = builder.vertex(-0.085, 3.255, 0.304, VanguardBone.Head);
  const rightUpper = builder.vertex(0.21, 3.422, 0.284, VanguardBone.Head);
  const rightMouth = builder.vertex(0.102, 3.377, 0.316, VanguardBone.Head);
  const rightJaw = builder.vertex(0.202, 3.312, 0.284, VanguardBone.Head);
  const rightChin = builder.vertex(0.082, 3.255, 0.302, VanguardBone.Head);
  const chinBottom = builder.vertex(-0.006, 3.215, 0.306, VanguardBone.Head);

  builder.orientedTriangle(VanguardMatteSurface.FacialHair, leftUpper, leftMouth, leftJaw, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, leftMouth, leftChin, leftJaw, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, rightMouth, rightUpper, rightJaw, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, rightChin, rightMouth, rightJaw, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, leftJaw, leftChin, chinBottom, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, leftChin, rightChin, chinBottom, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, rightChin, rightJaw, chinBottom, 0, 0, 1);

  const mustacheLeft = builder.vertex(-0.125, 3.397, 0.32, VanguardBone.Head);
  const mustacheCenter = builder.vertex(-0.004, 3.41, 0.335, VanguardBone.Head);
  const mustacheLeftLower = builder.vertex(-0.025, 3.38, 0.326, VanguardBone.Head);
  const mustacheRight = builder.vertex(0.12, 3.399, 0.318, VanguardBone.Head);
  const mustacheRightLower = builder.vertex(0.022, 3.38, 0.325, VanguardBone.Head);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, mustacheLeft, mustacheCenter, mustacheLeftLower, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.FacialHair, mustacheCenter, mustacheRight, mustacheRightLower, 0, 0, 1);
}

/** 主角帽下发束与成熟胡须固定拓扑。 */
export const VANGUARD_HAIR_CAGE = createVanguardHairCage();
