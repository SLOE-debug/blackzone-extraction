import {
  BattlefieldInteractionAction,
  type BattlefieldInteractionProvider,
  type MutableBattlefieldInteractionCandidate,
} from '../model/battlefield-interaction';

/** 在互不依赖的交互提供者之间选择玩家附近的最近候选。 */
export class BattlefieldInteractionResolver {
  private readonly providers: BattlefieldInteractionProvider[] = [];
  private readonly providerCandidate: MutableBattlefieldInteractionCandidate = {
    sourceId: -1,
    action: BattlefieldInteractionAction.OpenContainer,
    x: 0,
    z: 0,
    distanceSquared: Number.POSITIVE_INFINITY,
  };
  private readonly nearestCandidate: MutableBattlefieldInteractionCandidate = {
    sourceId: -1,
    action: BattlefieldInteractionAction.OpenContainer,
    x: 0,
    z: 0,
    distanceSquared: Number.POSITIVE_INFINITY,
  };
  private nearestProvider: BattlefieldInteractionProvider | null = null;

  /** 登记一个长期存在、内部可随 Chunk 增减实体的交互提供者。 */
  public register(provider: BattlefieldInteractionProvider): void {
    if (this.providers.includes(provider)) {
      throw new Error('同一个战场交互提供者不能重复登记。');
    }
    this.providers.push(provider);
  }

  /** 解析最近候选并保存其提供者，供同一帧或下一帧激活。 */
  public resolve(
    playerX: number,
    playerZ: number,
  ): Readonly<MutableBattlefieldInteractionCandidate> | null {
    this.nearestProvider = null;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const provider of this.providers) {
      if (!provider.writeNearestInteraction(playerX, playerZ, this.providerCandidate)) {
        continue;
      }
      validateCandidate(this.providerCandidate);
      if (this.providerCandidate.distanceSquared < bestDistanceSquared) {
        copyCandidate(this.providerCandidate, this.nearestCandidate);
        bestDistanceSquared = this.providerCandidate.distanceSquared;
        this.nearestProvider = provider;
      }
    }
    return this.nearestProvider === null ? null : this.nearestCandidate;
  }

  /** 激活最近一次 resolve 选中的候选。 */
  public activateCurrent(): boolean {
    if (this.nearestProvider === null) {
      return false;
    }
    return this.nearestProvider.activateInteraction(this.nearestCandidate.sourceId);
  }
}

function copyCandidate(
  source: Readonly<MutableBattlefieldInteractionCandidate>,
  target: MutableBattlefieldInteractionCandidate,
): void {
  target.sourceId = source.sourceId;
  target.action = source.action;
  target.x = source.x;
  target.z = source.z;
  target.distanceSquared = source.distanceSquared;
}

function validateCandidate(candidate: Readonly<MutableBattlefieldInteractionCandidate>): void {
  if (!Number.isInteger(candidate.sourceId)
    || !Number.isFinite(candidate.x)
    || !Number.isFinite(candidate.z)
    || !Number.isFinite(candidate.distanceSquared)
    || candidate.distanceSquared < 0) {
    throw new Error('战场交互候选包含无效标识、坐标或距离。');
  }
}
