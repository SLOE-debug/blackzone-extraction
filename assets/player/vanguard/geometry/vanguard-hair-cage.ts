import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import { VanguardMatteSurface } from './vanguard-surface';

/** 构建与头部连续短发搭配的下颌短须。 */
function createVanguardHairCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  addBeard(builder);
  return builder.build();
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
