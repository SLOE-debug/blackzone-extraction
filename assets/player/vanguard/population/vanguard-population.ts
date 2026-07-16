import { type Material, Node } from 'cc';
import { VanguardAnimationSystem } from '../animation/vanguard-animation-system';
import { type VanguardPopulationOptions } from '../model/vanguard-options';
import { VanguardState } from '../model/vanguard-state';
import { VanguardRenderer } from '../rendering/vanguard-renderer';

const MINIMUM_DELTA_TIME = 1 / 240;
const MAXIMUM_DELTA_TIME = 0.05;

/** 可复用主角的公开运行时门面，只编排姿态更新、渲染和资源生命周期。 */
export class VanguardPopulation {
  private readonly state: VanguardState;
  private readonly animation = new VanguardAnimationSystem();
  private readonly renderer: VanguardRenderer;
  private disposed = false;

  constructor(
    parent: Node,
    surfaceMaterialTemplate: Material,
    options: Readonly<VanguardPopulationOptions>,
  ) {
    this.state = new VanguardState(options);
    this.animation.initialize(this.state);
    this.renderer = new VanguardRenderer(parent, this.state, surfaceMaterialTemplate);
  }

  /** 推进基础走路循环并上传当前持枪姿态。 */
  public update(deltaTime: number): void {
    this.ensureActive();
    if (!Number.isFinite(deltaTime)) {
      throw new Error('主角帧时间必须是有限数值。');
    }
    const safeDeltaTime = Math.max(MINIMUM_DELTA_TIME, Math.min(deltaTime, MAXIMUM_DELTA_TIME));
    this.animation.update(this.state, safeDeltaTime);
    this.renderer.update();
  }

  /** 释放主角动态网格和材质。 */
  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.renderer.dispose();
    this.disposed = true;
  }

  /** 阻止释放后的帧更新。 */
  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('主角已经释放。');
    }
  }
}
