import {
  EquipmentCategory,
  EquipmentRarity,
  WeaponGrip,
  WeaponKind,
  WeaponSkillCommand,
} from '../../../../../core/equipment/equipment';
import { type BattlefieldEquipmentPrototype } from '../../catalog/battlefield-equipment-prototype';
import { EquipmentIconId, SkillIconId } from '../../catalog/equipment-hud-profile';
import { EquipmentId } from '../../catalog/equipment-id';
import { RETURNING_BOW_GEOMETRY } from './returning-bow-geometry';

/** 归弦猎弓的初始数值、挂点、程序几何与 HUD 原型。 */
export const RETURNING_BOW_PROTOTYPE = Object.freeze({
  id: EquipmentId.ReturningBow,
  definition: Object.freeze({
    id: EquipmentId.ReturningBow,
    category: EquipmentCategory.Weapon,
    displayName: '归弦猎弓',
    description: '布置六支永久箭矢，并让召回路线贯穿怪群',
    rarity: EquipmentRarity.Epic,
    maximumStack: 1,
    kind: WeaponKind.ReturningBow,
    baseDamage: 30,
    attackIntervalSeconds: 0.42,
    projectileSpeed: 42,
    projectileRadius: 0.16,
    maximumRange: 24,
    chargeDurationSeconds: 0.8,
    maximumChargeDamageScale: 2.2,
    maximumChargeSpeedScale: 1.3,
    maximumChargePierceCount: 1,
    projectileCapacity: 6,
    automaticRecallMinimumSpeed: 28,
    automaticRecallMaximumSpeed: 68,
    skillRecallMinimumSpeed: 38,
    skillRecallMaximumSpeed: 88,
    recallAccelerationDistance: 20,
    automaticRecallDamageScale: 0.45,
    skillRecallDamageScale: 0.85,
    extractionDamageScale: 0.7,
    tetherDurationSeconds: 5,
    tetherDamageScale: 0.6,
    tetherHitCooldownSeconds: 0.45,
    tetherSlowScale: 0.75,
    tetherSlowDurationSeconds: 0.8,
  }),
  geometry: RETURNING_BOW_GEOMETRY,
  dropped: Object.freeze({ scale: 0.48, boundsRadius: 1.35 }),
  held: Object.freeze({
    grip: WeaponGrip.TwoHandRanged,
    heldScale: 0.52,
    attachmentPoints: Object.freeze({
      mainGrip: Object.freeze({ x: 0, y: 0, z: 0 }),
      supportGrip: Object.freeze({ x: -0.12, y: 0.58, z: 0.04 }),
      projectileOrigin: Object.freeze({ x: 0.24, y: 0, z: 0 }),
      drawHandTarget: Object.freeze({ x: 0.28, y: 0, z: 0 }),
    }),
  }),
  hud: Object.freeze({
    inventoryIcon: EquipmentIconId.ReturningBow,
    skills: Object.freeze([
      Object.freeze({
        command: WeaponSkillCommand.RecallAll,
        icon: SkillIconId.BowRecall,
        label: '万箭归弦',
      }),
      Object.freeze({
        command: WeaponSkillCommand.HuntingTether,
        icon: SkillIconId.BowTether,
        label: '猎场织网',
      }),
    ]),
  }),
}) satisfies BattlefieldEquipmentPrototype<EquipmentId.ReturningBow>;
