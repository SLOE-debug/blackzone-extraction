import { type FeatureId } from '../contracts/runtime-id';
import {
  type FeaturePlugin,
  type RegisteredFeatureId,
  type RegisteredFeaturePlugin,
} from './feature-plugin';

/**
 * 保存已随 Bundle 脚本加载的 Feature，并提供按标识推导返回类型的查询能力。
 */
export class FeatureRegistry {
  private readonly plugins = new Map<FeatureId, FeaturePlugin>();

  /** 注册一个 Feature，重复标识会被拒绝。 */
  public register<TId extends RegisteredFeatureId>(plugin: RegisteredFeaturePlugin<TId>): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Feature 已经注册：${plugin.id}`);
    }

    this.plugins.set(plugin.id, plugin);
  }

  /** 根据 Feature 标识返回通过映射声明的精确插件类型。 */
  public get<TId extends RegisteredFeatureId>(id: TId): RegisteredFeaturePlugin<TId> {
    const plugin = this.plugins.get(id);
    if (plugin === undefined) {
      throw new Error(`Feature 尚未注册：${id}`);
    }

    return plugin as RegisteredFeaturePlugin<TId>;
  }

  /** 判断指定 Feature 是否已随 Bundle 脚本完成注册。 */
  public has(id: FeatureId): boolean {
    return this.plugins.has(id);
  }
}

/** 由各 Bundle 入口进行副作用注册的全局 Feature 注册表。 */
export const featureRegistry = new FeatureRegistry();
