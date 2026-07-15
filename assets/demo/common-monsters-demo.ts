import { _decorator, Component, error } from 'cc';
import { loadLobbySurfaceMaterial } from '../lobby/loading/lobby-resource-loader';
import { LobbySceneRuntime } from '../lobby/scene/lobby-scene-runtime';

const { ccclass } = _decorator;

/**
 * 大厅场景序列化入口。
 *
 * 文件路径暂由既有 Cocos 脚本元数据引用；正式场景实现全部位于 assets/lobby。
 */
@ccclass('LobbySceneEntry')
export class LobbySceneEntry extends Component {
  private runtime: LobbySceneRuntime | null = null;
  private destroyed = false;

  protected onLoad(): void {
    void this.initialize().catch((initializationError: unknown) => {
      if (!this.destroyed) {
        const message = initializationError instanceof Error
          ? initializationError.stack ?? initializationError.message
          : String(initializationError);
        error(`大厅场景初始化失败：${message}`);
      }
    });
  }

  protected onDestroy(): void {
    this.destroyed = true;
    this.runtime?.dispose();
    this.runtime = null;
  }

  /** 加载正式大厅资源，并仅在组件仍然有效时创建运行时。 */
  private async initialize(): Promise<void> {
    const surfaceMaterial = await loadLobbySurfaceMaterial();
    if (this.destroyed || !this.node.isValid) {
      return;
    }

    const runtime = new LobbySceneRuntime(this.node, surfaceMaterial);
    runtime.initialize();
    this.runtime = runtime;
  }
}
