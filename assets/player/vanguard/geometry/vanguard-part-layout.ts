import { VanguardJoint } from '../model/vanguard-schema';

/** 主角程序化装甲和装备的语义部件标识。 */
export enum VanguardPartId {
  LeftBoot = 'left-boot',
  RightBoot = 'right-boot',
  LeftCalf = 'left-calf',
  RightCalf = 'right-calf',
  LeftThigh = 'left-thigh',
  RightThigh = 'right-thigh',
  Pelvis = 'pelvis',
  Abdomen = 'abdomen',
  Chest = 'chest',
  HelmetJaw = 'helmet-jaw',
  HelmetFace = 'helmet-face',
  HelmetCrown = 'helmet-crown',
  LeftUpperArm = 'left-upper-arm',
  RightUpperArm = 'right-upper-arm',
  LeftForearm = 'left-forearm',
  RightForearm = 'right-forearm',
  LeftHand = 'left-hand',
  RightHand = 'right-hand',
  LeftShoulderPlate = 'left-shoulder-plate',
  RightShoulderPlate = 'right-shoulder-plate',
  LeftChestStrap = 'left-chest-strap',
  RightChestStrap = 'right-chest-strap',
  LeftPouch = 'left-pouch',
  CenterPouch = 'center-pouch',
  RightPouch = 'right-pouch',
  LeftKneePlate = 'left-knee-plate',
  RightKneePlate = 'right-knee-plate',
  LeftThighPlate = 'left-thigh-plate',
  RightThighPlate = 'right-thigh-plate',
  LeftHipPanel = 'left-hip-panel',
  RightHipPanel = 'right-hip-panel',
  HandgunSlide = 'handgun-slide',
  HandgunMuzzle = 'handgun-muzzle',
  HandgunGrip = 'handgun-grip',
  HeadAntenna = 'head-antenna',
  EyeLens = 'eye-lens',
  LeftTempleLight = 'left-temple-light',
  RightTempleLight = 'right-temple-light',
  LeftForearmLight = 'left-forearm-light',
  RightForearmLight = 'right-forearm-light',
}

/** 部件截面依据领域职责选择的造型轮廓。 */
export enum VanguardPartProfile {
  BodyShell,
  LimbArmor,
  ArmorPlate,
  Helmet,
  Equipment,
  Boot,
  Weapon,
  LightPanel,
}

/** 单个不规则分面部件的关节连接和变截面尺寸。 */
export interface VanguardPartSpec {
  readonly id: VanguardPartId;
  readonly profile: VanguardPartProfile;
  readonly start: VanguardJoint;
  readonly end: VanguardJoint;
  readonly startWidth: number;
  readonly startDepth: number;
  readonly endWidth: number;
  readonly endDepth: number;
  readonly seed: number;
}

/** 参考黑色战术机甲轮廓组织的主体装甲。 */
export const VANGUARD_ARMOR_PARTS = Object.freeze([
  part(VanguardPartId.LeftBoot, VanguardPartProfile.Boot, VanguardJoint.LeftAnkle, VanguardJoint.LeftToe, 0.3, 0.12, 0.36, 0.095, 11),
  part(VanguardPartId.RightBoot, VanguardPartProfile.Boot, VanguardJoint.RightAnkle, VanguardJoint.RightToe, 0.31, 0.115, 0.37, 0.09, 13),
  part(VanguardPartId.LeftCalf, VanguardPartProfile.LimbArmor, VanguardJoint.LeftAnkle, VanguardJoint.LeftKnee, 0.2, 0.17, 0.27, 0.22, 17),
  part(VanguardPartId.RightCalf, VanguardPartProfile.LimbArmor, VanguardJoint.RightAnkle, VanguardJoint.RightKnee, 0.205, 0.165, 0.275, 0.215, 19),
  part(VanguardPartId.LeftThigh, VanguardPartProfile.LimbArmor, VanguardJoint.LeftKnee, VanguardJoint.LeftHip, 0.28, 0.235, 0.35, 0.285, 23),
  part(VanguardPartId.RightThigh, VanguardPartProfile.LimbArmor, VanguardJoint.RightKnee, VanguardJoint.RightHip, 0.285, 0.23, 0.355, 0.28, 29),
  part(VanguardPartId.Pelvis, VanguardPartProfile.BodyShell, VanguardJoint.PelvisBottom, VanguardJoint.PelvisTop, 0.5, 0.28, 0.56, 0.31, 31),
  part(VanguardPartId.Abdomen, VanguardPartProfile.BodyShell, VanguardJoint.PelvisTop, VanguardJoint.ChestBottom, 0.41, 0.24, 0.5, 0.29, 37),
  part(VanguardPartId.Chest, VanguardPartProfile.BodyShell, VanguardJoint.ChestBottom, VanguardJoint.ChestTop, 0.52, 0.31, 0.74, 0.37, 41),
  part(VanguardPartId.HelmetJaw, VanguardPartProfile.Helmet, VanguardJoint.Neck, VanguardJoint.HeadJaw, 0.24, 0.23, 0.27, 0.255, 43),
  part(VanguardPartId.HelmetFace, VanguardPartProfile.Helmet, VanguardJoint.HeadJaw, VanguardJoint.HeadBrow, 0.27, 0.255, 0.32, 0.29, 47),
  part(VanguardPartId.HelmetCrown, VanguardPartProfile.Helmet, VanguardJoint.HeadBrow, VanguardJoint.HeadTop, 0.32, 0.29, 0.27, 0.24, 53),
  part(VanguardPartId.LeftUpperArm, VanguardPartProfile.LimbArmor, VanguardJoint.LeftShoulder, VanguardJoint.LeftElbow, 0.25, 0.22, 0.2, 0.18, 59),
  part(VanguardPartId.RightUpperArm, VanguardPartProfile.LimbArmor, VanguardJoint.RightShoulder, VanguardJoint.RightElbow, 0.255, 0.215, 0.205, 0.175, 61),
  part(VanguardPartId.LeftForearm, VanguardPartProfile.LimbArmor, VanguardJoint.LeftElbow, VanguardJoint.LeftHand, 0.235, 0.195, 0.18, 0.15, 67),
  part(VanguardPartId.RightForearm, VanguardPartProfile.LimbArmor, VanguardJoint.RightElbow, VanguardJoint.RightHand, 0.24, 0.19, 0.185, 0.15, 71),
  part(VanguardPartId.LeftHand, VanguardPartProfile.LimbArmor, VanguardJoint.LeftHand, VanguardJoint.LeftPalmEnd, 0.17, 0.14, 0.13, 0.11, 73),
  part(VanguardPartId.RightHand, VanguardPartProfile.LimbArmor, VanguardJoint.RightHand, VanguardJoint.RightPalmEnd, 0.175, 0.14, 0.13, 0.11, 79),
] satisfies readonly VanguardPartSpec[]);

/** 深黑战术面板、肩甲、胸挂和腿部附加装甲。 */
export const VANGUARD_PANEL_PARTS = Object.freeze([
  part(VanguardPartId.LeftShoulderPlate, VanguardPartProfile.ArmorPlate, VanguardJoint.LeftShoulderInner, VanguardJoint.LeftShoulderOuter, 0.26, 0.21, 0.31, 0.23, 83),
  part(VanguardPartId.RightShoulderPlate, VanguardPartProfile.ArmorPlate, VanguardJoint.RightShoulderInner, VanguardJoint.RightShoulderOuter, 0.265, 0.205, 0.315, 0.225, 89),
  part(VanguardPartId.LeftChestStrap, VanguardPartProfile.ArmorPlate, VanguardJoint.ChestLeftBottom, VanguardJoint.ChestLeftTop, 0.13, 0.075, 0.17, 0.085, 97),
  part(VanguardPartId.RightChestStrap, VanguardPartProfile.ArmorPlate, VanguardJoint.ChestRightBottom, VanguardJoint.ChestRightTop, 0.13, 0.075, 0.17, 0.085, 101),
  part(VanguardPartId.LeftPouch, VanguardPartProfile.Equipment, VanguardJoint.PouchLeftBottom, VanguardJoint.PouchLeftTop, 0.19, 0.115, 0.19, 0.105, 103),
  part(VanguardPartId.CenterPouch, VanguardPartProfile.Equipment, VanguardJoint.PouchCenterBottom, VanguardJoint.PouchCenterTop, 0.2, 0.12, 0.2, 0.11, 107),
  part(VanguardPartId.RightPouch, VanguardPartProfile.Equipment, VanguardJoint.PouchRightBottom, VanguardJoint.PouchRightTop, 0.19, 0.11, 0.19, 0.105, 109),
  part(VanguardPartId.LeftKneePlate, VanguardPartProfile.ArmorPlate, VanguardJoint.LeftKneePlateBottom, VanguardJoint.LeftKneePlateTop, 0.22, 0.09, 0.245, 0.105, 113),
  part(VanguardPartId.RightKneePlate, VanguardPartProfile.ArmorPlate, VanguardJoint.RightKneePlateBottom, VanguardJoint.RightKneePlateTop, 0.225, 0.09, 0.25, 0.1, 127),
  part(VanguardPartId.LeftThighPlate, VanguardPartProfile.ArmorPlate, VanguardJoint.LeftThighPlateBottom, VanguardJoint.LeftThighPlateTop, 0.2, 0.075, 0.24, 0.085, 131),
  part(VanguardPartId.RightThighPlate, VanguardPartProfile.ArmorPlate, VanguardJoint.RightThighPlateBottom, VanguardJoint.RightThighPlateTop, 0.205, 0.075, 0.245, 0.085, 137),
  part(VanguardPartId.LeftHipPanel, VanguardPartProfile.ArmorPlate, VanguardJoint.LeftHipPanelBottom, VanguardJoint.LeftHipPanelTop, 0.19, 0.08, 0.22, 0.09, 139),
  part(VanguardPartId.RightHipPanel, VanguardPartProfile.ArmorPlate, VanguardJoint.RightHipPanelBottom, VanguardJoint.RightHipPanelTop, 0.195, 0.08, 0.225, 0.09, 149),
] satisfies readonly VanguardPartSpec[]);

/** 黑色手枪和头部天线。 */
export const VANGUARD_WEAPON_PARTS = Object.freeze([
  part(VanguardPartId.HandgunSlide, VanguardPartProfile.Weapon, VanguardJoint.WeaponRear, VanguardJoint.WeaponFront, 0.145, 0.12, 0.13, 0.105, 151),
  part(VanguardPartId.HandgunMuzzle, VanguardPartProfile.Weapon, VanguardJoint.WeaponFront, VanguardJoint.WeaponMuzzle, 0.1, 0.085, 0.09, 0.075, 157),
  part(VanguardPartId.HandgunGrip, VanguardPartProfile.Weapon, VanguardJoint.WeaponRear, VanguardJoint.WeaponGripBottom, 0.105, 0.095, 0.09, 0.075, 163),
  part(VanguardPartId.HeadAntenna, VanguardPartProfile.Weapon, VanguardJoint.AntennaBase, VanguardJoint.AntennaTip, 0.045, 0.038, 0.03, 0.026, 167),
] satisfies readonly VanguardPartSpec[]);

/** 除独眼外的白色识别灯与中央镜片。 */
export const VANGUARD_LIGHT_PARTS = Object.freeze([
  part(VanguardPartId.EyeLens, VanguardPartProfile.LightPanel, VanguardJoint.EyeInner, VanguardJoint.EyeOuter, 0.075, 0.065, 0.065, 0.055, 173),
  part(VanguardPartId.LeftTempleLight, VanguardPartProfile.LightPanel, VanguardJoint.LeftTempleLightBottom, VanguardJoint.LeftTempleLightTop, 0.055, 0.025, 0.045, 0.02, 179),
  part(VanguardPartId.RightTempleLight, VanguardPartProfile.LightPanel, VanguardJoint.RightTempleLightBottom, VanguardJoint.RightTempleLightTop, 0.052, 0.024, 0.043, 0.02, 181),
  part(VanguardPartId.LeftForearmLight, VanguardPartProfile.LightPanel, VanguardJoint.LeftForearmLightBottom, VanguardJoint.LeftForearmLightTop, 0.09, 0.025, 0.105, 0.03, 191),
  part(VanguardPartId.RightForearmLight, VanguardPartProfile.LightPanel, VanguardJoint.RightForearmLightBottom, VanguardJoint.RightForearmLightTop, 0.09, 0.025, 0.105, 0.03, 193),
] satisfies readonly VanguardPartSpec[]);

/** 创建只读语义部件配置。 */
function part(
  id: VanguardPartId,
  profile: VanguardPartProfile,
  start: VanguardJoint,
  end: VanguardJoint,
  startWidth: number,
  startDepth: number,
  endWidth: number,
  endDepth: number,
  seed: number,
): VanguardPartSpec {
  return Object.freeze({
    id,
    profile,
    start,
    end,
    startWidth,
    startDepth,
    endWidth,
    endDepth,
    seed,
  });
}
