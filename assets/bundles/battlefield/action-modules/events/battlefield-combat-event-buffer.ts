import { type CombatTag } from '../../../../core/contracts/monster-manipulation';
import { type BattlefieldCombatModuleId } from '../model/battlefield-combat-module';
import {
  BattlefieldCombatEventRejection,
  type BattlefieldCombatEventType,
} from './battlefield-combat-event-type';

export interface BattlefieldCombatEventBufferOptions {
  readonly capacity: number;
  readonly maximumChainDepth: number;
  readonly maximumRepeatedEvent: number;
}

const DEFAULT_OPTIONS: BattlefieldCombatEventBufferOptions = Object.freeze({
  capacity: 256,
  maximumChainDepth: 12,
  maximumRepeatedEvent: 2,
});

/** 预分配的标准战斗事件 SoA 缓冲，并负责链深度、重复和容量保护。 */
export class BattlefieldCombatEventBuffer {
  public readonly type: Uint8Array;
  public readonly sourcePopulationId: Uint32Array;
  public readonly sourceEntityId: Uint32Array;
  public readonly targetPopulationId: Uint32Array;
  public readonly targetEntityId: Uint32Array;
  public readonly moduleId: Uint8Array;
  public readonly chainId: Uint32Array;
  public readonly depth: Uint8Array;
  public readonly positionX: Float32Array;
  public readonly positionY: Float32Array;
  public readonly positionZ: Float32Array;
  public readonly directionX: Float32Array;
  public readonly directionY: Float32Array;
  public readonly directionZ: Float32Array;
  public readonly strength: Float32Array;
  public readonly tags: Uint32Array;
  private readonly options: Readonly<BattlefieldCombatEventBufferOptions>;
  private eventCount = 0;
  private nextChainId = 1;
  private rejectedCount = 0;
  private rejection = BattlefieldCombatEventRejection.None;

  constructor(options: Readonly<BattlefieldCombatEventBufferOptions> = DEFAULT_OPTIONS) {
    validateOptions(options);
    this.options = Object.freeze({ ...options });
    this.type = new Uint8Array(options.capacity);
    this.sourcePopulationId = new Uint32Array(options.capacity);
    this.sourceEntityId = new Uint32Array(options.capacity);
    this.targetPopulationId = new Uint32Array(options.capacity);
    this.targetEntityId = new Uint32Array(options.capacity);
    this.moduleId = new Uint8Array(options.capacity);
    this.chainId = new Uint32Array(options.capacity);
    this.depth = new Uint8Array(options.capacity);
    this.positionX = new Float32Array(options.capacity);
    this.positionY = new Float32Array(options.capacity);
    this.positionZ = new Float32Array(options.capacity);
    this.directionX = new Float32Array(options.capacity);
    this.directionY = new Float32Array(options.capacity);
    this.directionZ = new Float32Array(options.capacity);
    this.strength = new Float32Array(options.capacity);
    this.tags = new Uint32Array(options.capacity);
  }

  public get count(): number {
    return this.eventCount;
  }

  public get droppedCount(): number {
    return this.rejectedCount;
  }

  public get lastRejection(): BattlefieldCombatEventRejection {
    return this.rejection;
  }

  /** 开始新帧但保留单调链标识，避免跨帧诊断混淆。 */
  public beginFrame(): void {
    this.eventCount = 0;
    this.rejectedCount = 0;
    this.rejection = BattlefieldCombatEventRejection.None;
  }

  /** 写入一条根事件并返回其缓冲索引，失败时返回 -1。 */
  public appendRoot(
    type: BattlefieldCombatEventType,
    sourcePopulationId: number,
    sourceEntityId: number,
    targetPopulationId: number,
    targetEntityId: number,
    moduleId: BattlefieldCombatModuleId,
    positionX: number,
    positionY: number,
    positionZ: number,
    directionX: number,
    directionY: number,
    directionZ: number,
    strength: number,
    tags: CombatTag,
  ): number {
    const chainId = this.allocateChainId();
    return this.append(
      type,
      sourcePopulationId,
      sourceEntityId,
      targetPopulationId,
      targetEntityId,
      moduleId,
      chainId,
      0,
      positionX,
      positionY,
      positionZ,
      directionX,
      directionY,
      directionZ,
      strength,
      tags,
    );
  }

  /** 从既有事件派生下一层事件，供后续 Reaction 模块形成任意长度链路。 */
  public appendChild(
    parentIndex: number,
    type: BattlefieldCombatEventType,
    sourcePopulationId: number,
    sourceEntityId: number,
    targetPopulationId: number,
    targetEntityId: number,
    moduleId: BattlefieldCombatModuleId,
    positionX: number,
    positionY: number,
    positionZ: number,
    directionX: number,
    directionY: number,
    directionZ: number,
    strength: number,
    tags: CombatTag,
  ): number {
    if (!Number.isSafeInteger(parentIndex) || parentIndex < 0 || parentIndex >= this.eventCount) {
      throw new Error('战斗子事件的父事件索引越界。');
    }
    return this.append(
      type,
      sourcePopulationId,
      sourceEntityId,
      targetPopulationId,
      targetEntityId,
      moduleId,
      this.chainId[parentIndex] ?? 0,
      (this.depth[parentIndex] ?? 0) + 1,
      positionX,
      positionY,
      positionZ,
      directionX,
      directionY,
      directionZ,
      strength,
      tags,
    );
  }

  private append(
    type: BattlefieldCombatEventType,
    sourcePopulationId: number,
    sourceEntityId: number,
    targetPopulationId: number,
    targetEntityId: number,
    moduleId: BattlefieldCombatModuleId,
    chainId: number,
    depth: number,
    positionX: number,
    positionY: number,
    positionZ: number,
    directionX: number,
    directionY: number,
    directionZ: number,
    strength: number,
    tags: CombatTag,
  ): number {
    validateEventNumbers(
      sourcePopulationId,
      sourceEntityId,
      targetPopulationId,
      targetEntityId,
      positionX,
      positionY,
      positionZ,
      directionX,
      directionY,
      directionZ,
      strength,
    );
    if (depth > this.options.maximumChainDepth) {
      return this.reject(BattlefieldCombatEventRejection.MaximumDepth);
    }
    if (this.eventCount >= this.options.capacity) {
      return this.reject(BattlefieldCombatEventRejection.Capacity);
    }
    if (this.countRepeated(
      type,
      sourcePopulationId,
      sourceEntityId,
      targetPopulationId,
      targetEntityId,
      chainId,
    )
      >= this.options.maximumRepeatedEvent) {
      return this.reject(BattlefieldCombatEventRejection.RepeatedEvent);
    }
    const index = this.eventCount++;
    this.type[index] = type;
    this.sourcePopulationId[index] = sourcePopulationId;
    this.sourceEntityId[index] = sourceEntityId;
    this.targetPopulationId[index] = targetPopulationId;
    this.targetEntityId[index] = targetEntityId;
    this.moduleId[index] = moduleId;
    this.chainId[index] = chainId;
    this.depth[index] = depth;
    this.positionX[index] = positionX;
    this.positionY[index] = positionY;
    this.positionZ[index] = positionZ;
    this.directionX[index] = directionX;
    this.directionY[index] = directionY;
    this.directionZ[index] = directionZ;
    this.strength[index] = strength;
    this.tags[index] = tags;
    return index;
  }

  private countRepeated(
    type: BattlefieldCombatEventType,
    sourcePopulationId: number,
    sourceEntityId: number,
    targetPopulationId: number,
    targetEntityId: number,
    chainId: number,
  ): number {
    let count = 0;
    for (let index = 0; index < this.eventCount; index++) {
      if ((this.type[index] ?? -1) === type
        && (this.sourcePopulationId[index] ?? -1) === sourcePopulationId
        && (this.sourceEntityId[index] ?? -1) === sourceEntityId
        && (this.targetPopulationId[index] ?? -1) === targetPopulationId
        && (this.targetEntityId[index] ?? -1) === targetEntityId
        && (this.chainId[index] ?? 0) === chainId) {
        count++;
      }
    }
    return count;
  }

  private allocateChainId(): number {
    const chainId = this.nextChainId;
    this.nextChainId = this.nextChainId >= 0xffffffff ? 1 : this.nextChainId + 1;
    return chainId;
  }

  private reject(reason: BattlefieldCombatEventRejection): number {
    this.rejectedCount++;
    this.rejection = reason;
    return -1;
  }
}

function validateOptions(options: Readonly<BattlefieldCombatEventBufferOptions>): void {
  if (!Number.isSafeInteger(options.capacity) || options.capacity <= 0
    || !Number.isSafeInteger(options.maximumChainDepth) || options.maximumChainDepth < 0
    || !Number.isSafeInteger(options.maximumRepeatedEvent)
    || options.maximumRepeatedEvent <= 0) {
    throw new Error('战斗事件缓冲容量、深度和重复上限必须是有效整数。');
  }
}

function validateEventNumbers(
  sourcePopulationId: number,
  sourceEntityId: number,
  targetPopulationId: number,
  targetEntityId: number,
  positionX: number,
  positionY: number,
  positionZ: number,
  directionX: number,
  directionY: number,
  directionZ: number,
  strength: number,
): void {
  if (!Number.isFinite(sourcePopulationId)
    || !Number.isFinite(sourceEntityId)
    || !Number.isFinite(targetPopulationId)
    || !Number.isFinite(targetEntityId)
    || !Number.isFinite(positionX)
    || !Number.isFinite(positionY)
    || !Number.isFinite(positionZ)
    || !Number.isFinite(directionX)
    || !Number.isFinite(directionY)
    || !Number.isFinite(directionZ)
    || !Number.isFinite(strength)) {
    throw new Error('标准战斗事件只能写入有限数值。');
  }
}
