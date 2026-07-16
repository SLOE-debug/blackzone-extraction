import { _decorator, Component, error, Material } from 'cc';
import { LobbySceneRuntime } from '../lobby/scene/lobby-scene-runtime';

const { ccclass, property } = _decorator;

/**
 * 大厅场景序列化入口。
 *
 * 文件路径暂由既有 Cocos 脚本元数据引用；正式场景实现全部位于 assets/lobby。
 */
@ccclass('LobbySceneEntry')
export class LobbySceneEntry extends Component {
  @property({
    type: Material,
    tooltip: '请选择使用 Cocos 内置 Standard Effect 的大厅表面材质。',
  })
  public lobbySurfaceMaterial: Material | null = null;

  private runtime: LobbySceneRuntime | null = null;
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

  /** 使用编辑器引用的内置 Standard 材质创建大厅运行时。 */
  private initialize(): void {
    if (this.destroyed || !this.node.isValid) {
      return;
    }
    if (this.lobbySurfaceMaterial === null) {
      throw new Error('请在 LobbySceneEntry 上指定使用内置 Standard Effect 的大厅表面材质。');
    }

    const runtime = new LobbySceneRuntime(this.node, this.lobbySurfaceMaterial);
    runtime.initialize();
    this.runtime = runtime;
  }
}
