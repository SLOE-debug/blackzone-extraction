import { VanguardBone } from '../model/vanguard-bone';
import {
  VanguardCageBuilder,
  mergeVanguardCages,
  type VanguardCageDefinition,
} from './vanguard-cage';
import { VanguardMatteSurface } from './vanguard-surface';

/** 构建收窄眼窝、厚眉和克制嘴线的成熟面部颜色细节。 */
function createFaceDetailCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  addEye(builder, -1);
  addEye(builder, 1);

  const mouthUpperLeft = builder.vertex(-0.07, 3.352, 0.324, VanguardBone.Head);
  const mouthUpperRight = builder.vertex(0.068, 3.353, 0.323, VanguardBone.Head);
  const mouthLowerRight = builder.vertex(0.05, 3.337, 0.32, VanguardBone.Head);
  const mouthLowerLeft = builder.vertex(-0.052, 3.336, 0.321, VanguardBone.Head);
  builder.orientedQuad(
    VanguardMatteSurface.FaceDetail,
    mouthUpperLeft,
    mouthUpperRight,
    mouthLowerRight,
    mouthLowerLeft,
    0,
    0,
    1,
  );
  return builder.build();
}

/** 写入一只由凹陷眼面和独立眉折面组成的非球形眼部。 */
function addEye(builder: VanguardCageBuilder, side: -1 | 1): void {
  const centerX = side * 0.112;
  const innerX = side * 0.055;
  const outerX = side * 0.188;
  const upperInner = builder.vertex(innerX, 3.578, 0.3, VanguardBone.Head);
  const upperOuter = builder.vertex(outerX, 3.568, 0.282, VanguardBone.Head);
  const lowerOuter = builder.vertex(side * 0.178, 3.548, 0.286, VanguardBone.Head);
  const lowerInner = builder.vertex(centerX * 0.58, 3.552, 0.304, VanguardBone.Head);
  builder.orientedQuad(
    VanguardMatteSurface.FaceDetail,
    upperInner,
    upperOuter,
    lowerOuter,
    lowerInner,
    0,
    0,
    1,
    0.002,
  );
  const browInner = builder.vertex(side * 0.05, 3.625, 0.3, VanguardBone.Head);
  const browPeak = builder.vertex(centerX, 3.642, 0.294, VanguardBone.Head);
  const browOuter = builder.vertex(side * 0.215, 3.605, 0.266, VanguardBone.Head);
  builder.orientedTriangle(
    VanguardMatteSurface.FaceDetail,
    browInner,
    browPeak,
    browOuter,
    0,
    0,
    1,
  );
}

/** 构建衣摆与腰带等贴合人体语义的服装表面。 */
function createOutfitCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  addTabard(builder);
  addBelt(builder);
  addHarness(builder);
  return builder.build();
}

/** 添加沿窄腰向下展开、前后厚度不同的蓝色短袍衣摆。 */
function addTabard(builder: VanguardCageBuilder): void {
  const frontTopLeft = builder.vertex(-0.35, 2.08, 0.235, VanguardBone.Pelvis, VanguardBone.Chest, 0.48);
  const frontTopRight = builder.vertex(0.35, 2.08, 0.235, VanguardBone.Pelvis, VanguardBone.Chest, 0.48);
  const frontMidLeft = builder.vertex(-0.36, 1.77, 0.235, VanguardBone.Pelvis);
  const frontMidRight = builder.vertex(0.35, 1.76, 0.232, VanguardBone.Pelvis);
  const frontBottomLeft = builder.vertex(-0.42, 1.43, 0.225, VanguardBone.Pelvis);
  const frontBottomRight = builder.vertex(0.4, 1.45, 0.218, VanguardBone.Pelvis);
  const backTopLeft = builder.vertex(-0.34, 2.08, -0.175, VanguardBone.Pelvis, VanguardBone.Chest, 0.48);
  const backTopRight = builder.vertex(0.34, 2.08, -0.175, VanguardBone.Pelvis, VanguardBone.Chest, 0.48);
  const backMidLeft = builder.vertex(-0.35, 1.77, -0.175, VanguardBone.Pelvis);
  const backMidRight = builder.vertex(0.34, 1.76, -0.172, VanguardBone.Pelvis);
  const backBottomLeft = builder.vertex(-0.39, 1.44, -0.16, VanguardBone.Pelvis);
  const backBottomRight = builder.vertex(0.38, 1.46, -0.155, VanguardBone.Pelvis);

  builder.orientedQuad(VanguardMatteSurface.Tunic, frontTopLeft, frontTopRight, frontMidRight, frontMidLeft, 0, 0, 1, 0.014);
  builder.orientedQuad(VanguardMatteSurface.Tunic, frontMidLeft, frontMidRight, frontBottomRight, frontBottomLeft, 0, 0, 1, 0.018);
  builder.orientedQuad(VanguardMatteSurface.Tunic, backTopRight, backTopLeft, backMidLeft, backMidRight, 0, 0, -1, 0.007);
  builder.orientedQuad(VanguardMatteSurface.Tunic, backMidRight, backMidLeft, backBottomLeft, backBottomRight, 0, 0, -1, 0.008);
  builder.orientedQuad(VanguardMatteSurface.Tunic, backTopLeft, frontTopLeft, frontMidLeft, backMidLeft, -1, 0, 0, 0.005);
  builder.orientedQuad(VanguardMatteSurface.Tunic, frontTopRight, backTopRight, backMidRight, frontMidRight, 1, 0, 0, 0.005);
  builder.orientedQuad(VanguardMatteSurface.Tunic, backMidLeft, frontMidLeft, frontBottomLeft, backBottomLeft, -1, 0, 0, 0.006);
  builder.orientedQuad(VanguardMatteSurface.Tunic, frontMidRight, backMidRight, backBottomRight, frontBottomRight, 1, 0, 0, 0.006);
  builder.orientedQuad(VanguardMatteSurface.Tunic, frontBottomLeft, frontBottomRight, backBottomRight, backBottomLeft, 0, -1, 0, 0.004);
}

/** 添加贴合腰部多平面轮廓的棕色皮带。 */
function addBelt(builder: VanguardCageBuilder): void {
  const upperY = 2.08;
  const lowerY = 1.98;
  const upperFrontLeft = builder.vertex(-0.37, upperY, 0.245, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const upperFrontCenter = builder.vertex(0, upperY - 0.006, 0.255, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const upperFrontRight = builder.vertex(0.37, upperY, 0.242, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const upperBackRight = builder.vertex(0.36, upperY, -0.185, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const upperBackCenter = builder.vertex(0, upperY, -0.19, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const upperBackLeft = builder.vertex(-0.36, upperY, -0.188, VanguardBone.Pelvis, VanguardBone.Chest, 0.4);
  const lowerFrontLeft = builder.vertex(-0.375, lowerY, 0.247, VanguardBone.Pelvis);
  const lowerFrontCenter = builder.vertex(0.006, lowerY - 0.004, 0.26, VanguardBone.Pelvis);
  const lowerFrontRight = builder.vertex(0.375, lowerY, 0.244, VanguardBone.Pelvis);
  const lowerBackRight = builder.vertex(0.365, lowerY, -0.188, VanguardBone.Pelvis);
  const lowerBackCenter = builder.vertex(0, lowerY, -0.193, VanguardBone.Pelvis);
  const lowerBackLeft = builder.vertex(-0.365, lowerY, -0.19, VanguardBone.Pelvis);

  builder.orientedQuad(VanguardMatteSurface.Leather, lowerFrontLeft, lowerFrontCenter, upperFrontCenter, upperFrontLeft, 0, 0, 1, 0.004);
  builder.orientedQuad(VanguardMatteSurface.Leather, lowerFrontCenter, lowerFrontRight, upperFrontRight, upperFrontCenter, 0, 0, 1, 0.004);
  builder.orientedQuad(VanguardMatteSurface.Leather, lowerBackRight, lowerBackCenter, upperBackCenter, upperBackRight, 0, 0, -1);
  builder.orientedQuad(VanguardMatteSurface.Leather, lowerBackCenter, lowerBackLeft, upperBackLeft, upperBackCenter, 0, 0, -1);
  builder.orientedQuad(VanguardMatteSurface.Leather, lowerBackLeft, lowerFrontLeft, upperFrontLeft, upperBackLeft, -1, 0, 0);
  builder.orientedQuad(VanguardMatteSurface.Leather, lowerFrontRight, lowerBackRight, upperBackRight, upperFrontRight, 1, 0, 0);
}

/** 添加从左肩斜跨到右腰的双段皮革装备带。 */
function addHarness(builder: VanguardCageBuilder): void {
  const upperLeft = builder.vertex(-0.5, 2.83, 0.295, VanguardBone.Chest);
  const upperRight = builder.vertex(-0.39, 2.84, 0.3, VanguardBone.Chest);
  const middleLeft = builder.vertex(-0.09, 2.42, 0.298, VanguardBone.Chest);
  const middleRight = builder.vertex(0.025, 2.43, 0.302, VanguardBone.Chest);
  const lowerLeft = builder.vertex(0.23, 2.08, 0.278, VanguardBone.Pelvis, VanguardBone.Chest, 0.45);
  const lowerRight = builder.vertex(0.35, 2.085, 0.276, VanguardBone.Pelvis, VanguardBone.Chest, 0.45);
  builder.orientedQuad(VanguardMatteSurface.Leather, upperLeft, upperRight, middleRight, middleLeft, 0, 0, 1, 0.004);
  builder.orientedQuad(VanguardMatteSurface.Leather, middleLeft, middleRight, lowerRight, lowerLeft, 0, 0, 1, 0.004);
}

/** 面部与服装附属表面的合并固定拓扑。 */
export const VANGUARD_OUTFIT_CAGE = mergeVanguardCages(
  [createFaceDetailCage(), createOutfitCage()],
  VanguardMatteSurface.Count,
);
