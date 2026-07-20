import {
  type TubeMagazineWeaponAmmunitionDefinition,
  type WeaponAmmunitionDefinition,
  WeaponAmmunitionMode,
} from '../../../../core/equipment/equipment';

/** 武器射击系统依赖的可替换弹药消耗与装填策略。 */
export interface WeaponAmmunition {
  readonly roundsRemaining: number;
  readonly empty: boolean;
  readonly reloading: boolean;
  /** 当前单发装填动作的零到一进度。 */
  readonly reloadProgress: number;
  /** 尝试为一次射击消耗弹药；库存不足或正在装填时返回 false。 */
  tryConsumeShot(): boolean;
  /** 在弹仓未满时开始连续逐发装填。 */
  beginReload(): boolean;
  /** 推进当前装填动作，不负责决定何时开始装填。 */
  update(deltaTime: number): void;
}

/** 默认无限弹药策略不会创建弹仓或装填状态。 */
class InfiniteWeaponAmmunition implements WeaponAmmunition {
  public get roundsRemaining(): number {
    return Number.POSITIVE_INFINITY;
  }

  public get empty(): boolean {
    return false;
  }

  public get reloading(): boolean {
    return false;
  }

  public get reloadProgress(): number {
    return 0;
  }

  public tryConsumeShot(): boolean {
    return true;
  }

  public beginReload(): boolean {
    return false;
  }

  public update(deltaTime: number): void {
    validateDeltaTime(deltaTime);
  }
}

/** 泵动霰弹枪使用的管式弹仓，按固定节奏逐发装填并循环姿态。 */
class TubeMagazineWeaponAmmunition implements WeaponAmmunition {
  private rounds: number;
  private reloadElapsed = 0;
  private loading = false;

  constructor(private readonly definition: Readonly<TubeMagazineWeaponAmmunitionDefinition>) {
    validateTubeMagazineDefinition(definition);
    this.rounds = definition.capacity;
  }

  public get roundsRemaining(): number {
    return this.rounds;
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
    if (this.loading || this.rounds >= this.definition.capacity) {
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
      this.rounds++;
      if (this.rounds >= this.definition.capacity) {
        this.rounds = this.definition.capacity;
        this.reloadElapsed = 0;
        this.loading = false;
      }
    }
  }
}

/** 根据武器定义创建独占弹药状态。 */
export function createWeaponAmmunition(
  definition: Readonly<WeaponAmmunitionDefinition>,
): WeaponAmmunition {
  switch (definition.mode) {
    case WeaponAmmunitionMode.Infinite:
      return new InfiniteWeaponAmmunition();
    case WeaponAmmunitionMode.TubeMagazine:
      return new TubeMagazineWeaponAmmunition(definition);
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
