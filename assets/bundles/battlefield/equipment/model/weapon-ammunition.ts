import {
  AmmunitionType,
  type MagazineWeaponAmmunitionDefinition,
  type TubeMagazineWeaponAmmunitionDefinition,
  type WeaponAmmunitionDefinition,
  WeaponAmmunitionMode,
} from '../../../../core/equipment/equipment';
import { WeaponAmmunitionReserve } from './weapon-ammunition-reserve';

/** 武器射击系统依赖的有限弹药消耗与装填策略。 */
export interface WeaponAmmunition {
  readonly ammunitionType: AmmunitionType;
  readonly roundsRemaining: number;
  readonly reserveRounds: number;
  readonly empty: boolean;
  readonly reloading: boolean;
  /** 当前装填动作的零到一进度。 */
  readonly reloadProgress: number;
  /** 尝试为一次射击消耗弹仓弹药；库存不足或正在装填时返回 false。 */
  tryConsumeShot(): boolean;
  /** 在弹仓未满且存在对应备用弹药时开始装填。 */
  beginReload(): boolean;
  /** 推进当前装填动作，不负责决定何时开始装填。 */
  update(deltaTime: number): void;
}

/** 手枪使用的可拆卸弹匣，在固定换弹时长结束后一次补足。 */
class MagazineWeaponAmmunition implements WeaponAmmunition {
  private rounds: number;
  private reloadElapsed = 0;
  private loading = false;

  constructor(
    private readonly definition: Readonly<MagazineWeaponAmmunitionDefinition>,
    private readonly reserve: WeaponAmmunitionReserve,
  ) {
    validateMagazineDefinition(definition);
    this.rounds = definition.capacity;
  }

  public get ammunitionType(): AmmunitionType {
    return this.definition.ammunitionType;
  }

  public get roundsRemaining(): number {
    return this.rounds;
  }

  public get reserveRounds(): number {
    return this.reserve.get(this.definition.ammunitionType);
  }

  public get empty(): boolean {
    return this.rounds === 0;
  }

  public get reloading(): boolean {
    return this.loading;
  }

  public get reloadProgress(): number {
    return this.loading
      ? Math.min(1, this.reloadElapsed / this.definition.reloadSeconds)
      : 0;
  }

  public tryConsumeShot(): boolean {
    if (this.loading || this.rounds <= 0) {
      return false;
    }
    this.rounds--;
    return true;
  }

  public beginReload(): boolean {
    if (this.loading
      || this.rounds >= this.definition.capacity
      || this.reserveRounds <= 0) {
      return false;
    }
    this.loading = true;
    this.reloadElapsed = 0;
    return true;
  }

  public update(deltaTime: number): void {
    validateDeltaTime(deltaTime);
    if (!this.loading) {
      return;
    }
    this.reloadElapsed += deltaTime;
    if (this.reloadElapsed + Number.EPSILON * 8 < this.definition.reloadSeconds) {
      return;
    }
    const missingRounds = this.definition.capacity - this.rounds;
    this.rounds += this.reserve.take(this.definition.ammunitionType, missingRounds);
    this.reloadElapsed = 0;
    this.loading = false;
  }
}

/** 泵动霰弹枪使用的管式弹仓，按固定节奏从有限库存逐发装填。 */
class TubeMagazineWeaponAmmunition implements WeaponAmmunition {
  private rounds: number;
  private reloadElapsed = 0;
  private loading = false;

  constructor(
    private readonly definition: Readonly<TubeMagazineWeaponAmmunitionDefinition>,
    private readonly reserve: WeaponAmmunitionReserve,
  ) {
    validateTubeMagazineDefinition(definition);
    this.rounds = definition.capacity;
  }

  public get ammunitionType(): AmmunitionType {
    return this.definition.ammunitionType;
  }

  public get roundsRemaining(): number {
    return this.rounds;
  }

  public get reserveRounds(): number {
    return this.reserve.get(this.definition.ammunitionType);
  }

  public get empty(): boolean {
    return this.rounds === 0;
  }

  public get reloading(): boolean {
    return this.loading;
  }

  public get reloadProgress(): number {
    return this.loading
      ? Math.min(1, this.reloadElapsed / this.definition.shellReloadSeconds)
      : 0;
  }

  public tryConsumeShot(): boolean {
    if (this.loading || this.rounds <= 0) {
      return false;
    }
    this.rounds--;
    return true;
  }

  public beginReload(): boolean {
    if (this.loading
      || this.rounds >= this.definition.capacity
      || this.reserveRounds <= 0) {
      return false;
    }
    this.loading = true;
    this.reloadElapsed = 0;
    return true;
  }

  public update(deltaTime: number): void {
    validateDeltaTime(deltaTime);
    if (!this.loading) {
      return;
    }
    this.reloadElapsed += deltaTime;
    while (this.reloadElapsed + Number.EPSILON * 8
      >= this.definition.shellReloadSeconds && this.loading) {
      this.reloadElapsed = Math.max(
        0,
        this.reloadElapsed - this.definition.shellReloadSeconds,
      );
      this.rounds += this.reserve.take(this.definition.ammunitionType, 1);
      if (this.rounds >= this.definition.capacity || this.reserveRounds <= 0) {
        this.rounds = Math.min(this.rounds, this.definition.capacity);
        this.reloadElapsed = 0;
        this.loading = false;
      }
    }
  }
}

/** 根据武器定义创建独占弹仓状态，并从玩家共享备用库存装填。 */
export function createWeaponAmmunition(
  definition: Readonly<WeaponAmmunitionDefinition>,
  reserve: WeaponAmmunitionReserve,
): WeaponAmmunition {
  switch (definition.mode) {
    case WeaponAmmunitionMode.Magazine:
      return new MagazineWeaponAmmunition(definition, reserve);
    case WeaponAmmunitionMode.TubeMagazine:
      return new TubeMagazineWeaponAmmunition(definition, reserve);
  }
}

function validateMagazineDefinition(
  definition: Readonly<MagazineWeaponAmmunitionDefinition>,
): void {
  if (!Number.isSafeInteger(definition.capacity)
    || definition.capacity <= 0
    || !Number.isFinite(definition.reloadSeconds)
    || definition.reloadSeconds <= 0) {
    throw new Error('弹匣容量与换弹时长必须是有限正数。');
  }
}

function validateTubeMagazineDefinition(
  definition: Readonly<TubeMagazineWeaponAmmunitionDefinition>,
): void {
  if (!Number.isSafeInteger(definition.capacity)
    || definition.capacity <= 0
    || !Number.isFinite(definition.shellReloadSeconds)
    || definition.shellReloadSeconds <= 0) {
    throw new Error('管式弹仓容量与单发装填时长必须是有限正数。');
  }
}

function validateDeltaTime(deltaTime: number): void {
  if (!Number.isFinite(deltaTime) || deltaTime < 0) {
    throw new Error('武器弹药帧时间必须是有限非负数。');
  }
}
