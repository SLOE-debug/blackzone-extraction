import { type WeaponEquipmentDefinition } from '../../../../../core/equipment/equipment';
import { getWeaponShotProjectileCount } from './battlefield-weapon-shot-pattern';

/** 预分配的实体弹丸 SoA；飞行、碰撞和渲染共享同一组权威位置。 */
export class BattlefieldProjectileState {
  public readonly active: Uint8Array;
  public readonly previousX: Float32Array;
  public readonly previousY: Float32Array;
  public readonly previousZ: Float32Array;
  public readonly x: Float32Array;
  public readonly y: Float32Array;
  public readonly z: Float32Array;
  public readonly directionX: Float32Array;
  public readonly directionY: Float32Array;
  public readonly directionZ: Float32Array;
  public readonly remainingRange: Float32Array;
  public readonly remainingEnergy: Uint8Array;
  public readonly hitCount: Uint8Array;
  public readonly hitPopulationIds: Uint32Array;
  public readonly hitEntityIds: Uint32Array;
  public activeCount = 0;
  private nextSlot = 0;

  constructor(
    public readonly capacity: number,
    public readonly hitHistoryCapacity: number,
    private readonly maximumRange: number,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0
      || !Number.isSafeInteger(hitHistoryCapacity) || hitHistoryCapacity <= 0
      || hitHistoryCapacity > 255
      || !Number.isFinite(maximumRange) || maximumRange <= 0) {
      throw new Error('实体弹丸容量、穿透容量与射程必须有效。');
    }
    this.active = new Uint8Array(capacity);
    this.previousX = new Float32Array(capacity);
    this.previousY = new Float32Array(capacity);
    this.previousZ = new Float32Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.directionX = new Float32Array(capacity);
    this.directionY = new Float32Array(capacity);
    this.directionZ = new Float32Array(capacity);
    this.remainingRange = new Float32Array(capacity);
    this.remainingEnergy = new Uint8Array(capacity);
    this.hitCount = new Uint8Array(capacity);
    this.hitPopulationIds = new Uint32Array(capacity * hitHistoryCapacity);
    this.hitEntityIds = new Uint32Array(capacity * hitHistoryCapacity);
  }

  /** 在循环槽位中写入一发新弹丸，并清空该槽位上一轮飞行的命中历史。 */
  public spawn(
    x: number,
    y: number,
    z: number,
    directionX: number,
    directionY: number,
    directionZ: number,
  ): void {
    validateSpawn(x, y, z, directionX, directionY, directionZ);
    let slot = this.nextSlot;
    for (let offset = 0; offset < this.capacity; offset++) {
      const candidate = (this.nextSlot + offset) % this.capacity;
      if ((this.active[candidate] ?? 0) === 0) {
        slot = candidate;
        break;
      }
    }
    if ((this.active[slot] ?? 0) === 0) {
      this.activeCount++;
    }
    this.active[slot] = 1;
    this.previousX[slot] = x;
    this.previousY[slot] = y;
    this.previousZ[slot] = z;
    this.x[slot] = x;
    this.y[slot] = y;
    this.z[slot] = z;
    this.directionX[slot] = directionX;
    this.directionY[slot] = directionY;
    this.directionZ[slot] = directionZ;
    this.remainingRange[slot] = this.maximumRange;
    this.remainingEnergy[slot] = this.hitHistoryCapacity;
    this.hitCount[slot] = 0;
    this.nextSlot = (slot + 1) % this.capacity;
  }

  /** 记录命中身份，供同帧和后续帧排除同一实体。 */
  public recordHit(slot: number, populationId: number, entityId: number): void {
    const hitIndex = this.hitCount[slot] ?? 0;
    if (hitIndex >= this.hitHistoryCapacity) {
      throw new Error('实体弹丸命中历史超过穿透容量。');
    }
    const offset = slot * this.hitHistoryCapacity + hitIndex;
    this.hitPopulationIds[offset] = populationId;
    this.hitEntityIds[offset] = entityId;
    this.hitCount[slot] = hitIndex + 1;
  }

  /** 停用一发弹丸并保留其数组槽位供后续射击复用。 */
  public deactivate(slot: number): void {
    if ((this.active[slot] ?? 0) === 0) {
      return;
    }
    this.active[slot] = 0;
    this.activeCount--;
  }
}

/** 根据飞行时间、射击间隔与单次射击弹丸数推导同时存活容量。 */
export function calculateProjectileCapacity(
  definition: Readonly<WeaponEquipmentDefinition>,
): number {
  const projectile = definition.projectile;
  if (!Number.isFinite(definition.fireIntervalSeconds)
    || definition.fireIntervalSeconds <= 0
    || !Number.isFinite(projectile.speed)
    || projectile.speed <= 0
    || !Number.isFinite(projectile.maximumRange)
    || projectile.maximumRange <= 0
    || !Number.isFinite(projectile.impactRadius)
    || projectile.impactRadius < 0
    || !Number.isFinite(projectile.damageRetention)
    || projectile.damageRetention <= 0
    || projectile.damageRetention > 1
    || !Number.isFinite(definition.damage)
    || definition.damage <= 0
    || !Number.isSafeInteger(projectile.penetrationEnergy)
    || projectile.penetrationEnergy <= 0
    || projectile.penetrationEnergy > 255) {
    throw new Error('武器伤害、射速或实体弹丸碰撞参数无效。');
  }
  const flightSeconds = projectile.maximumRange / projectile.speed;
  const concurrentShots = Math.ceil(flightSeconds / definition.fireIntervalSeconds) + 1;
  const capacity = concurrentShots * getWeaponShotProjectileCount(definition.shotPattern);
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new Error('武器参数无法推导有效的实体弹丸容量。');
  }
  return capacity;
}

function validateSpawn(
  x: number,
  y: number,
  z: number,
  directionX: number,
  directionY: number,
  directionZ: number,
): void {
  if (![x, y, z, directionX, directionY, directionZ].every(Number.isFinite)) {
    throw new Error('实体弹丸生成位置与方向必须是有限数值。');
  }
  if (Math.abs(Math.hypot(directionX, directionY, directionZ) - 1) > 0.001) {
    throw new Error('实体弹丸生成方向必须归一化。');
  }
}
