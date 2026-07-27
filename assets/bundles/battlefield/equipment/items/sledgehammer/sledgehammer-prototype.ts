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
import { SLEDGEHAMMER_GEOMETRY } from './sledgehammer-geometry';

/** 大锤在战场中的完整玩法与可视原型。 */
export const SLEDGEHAMMER_PROTOTYPE = Object.freeze({
  id: EquipmentId.Sledgehammer,
  definition: Object.freeze({
    id: EquipmentId.Sledgehammer,
    category: EquipmentCategory.Weapon,
    displayName: '裂岩大锤',
    description: '沉重的双手战锤，连续命中可积蓄震势',
    rarity: EquipmentRarity.Epic,
    maximumStack: 1,
    kind: WeaponKind.Sledgehammer,
    baseDamage: 42,
    reach: 3.9,
    hitArcRadians: Math.PI * 0.74,
    attackIntervalSeconds: 0.72,
    knockbackImpulse: 8.4,
    comboWindowSeconds: 2.5,
    specialRequiredHits: 5,
  }),
  geometry: SLEDGEHAMMER_GEOMETRY,
  dropped: Object.freeze({ scale: 0.42, boundsRadius: 1.72 }),
  held: Object.freeze({
    grip: WeaponGrip.TwoHandHeavy,
    heldScale: 0.45,
    mainGripLocalPosition: Object.freeze({ x: 0, y: 0, z: 0 }),
    supportGripLocalPosition: Object.freeze({ x: 0, y: -0.75, z: 0 }),
    hammerHeadLocalPosition: Object.freeze({ x: 0, y: -3.08, z: 0 }),
    hammerHeadRadius: 0.82,
  }),
  hud: Object.freeze({
    inventoryIcon: EquipmentIconId.Sledgehammer,
    skills: Object.freeze([
      Object.freeze({
        command: WeaponSkillCommand.Spin,
        icon: SkillIconId.HammerWhirlwind,
        label: '旋风',
        position: 0,
      }),
      Object.freeze({
        command: WeaponSkillCommand.GroundSlam,
        icon: SkillIconId.HammerGroundSlam,
        label: '裂地重砸',
        position: 1,
      }),
      Object.freeze({
        command: WeaponSkillCommand.Uppercut,
        icon: SkillIconId.HammerUppercut,
        label: '冲天上挑',
        position: 2,
      }),
    ]),
  }),
}) satisfies BattlefieldEquipmentPrototype<EquipmentId.Sledgehammer>;
