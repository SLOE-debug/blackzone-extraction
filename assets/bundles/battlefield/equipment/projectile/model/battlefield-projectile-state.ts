import { type WeaponEquipmentDefinition } from '../../../../../core/equipment/equipment';
import { getWeaponShotProjectileCount } from './battlefield-weapon-shot-pattern';

/** 预分配的战场子弹 SoA 状态，射击热路径只覆写已有槽位。 */
export class BattlefieldProjectileState {
  public readonly active: Uint8Array;
  public readonly x: Float32Array;
  public readonly y: Float32Array;
  public readonly z: Float32Array;
  public readonly directionX: Float32Array;
  public readonly directionY: Float32Array;
  public readonly directionZ: Float32Array;
  public readonly travelledDistance: Float32Array;
  public activeCount = 0;
  private nextSlot = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('战场子弹容量必须是正整数。');
    }
    this.active = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.z = new Float32Array(capacity);
    this.directionX = new Float32Array(capacity);
    this.directionY = new Float32Array(capacity);
    this.directionZ = new Float32Array(capacity);
    this.travelledDistance = new Float32Array(capacity);
  }

  /** 在循环槽位中写入一发新子弹；理论容量饱和时替换最旧扫描槽。 */
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
    this.x[slot] = x;
    this.y[slot] = y;
    this.z[slot] = z;
    this.directionX[slot] = directionX;
    this.directionY[slot] = directionY;
    this.directionZ[slot] = directionZ;
    this.travelledDistance[slot] = 0;
    this.nextSlot = (slot + 1) % this.capacity;
  }

  /** 停用一发子弹并保持其数组槽位供后续射击复用。 */
  public deactivate(slot: number): void {
    if ((this.active[slot] ?? 0) === 0) {
      return;
    }
    this.active[slot] = 0;
    this.activeCount--;
  }
}

/** 根据飞行时间和射击间隔推导同时存活的子弹槽位数量。 */
export function calculateProjectileCapacity(
  definition: Readonly<WeaponEquipmentDefinition>,
): number {
  const projectile = definition.projectile;
  if (!Number.isFinite(definition.fireIntervalSeconds)
    || definition.fireIntervalSeconds <= 0
    || !Number.isFinite(projectile.speed)
    || projectile.speed <= 0
    || !Number.isFinite(projectile.maximumRange)
    || projectile.maximumRange <= 0) {
    throw new Error('武器射速、子弹速度和射程必须是有限正数。');
  }
  const flightSeconds = projectile.maximumRange / projectile.speed;
  const concurrentShots = Math.ceil(flightSeconds / definition.fireIntervalSeconds) + 1;
  const capacity = concurrentShots * getWeaponShotProjectileCount(definition.shotPattern);
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new Error('武器参数无法推导有效的战场子弹容量。');
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
  if (!Number.isFinite(x)
    || !Number.isFinite(y)
    || !Number.isFinite(z)
    || !Number.isFinite(directionX)
    || !Number.isFinite(directionY)
    || !Number.isFinite(directionZ)) {
    throw new Error('战场子弹生成位置与方向必须是有限数值。');
  }
  if (Math.abs(Math.hypot(directionX, directionY, directionZ) - 1) > 0.001) {
    throw new Error('战场子弹生成方向必须归一化。');
  }
}
