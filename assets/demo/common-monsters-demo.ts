import { _decorator, Component, error, Material } from 'cc';
import { GameSceneFlowRuntime } from '../game/scene/game-scene-flow-runtime';

const { ccclass, property } = _decorator;

/**
 * 游戏主场景序列化入口。
 *
 * 文件路径由既有 Cocos 脚本元数据引用，运行时负责大厅到战场的完整切换流程。
 */
@ccclass('LobbySceneEntry')
export class LobbySceneEntry extends Component {
  @property({
    type: Material,
    tooltip: '请选择大厅、玩家、怪物和战场共用的 Cocos 内置 Standard 表面材质。',
  })
  public lobbySurfaceMaterial: Material | null = null;

  private runtime: GameSceneFlowRuntime | null = null;
  private destroyed = false;

  protected onLoad(): void {
    try {
      this.initialize();
    } catch (initializationError: unknown) {
      if (!this.destroyed) {
        const message = initializationError instanceof Error
          ? initializationError.stack ?? initializationError.message
          : String(initializationError);
        error(`大厅场景初始化失败：${message}`);
      }
    }
  }

  protected onDestroy(): void {
    this.destroyed = true;
    this.runtime?.dispose();
    this.runtime = null;
  }

  /** 把组件帧循环转发给当前活动场景和转场控制器。 */
  protected update(deltaTime: number): void {
    this.runtime?.update(deltaTime);
  }

  /** 使用编辑器引用的内置 Standard 材质创建游戏主场景流程。 */
  private initialize(): void {
    if (this.destroyed || !this.node.isValid) {
      return;
    }
    if (this.lobbySurfaceMaterial === null) {
      throw new Error('请在 LobbySceneEntry 上指定使用内置 Standard Effect 的共享表面材质。');
    }

    const runtime = new GameSceneFlowRuntime(this.node, this.lobbySurfaceMaterial);
    runtime.initialize();
    this.runtime = runtime;
  }
}
