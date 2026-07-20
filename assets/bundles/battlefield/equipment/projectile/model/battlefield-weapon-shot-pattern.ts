import {
  type WeaponShotPattern,
  WeaponShotPatternType,
} from '../../../../../core/equipment/equipment';
import { type MutableBattlefieldProjectileDirection } from './battlefield-projectile-trajectory';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DIRECTION_EPSILON = 0.000001;

/** 返回一次扳机动作需要生成的弹体数量。 */
export function getWeaponShotProjectileCount(
  pattern: Readonly<WeaponShotPattern>,
): number {
  switch (pattern.type) {
    case WeaponShotPatternType.Single:
      return 1;
    case WeaponShotPatternType.PelletCone:
      if (!Number.isSafeInteger(pattern.projectileCount) || pattern.projectileCount <= 1) {
        throw new Error('霰弹锥形分布至少需要两个弹丸。');
      }
      return pattern.projectileCount;
  }
}

/** 从基础瞄准方向写出一个确定性弹丸方向，中心弹丸始终精确命中准星。 */
export function writeBattlefieldShotProjectileDirection(
  baseX: number,
  baseY: number,
  baseZ: number,
  pattern: Readonly<WeaponShotPattern>,
  projectileIndex: number,
  result: MutableBattlefieldProjectileDirection,
): void {
  const projectileCount = getWeaponShotProjectileCount(pattern);
  if (!Number.isInteger(projectileIndex)
    || projectileIndex < 0
    || projectileIndex >= projectileCount) {
    throw new Error('武器弹丸索引超出当前射击分布。');
  }
  if (pattern.type === WeaponShotPatternType.Single || projectileIndex === 0) {
    result.x = baseX;
    result.y = baseY;
    result.z = baseZ;
    return;
  }

  const planarLength = Math.hypot(baseX, baseZ);
  const rightX = planarLength > DIRECTION_EPSILON ? baseZ / planarLength : 1;
  const rightZ = planarLength > DIRECTION_EPSILON ? -baseX / planarLength : 0;
  const upX = baseY * rightZ;
  const upY = planarLength > DIRECTION_EPSILON ? planarLength : 0;
  const upZ = planarLength > DIRECTION_EPSILON ? -baseY * rightX : -Math.sign(baseY);
  const radialProgress = Math.sqrt(projectileIndex / (projectileCount - 1));
  const angle = projectileIndex * GOLDEN_ANGLE;
  const rightAmount = Math.tan(
    Math.cos(angle) * pattern.horizontalSpreadRadians * radialProgress,
  );
  const upAmount = Math.tan(
    Math.sin(angle) * pattern.verticalSpreadRadians * radialProgress,
  );
  let directionX = baseX + rightX * rightAmount + upX * upAmount;
  let directionY = baseY + upY * upAmount;
  let directionZ = baseZ + rightZ * rightAmount + upZ * upAmount;
  const inverseLength = 1 / Math.max(
    Math.hypot(directionX, directionY, directionZ),
    DIRECTION_EPSILON,
  );
  directionX *= inverseLength;
  directionY *= inverseLength;
  directionZ *= inverseLength;
  result.x = directionX;
  result.y = directionY;
  result.z = directionZ;
}

