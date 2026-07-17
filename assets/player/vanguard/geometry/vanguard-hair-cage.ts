import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import { VanguardMatteSurface } from './vanguard-surface';

/** 构建共享发际线和冠部壳体的一体化不规则碎发。 */
function createVanguardHairCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  const frontLeft = builder.vertex(-0.23, 3.68, 0.24, VanguardBone.Head);
  const frontCenter = builder.vertex(-0.015, 3.74, 0.255, VanguardBone.Head);
  const frontRight = builder.vertex(0.225, 3.69, 0.225, VanguardBone.Head);
  const rightTemple = builder.vertex(0.292, 3.61, 0.08, VanguardBone.Head);
  const backRight = builder.vertex(0.245, 3.66, -0.205, VanguardBone.Head);
  const backCenter = builder.vertex(0.02, 3.7, -0.245, VanguardBone.Head);
  const backLeft = builder.vertex(-0.255, 3.67, -0.2, VanguardBone.Head);
  const leftTemple = builder.vertex(-0.3, 3.6, 0.07, VanguardBone.Head);

  const crownFrontLeft = builder.vertex(-0.18, 3.85, 0.14, VanguardBone.Head);
  const crownFrontRight = builder.vertex(0.17, 3.86, 0.12, VanguardBone.Head);
  const crownRight = builder.vertex(0.245, 3.84, -0.04, VanguardBone.Head);
  const crownBackRight = builder.vertex(0.15, 3.87, -0.19, VanguardBone.Head);
  const crownBackLeft = builder.vertex(-0.17, 3.86, -0.2, VanguardBone.Head);
  const crownLeft = builder.vertex(-0.25, 3.83, -0.025, VanguardBone.Head);
  const topRidgeFront = builder.vertex(-0.045, 3.91, 0.08, VanguardBone.Head);
  const topRidgeBack = builder.vertex(0.05, 3.9, -0.12, VanguardBone.Head);

  builder.orientedQuad(VanguardMatteSurface.Hair, frontLeft, frontCenter, topRidgeFront, crownFrontLeft, 0, 0.5, 1, 0.012);
  builder.orientedQuad(VanguardMatteSurface.Hair, frontCenter, frontRight, crownFrontRight, topRidgeFront, 0, 0.5, 1, 0.014);
  builder.orientedQuad(VanguardMatteSurface.Hair, frontRight, rightTemple, crownRight, crownFrontRight, 1, 0.4, 0.4, 0.009);
  builder.orientedQuad(VanguardMatteSurface.Hair, rightTemple, backRight, crownBackRight, crownRight, 1, 0.35, -0.5, 0.008);
  builder.orientedQuad(VanguardMatteSurface.Hair, backRight, backCenter, topRidgeBack, crownBackRight, 0, 0.45, -1, 0.01);
  builder.orientedQuad(VanguardMatteSurface.Hair, backCenter, backLeft, crownBackLeft, topRidgeBack, 0, 0.45, -1, 0.011);
  builder.orientedQuad(VanguardMatteSurface.Hair, backLeft, leftTemple, crownLeft, crownBackLeft, -1, 0.4, -0.5, 0.009);
  builder.orientedQuad(VanguardMatteSurface.Hair, leftTemple, frontLeft, crownFrontLeft, crownLeft, -1, 0.4, 0.5, 0.01);
  builder.orientedQuad(VanguardMatteSurface.Hair, crownFrontLeft, topRidgeFront, topRidgeBack, crownBackLeft, -0.5, 1, 0, 0.009);
  builder.orientedQuad(VanguardMatteSurface.Hair, topRidgeFront, crownFrontRight, crownBackRight, topRidgeBack, 0.5, 1, 0, 0.011);
  builder.orientedQuad(VanguardMatteSurface.Hair, crownFrontRight, crownRight, crownBackRight, topRidgeBack, 0.7, 0.7, 0, 0.007);
  builder.orientedQuad(VanguardMatteSurface.Hair, crownBackLeft, topRidgeBack, crownBackRight, crownLeft, 0, 1, -0.5, 0.006);

  const sweptFringeLeft = builder.vertex(-0.14, 3.65, 0.285, VanguardBone.Head);
  const sweptFringeRight = builder.vertex(0.17, 3.67, 0.275, VanguardBone.Head);
  builder.orientedTriangle(VanguardMatteSurface.Hair, frontLeft, frontCenter, sweptFringeLeft, -0.4, 0.2, 1);
  builder.orientedTriangle(VanguardMatteSurface.Hair, frontCenter, frontRight, sweptFringeRight, 0.4, 0.2, 1);

  const leftSideburnTip = builder.vertex(-0.285, 3.43, 0.13, VanguardBone.Head);
  const rightSideburnTip = builder.vertex(0.275, 3.45, 0.125, VanguardBone.Head);
  builder.orientedTriangle(VanguardMatteSurface.Hair, frontLeft, leftTemple, leftSideburnTip, -1, 0, 0.5);
  builder.orientedTriangle(VanguardMatteSurface.Hair, rightTemple, frontRight, rightSideburnTip, 1, 0, 0.5);
  return builder.build();
}

/** 主角一体化发壳固定拓扑。 */
export const VANGUARD_HAIR_CAGE = createVanguardHairCage();
