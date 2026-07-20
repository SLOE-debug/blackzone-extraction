import { VanguardBone } from '../model/vanguard-bone';
import { VanguardCageBuilder, type VanguardCageDefinition } from './vanguard-cage';
import { VanguardMatteSurface } from './vanguard-surface';

interface TorsoRow {
  readonly frontLeft: number;
  readonly frontCenter: number;
  readonly frontRight: number;
  readonly backRight: number;
  readonly backCenter: number;
  readonly backLeft: number;
}

interface LimbSection {
  readonly front: number;
  readonly outer: number;
  readonly back: number;
  readonly inner: number;
}

/** 构建肩胯连续、具有明确面部结构的正面人类主体拓扑笼。 */
function createVanguardBodyCage(): VanguardCageDefinition {
  const builder = new VanguardCageBuilder(VanguardMatteSurface.Count);
  const torso = addTorso(builder);
  addHead(builder, torso.neck);
  addArm(builder, -1, torso.shoulder, torso.chest);
  addArm(builder, 1, torso.shoulder, torso.chest);
  addLegPair(builder, torso.pelvis);
  return builder.build();
}

/** 写入由骨盆、窄腰、胸腔、肩峰和领口组成的连续衣着躯干。 */
function addTorso(builder: VanguardCageBuilder): Readonly<{
  pelvis: TorsoRow;
  chest: TorsoRow;
  shoulder: TorsoRow;
  neck: TorsoRow;
}> {
  const pelvis = addTorsoRow(builder, 1.53, 0.43, 0.205, -0.17, VanguardBone.Pelvis);
  const hip = addTorsoRow(builder, 1.74, 0.46, 0.225, -0.19, VanguardBone.Pelvis);
  const waist = addTorsoRow(
    builder, 2.04, 0.34, 0.2, -0.16,
    VanguardBone.Pelvis, VanguardBone.SpineLower, 0.82,
  );
  const ribs = addTorsoRow(
    builder, 2.4, 0.5, 0.25, -0.195,
    VanguardBone.SpineLower, VanguardBone.Chest, 0.88,
  );
  const chest = addTorsoRow(builder, 2.68, 0.58, 0.275, -0.215, VanguardBone.Chest);
  const shoulder = addTorsoRow(
    builder, 2.86, 0.68, 0.235, -0.195,
    VanguardBone.Chest, VanguardBone.Neck, 0.12,
  );
  const neck = addTorsoRow(
    builder, 3.05, 0.2, 0.16, -0.14,
    VanguardBone.Chest, VanguardBone.Neck, 0.72,
  );

  connectTorsoBand(builder, pelvis, hip, VanguardMatteSurface.Pants, 0.006);
  connectTorsoBand(builder, hip, waist, VanguardMatteSurface.Tunic, 0.012);
  connectTorsoBand(builder, waist, ribs, VanguardMatteSurface.Tunic, 0.016);
  connectTorsoBand(builder, ribs, chest, VanguardMatteSurface.Tunic, 0.018);
  connectTorsoBand(builder, chest, shoulder, VanguardMatteSurface.Tunic, 0.014);
  connectTorsoBand(builder, shoulder, neck, VanguardMatteSurface.Tunic, 0.008);
  return Object.freeze({ pelvis, chest, shoulder, neck });
}

/** 添加一排具有正面中脊、背部中线和不完全镜像轮廓的躯干顶点。 */
function addTorsoRow(
  builder: VanguardCageBuilder,
  y: number,
  halfWidth: number,
  frontDepth: number,
  backDepth: number,
  boneA: VanguardBone,
  boneB: VanguardBone = boneA,
  weightB = 0,
): TorsoRow {
  return Object.freeze({
    frontLeft: builder.vertex(-halfWidth, y + 0.004, frontDepth * 0.84, boneA, boneB, weightB),
    frontCenter: builder.vertex(-0.008, y, frontDepth, boneA, boneB, weightB),
    frontRight: builder.vertex(halfWidth * 0.985, y - 0.003, frontDepth * 0.88, boneA, boneB, weightB),
    backRight: builder.vertex(halfWidth * 0.97, y, backDepth * 0.9, boneA, boneB, weightB),
    backCenter: builder.vertex(0.01, y + 0.003, backDepth, boneA, boneB, weightB),
    backLeft: builder.vertex(-halfWidth * 0.99, y - 0.002, backDepth * 0.93, boneA, boneB, weightB),
  });
}

/** 连接相邻躯干轮廓，形成前胸、后背和左右侧面的有意图分面。 */
function connectTorsoBand(
  builder: VanguardCageBuilder,
  lower: Readonly<TorsoRow>,
  upper: Readonly<TorsoRow>,
  surface: VanguardMatteSurface,
  ridge: number,
  connectSides = true,
): void {
  builder.orientedQuad(surface, lower.frontLeft, lower.frontCenter, upper.frontCenter, upper.frontLeft, 0, 0, 1, ridge);
  builder.orientedQuad(surface, lower.frontCenter, lower.frontRight, upper.frontRight, upper.frontCenter, 0, 0, 1, ridge * 0.82);
  builder.orientedQuad(surface, lower.backRight, lower.backCenter, upper.backCenter, upper.backRight, 0, 0, -1, ridge * 0.45);
  builder.orientedQuad(surface, lower.backCenter, lower.backLeft, upper.backLeft, upper.backCenter, 0, 0, -1, ridge * 0.5);
  if (connectSides) {
    builder.orientedQuad(surface, lower.backLeft, lower.frontLeft, upper.frontLeft, upper.backLeft, -1, 0, 0, ridge * 0.35);
    builder.orientedQuad(surface, lower.frontRight, lower.backRight, upper.backRight, upper.frontRight, 1, 0, 0, ridge * 0.35);
  }
}

/** 写入颈部、下颌、面部、颅骨、鼻部和耳朵的一体化低面数头部。 */
function addHead(builder: VanguardCageBuilder, neckBase: Readonly<TorsoRow>): void {
  const neckTop = addNeck(builder, neckBase);

  const jaw = addJawRow(builder);
  const cheek = addHeadRow(builder, 3.43, 0.27, 0.225, -0.19, 0.292, 0.025);
  const brow = addHeadRow(builder, 3.59, 0.248, 0.23, -0.205, 0.29, -0.012);
  const forehead = addHeadRow(builder, 3.71, 0.215, 0.185, -0.19, 0.218, -0.04);
  const crown = addHeadRow(builder, 3.79, 0.16, 0.105, -0.145, 0.122, -0.05);

  connectNeckToHead(builder, neckTop, jaw);
  connectHeadBand(builder, jaw, cheek, 0.008);
  connectScalpTransitionBand(builder, cheek, brow, 0.012, false);
  connectScalpTransitionBand(builder, brow, forehead, 0.008, true);
  connectTorsoBand(
    builder,
    forehead,
    crown,
    VanguardMatteSurface.Hair,
    0.004,
  );

  const crownTop = builder.vertex(0.008, 3.83, -0.018, VanguardBone.Head);
  builder.orientedTriangle(VanguardMatteSurface.Hair, crown.frontLeft, crown.frontCenter, crownTop, 0, 1, 0.5);
  builder.orientedTriangle(VanguardMatteSurface.Hair, crown.frontCenter, crown.frontRight, crownTop, 0, 1, 0.5);
  builder.orientedTriangle(VanguardMatteSurface.Hair, crown.frontRight, crown.backRight, crownTop, 0.6, 1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Hair, crown.backRight, crown.backCenter, crownTop, 0, 1, -0.5);
  builder.orientedTriangle(VanguardMatteSurface.Hair, crown.backCenter, crown.backLeft, crownTop, 0, 1, -0.5);
  builder.orientedTriangle(VanguardMatteSurface.Hair, crown.backLeft, crown.frontLeft, crownTop, -0.6, 1, 0);

  addNose(builder, cheek, brow);
  addEar(builder, -1, cheek, brow);
  addEar(builder, 1, cheek, brow);
}

/**
 * 使用前喉中脊、左右胸锁乳突面与背侧平面连接锁骨和下颌。
 */
function addNeck(
  builder: VanguardCageBuilder,
  neckBase: Readonly<TorsoRow>,
): TorsoRow {
  const upper = addTorsoRow(
    builder,
    3.19,
    0.145,
    0.17,
    -0.105,
    VanguardBone.Neck,
    VanguardBone.Head,
    0.32,
  );
  connectTorsoBand(builder, neckBase, upper, VanguardMatteSurface.NeckSkin, 0);
  return upper;
}

/** 把六个颈部解剖平面展开到下颌轮廓，不插入环形截面或封口。 */
function connectNeckToHead(
  builder: VanguardCageBuilder,
  neck: Readonly<TorsoRow>,
  jaw: Readonly<TorsoRow>,
): void {
  connectTorsoBand(builder, neck, jaw, VanguardMatteSurface.NeckSkin, 0);
}

/** 添加下巴低于左右下颌角的人脸底边，消除水平盒状头颈接缝。 */
function addJawRow(builder: VanguardCageBuilder): TorsoRow {
  return Object.freeze({
    frontLeft: builder.vertex(-0.245, 3.31, 0.215, VanguardBone.Head),
    frontCenter: builder.vertex(-0.004, 3.27, 0.268, VanguardBone.Head),
    frontRight: builder.vertex(0.24, 3.305, 0.211, VanguardBone.Head),
    backRight: builder.vertex(0.23, 3.3, -0.15, VanguardBone.Head),
    backCenter: builder.vertex(0.008, 3.292, -0.165, VanguardBone.Head),
    backLeft: builder.vertex(-0.235, 3.302, -0.155, VanguardBone.Head),
  });
}

/** 添加比躯干更明确的前额、脸颊和后脑中心深度。 */
function addHeadRow(
  builder: VanguardCageBuilder,
  y: number,
  halfWidth: number,
  frontSideDepth: number,
  backDepth: number,
  frontCenterDepth: number,
  centerX: number,
): TorsoRow {
  return Object.freeze({
    frontLeft: builder.vertex(-halfWidth, y, frontSideDepth, VanguardBone.Head),
    frontCenter: builder.vertex(centerX, y + 0.003, frontCenterDepth, VanguardBone.Head),
    frontRight: builder.vertex(halfWidth * 0.98, y - 0.002, frontSideDepth * 0.98, VanguardBone.Head),
    backRight: builder.vertex(halfWidth * 0.96, y, backDepth * 0.92, VanguardBone.Head),
    backCenter: builder.vertex(0.008, y, backDepth, VanguardBone.Head),
    backLeft: builder.vertex(-halfWidth * 0.98, y + 0.002, backDepth * 0.95, VanguardBone.Head),
  });
}

/** 连接头部相邻高度，同时让脸颊和眉骨保持清晰折面。 */
function connectHeadBand(
  builder: VanguardCageBuilder,
  lower: Readonly<TorsoRow>,
  upper: Readonly<TorsoRow>,
  ridge: number,
  connectSides = true,
): void {
  connectTorsoBand(
    builder,
    lower,
    upper,
    VanguardMatteSurface.Skin,
    ridge,
    connectSides,
  );
}

/** 让前额保持皮肤，同时把双侧与后脑连续过渡到头发语义。 */
function connectScalpTransitionBand(
  builder: VanguardCageBuilder,
  lower: Readonly<TorsoRow>,
  upper: Readonly<TorsoRow>,
  ridge: number,
  connectSides: boolean,
): void {
  builder.orientedQuad(VanguardMatteSurface.Skin, lower.frontLeft, lower.frontCenter, upper.frontCenter, upper.frontLeft, 0, 0, 1, ridge);
  builder.orientedQuad(VanguardMatteSurface.Skin, lower.frontCenter, lower.frontRight, upper.frontRight, upper.frontCenter, 0, 0, 1, ridge * 0.82);
  builder.orientedQuad(VanguardMatteSurface.Hair, lower.backRight, lower.backCenter, upper.backCenter, upper.backRight, 0, 0, -1, ridge * 0.45);
  builder.orientedQuad(VanguardMatteSurface.Hair, lower.backCenter, lower.backLeft, upper.backLeft, upper.backCenter, 0, 0, -1, ridge * 0.5);
  if (connectSides) {
    builder.orientedQuad(VanguardMatteSurface.Hair, lower.backLeft, lower.frontLeft, upper.frontLeft, upper.backLeft, -1, 0, 0, ridge * 0.35);
    builder.orientedQuad(VanguardMatteSurface.Hair, lower.frontRight, lower.backRight, upper.backRight, upper.frontRight, 1, 0, 0, ridge * 0.35);
  }
}

/** 用共享眉心与脸颊锚点形成鼻梁、鼻尖和鼻翼，而不是附加球体。 */
function addNose(
  builder: VanguardCageBuilder,
  cheek: Readonly<TorsoRow>,
  brow: Readonly<TorsoRow>,
): void {
  const tip = builder.vertex(-0.004, 3.495, 0.397, VanguardBone.Head);
  const baseLeft = builder.vertex(-0.074, 3.425, 0.307, VanguardBone.Head);
  const baseRight = builder.vertex(0.07, 3.425, 0.304, VanguardBone.Head);
  builder.orientedTriangle(VanguardMatteSurface.Skin, brow.frontCenter, baseLeft, tip, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.Skin, brow.frontCenter, tip, baseRight, 0, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.Skin, baseLeft, baseRight, tip, 0, -0.25, 1);
  builder.orientedTriangle(VanguardMatteSurface.Skin, cheek.frontCenter, baseRight, baseLeft, 0, -0.25, 1);
}

/** 用共享颅骨四边界与双脊点构成无开放接缝的低面数耳廓。 */
function addEar(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  cheek: Readonly<TorsoRow>,
  brow: Readonly<TorsoRow>,
): void {
  const upperFront = side < 0 ? brow.frontLeft : brow.frontRight;
  const upperBack = side < 0 ? brow.backLeft : brow.backRight;
  const lowerBack = side < 0 ? cheek.backLeft : cheek.backRight;
  const lowerFront = side < 0 ? cheek.frontLeft : cheek.frontRight;
  const upperRidge = builder.vertex(side * 0.32, 3.535, 0.025, VanguardBone.Head);
  const lowerRidge = builder.vertex(side * 0.315, 3.455, 0.04, VanguardBone.Head);

  builder.orientedTriangle(VanguardMatteSurface.Skin, upperFront, upperBack, upperRidge, side, 0, 0);
  builder.orientedTriangle(VanguardMatteSurface.Skin, upperBack, lowerRidge, upperRidge, side, 0, 0);
  builder.orientedTriangle(VanguardMatteSurface.Skin, upperBack, lowerBack, lowerRidge, side, 0, 0);
  builder.orientedTriangle(VanguardMatteSurface.Skin, lowerBack, lowerFront, lowerRidge, side, 0, 0);
  builder.orientedTriangle(VanguardMatteSurface.Skin, lowerFront, upperRidge, lowerRidge, side, 0, 0);
  builder.orientedTriangle(VanguardMatteSurface.Skin, lowerFront, upperFront, upperRidge, side, 0, 0);
}

/** 写入一侧从肩峰连续延伸到带拇指手掌的手臂拓扑。 */
function addArm(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  shoulderRow: Readonly<TorsoRow>,
  chestRow: Readonly<TorsoRow>,
): void {
  const upperBone = side < 0 ? VanguardBone.LeftUpperArm : VanguardBone.RightUpperArm;
  const forearmBone = side < 0 ? VanguardBone.LeftForearm : VanguardBone.RightForearm;
  const handBone = side < 0 ? VanguardBone.LeftHand : VanguardBone.RightHand;
  const clavicleBone = side < 0 ? VanguardBone.LeftClavicle : VanguardBone.RightClavicle;
  const shoulderFront = side < 0 ? shoulderRow.frontLeft : shoulderRow.frontRight;
  const shoulderBack = side < 0 ? shoulderRow.backLeft : shoulderRow.backRight;
  const chestFront = side < 0 ? chestRow.frontLeft : chestRow.frontRight;
  const chestBack = side < 0 ? chestRow.backLeft : chestRow.backRight;
  const shoulder = Object.freeze({
    front: shoulderFront,
    outer: builder.vertex(side * 0.77, 2.8, 0.018, clavicleBone, upperBone, 0.62),
    back: shoulderBack,
    inner: builder.vertex(side * 0.51, 2.68, 0.022, VanguardBone.Chest, clavicleBone, 0.65),
  });
  builder.orientedTriangle(VanguardMatteSurface.Tunic, chestFront, shoulder.front, shoulder.inner, side, 0.2, 0.8);
  builder.orientedTriangle(VanguardMatteSurface.Tunic, chestBack, shoulder.inner, shoulder.back, side, 0.2, -0.8);

  const bicep = addLimbSection(builder, side, side * 0.72, 2.45, 0.155, 0.125, 0.145, 0.12, upperBone);
  const elbow = addLimbSection(builder, side, side * 0.76, 2.15, 0.115, 0.09, 0.09, 0.075, upperBone, forearmBone, 0.52);
  const forearm = addLimbSection(builder, side, side * (side < 0 ? 0.72 : 0.78), 1.84, 0.14, 0.095, 0.11, 0.085, forearmBone);
  const wrist = addLimbSection(builder, side, side * (side < 0 ? 0.69 : 0.79), 1.6, 0.1, 0.067, 0.072, 0.058, forearmBone, handBone, 0.42);
  connectLimbBand(builder, side, shoulder, bicep, VanguardMatteSurface.Skin, 0.004);
  connectLimbBand(builder, side, bicep, elbow, VanguardMatteSurface.Skin, 0.008);
  connectLimbBand(builder, side, elbow, forearm, VanguardMatteSurface.Leather, 0.007);
  connectLimbBand(builder, side, forearm, wrist, VanguardMatteSurface.Leather, 0.006);
  addHand(builder, side, wrist, handBone);
}

/** 添加一个具有前后、外侧和内侧语义的肢体截面，不生成封口。 */
function addLimbSection(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  centerX: number,
  y: number,
  frontDepth: number,
  backDepth: number,
  outerRadius: number,
  innerRadius: number,
  boneA: VanguardBone,
  boneB: VanguardBone = boneA,
  weightB = 0,
): LimbSection {
  return Object.freeze({
    front: builder.vertex(centerX, y, frontDepth, boneA, boneB, weightB),
    outer: builder.vertex(centerX + side * outerRadius, y + 0.003, 0, boneA, boneB, weightB),
    back: builder.vertex(centerX, y - 0.002, -backDepth, boneA, boneB, weightB),
    inner: builder.vertex(centerX - side * innerRadius, y, 0.012, boneA, boneB, weightB),
  });
}

/** 连接连续肢体轮廓的四个语义平面。 */
function connectLimbBand(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  upper: Readonly<LimbSection>,
  lower: Readonly<LimbSection>,
  surface: VanguardMatteSurface,
  ridge: number,
): void {
  builder.orientedQuad(surface, upper.front, upper.outer, lower.outer, lower.front, side, 0, 1, ridge);
  builder.orientedQuad(surface, upper.outer, upper.back, lower.back, lower.outer, side, 0, -1, ridge * 0.7);
  builder.orientedQuad(surface, upper.back, upper.inner, lower.inner, lower.back, -side, 0, -1, ridge * 0.55);
  builder.orientedQuad(surface, upper.inner, upper.front, lower.front, lower.inner, -side, 0, 1, ridge * 0.8);
}

/** 写入窄腕口、厚掌体、宽指节和独立拇指组成的低面数皮手套。 */
function addHand(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  wrist: Readonly<LimbSection>,
  handBone: VanguardBone,
): void {
  const centerX = side * (side < 0 ? 0.68 : 0.81);
  const palmY = side < 0 ? 1.44 : 1.46;
  const fingerY = side < 0 ? 1.25 : 1.3;
  const palm = addLimbSection(
    builder, side, centerX, palmY,
    side < 0 ? 0.16 : 0.155, 0.075, 0.13, 0.11,
    handBone,
  );
  const fingers = addLimbSection(
    builder, side, centerX + side * 0.006, fingerY,
    0.135, 0.052, 0.108, 0.088,
    handBone,
  );
  const thumbBase = builder.vertex(
    centerX - side * 0.145,
    palmY - 0.035,
    0.14,
    handBone,
  );
  const thumbTip = builder.vertex(
    centerX - side * 0.155,
    fingerY + 0.035,
    0.105,
    handBone,
  );
  connectLimbBand(builder, side, wrist, palm, VanguardMatteSurface.Leather, 0.003);
  connectLimbBand(builder, side, palm, fingers, VanguardMatteSurface.Leather, 0.007);
  builder.orientedTriangle(VanguardMatteSurface.Leather, fingers.front, fingers.outer, fingers.back, 0, -1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Leather, fingers.front, fingers.back, fingers.inner, 0, -1, 0);
  builder.orientedTriangle(VanguardMatteSurface.Leather, palm.inner, thumbBase, palm.front, -side, 0, 1);
  builder.orientedTriangle(VanguardMatteSurface.Leather, palm.inner, fingers.inner, thumbTip, -side, -0.2, 0.2);
  builder.orientedTriangle(VanguardMatteSurface.Leather, palm.inner, thumbTip, thumbBase, -side, 0, 0.2);
  builder.orientedTriangle(VanguardMatteSurface.Leather, palm.front, thumbBase, thumbTip, 0, 0, 1);
}

/** 写入共享骨盆边界的双腿、胯部桥接和具有足弓的皮靴。 */
function addLegPair(builder: VanguardCageBuilder, pelvis: Readonly<TorsoRow>): void {
  const leftHip = addHipSection(builder, -1, pelvis);
  const rightHip = addHipSection(builder, 1, pelvis);
  const leftInnerThigh = addLeg(builder, -1, leftHip);
  const rightInnerThigh = addLeg(builder, 1, rightHip);
  builder.orientedQuad(VanguardMatteSurface.Pants, leftHip.inner, rightHip.inner, rightInnerThigh, leftInnerThigh, 0, 0, 1, 0.006);
  builder.orientedQuad(VanguardMatteSurface.Pants, leftHip.back, leftInnerThigh, rightInnerThigh, rightHip.back, 0, 0, -1, 0.004);
}

/** 把腿根连接到骨盆前后与侧面轮廓。 */
function addHipSection(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  pelvis: Readonly<TorsoRow>,
): LimbSection {
  const thighBone = side < 0 ? VanguardBone.LeftThigh : VanguardBone.RightThigh;
  const pelvisFront = side < 0 ? pelvis.frontLeft : pelvis.frontRight;
  const pelvisBack = side < 0 ? pelvis.backLeft : pelvis.backRight;
  return Object.freeze({
    front: pelvisFront,
    outer: builder.vertex(side * 0.48, 1.52, 0, VanguardBone.Pelvis, thighBone, 0.45),
    back: pelvisBack,
    inner: builder.vertex(side * 0.11, 1.5, 0.015, VanguardBone.Pelvis, thighBone, 0.5),
  });
}

/** 写入一侧大腿、膝部、小腿、踝部和非楔形模板的完整脚部。 */
function addLeg(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  hip: Readonly<LimbSection>,
): number {
  const thighBone = side < 0 ? VanguardBone.LeftThigh : VanguardBone.RightThigh;
  const shinBone = side < 0 ? VanguardBone.LeftShin : VanguardBone.RightShin;
  const footBone = side < 0 ? VanguardBone.LeftFoot : VanguardBone.RightFoot;
  const toeBone = side < 0 ? VanguardBone.LeftToe : VanguardBone.RightToe;
  const thigh = addLimbSection(builder, side, side * 0.35, 1.3, 0.2, 0.17, 0.21, 0.17, thighBone);
  const knee = addLimbSection(builder, side, side * 0.35, 0.91, 0.145, 0.12, 0.12, 0.1, thighBone, shinBone, 0.52);
  const calf = addLimbSection(builder, side, side * 0.36, 0.56, 0.175, 0.135, 0.15, 0.12, shinBone);
  const ankle = addLimbSection(builder, side, side * 0.36, 0.19, 0.125, 0.1, 0.095, 0.078, shinBone, footBone, 0.48);
  connectLimbBand(builder, side, hip, thigh, VanguardMatteSurface.Pants, 0.008);
  connectLimbBand(builder, side, thigh, knee, VanguardMatteSurface.Pants, 0.009);
  connectLimbBand(builder, side, knee, calf, VanguardMatteSurface.Leather, 0.008);
  connectLimbBand(builder, side, calf, ankle, VanguardMatteSurface.Leather, 0.007);
  addFoot(builder, side, ankle, footBone, toeBone);
  return thigh.inner;
}

/** 用脚跟、足弓、脚背和不等宽前掌构成贴地皮靴。 */
function addFoot(
  builder: VanguardCageBuilder,
  side: -1 | 1,
  ankle: Readonly<LimbSection>,
  footBone: VanguardBone,
  toeBone: VanguardBone,
): void {
  const centerX = side * 0.36;
  const heelOuter = builder.vertex(centerX + side * 0.105, 0.055, -0.09, footBone);
  const heelInner = builder.vertex(centerX - side * 0.09, 0.055, -0.075, footBone);
  const archOuter = builder.vertex(
    centerX + side * 0.13, 0.04, 0.17,
    footBone, toeBone, 0.18,
  );
  const archInner = builder.vertex(
    centerX - side * 0.11, 0.045, 0.15,
    footBone, toeBone, 0.14,
  );
  const toeOuter = builder.vertex(centerX + side * 0.15, 0.045, 0.43, toeBone);
  const toeInner = builder.vertex(centerX - side * 0.13, 0.045, 0.41, toeBone);
  const toeTop = builder.vertex(centerX + side * 0.008, 0.13, 0.39, toeBone);
  builder.orientedQuad(VanguardMatteSurface.Leather, ankle.outer, ankle.front, toeTop, archOuter, side, 0.35, 0.7, 0.005);
  builder.orientedQuad(VanguardMatteSurface.Leather, ankle.front, ankle.inner, archInner, toeTop, -side, 0.35, 0.7, 0.004);
  builder.orientedTriangle(VanguardMatteSurface.Leather, archOuter, toeTop, toeOuter, side, 0.3, 0.8);
  builder.orientedTriangle(VanguardMatteSurface.Leather, toeTop, toeInner, toeOuter, 0, 0.4, 1);
  builder.orientedTriangle(VanguardMatteSurface.Leather, toeTop, archInner, toeInner, -side, 0.3, 0.8);
  builder.orientedQuad(VanguardMatteSurface.Leather, ankle.back, ankle.outer, heelOuter, heelInner, 0, 0, -1, 0.003);
  builder.orientedQuad(VanguardMatteSurface.Leather, ankle.inner, ankle.back, heelInner, archInner, -side, 0, -0.5);
  builder.orientedQuad(VanguardMatteSurface.Leather, ankle.outer, archOuter, heelOuter, ankle.back, side, 0, -0.5);
  builder.orientedQuad(VanguardMatteSurface.Leather, heelOuter, archOuter, archInner, heelInner, 0, -1, 0);
  builder.orientedQuad(VanguardMatteSurface.Leather, archOuter, toeOuter, toeInner, archInner, 0, -1, 0);
}

/** 主角连续人体主体固定拓扑。 */
export const VANGUARD_BODY_CAGE = createVanguardBodyCage();
