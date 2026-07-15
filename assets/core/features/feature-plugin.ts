import { type BundleId, type FeatureId } from '../contracts/runtime-id';

/**
 * 定义由 Asset Bundle 入口注册的 Feature 基础契约。
 */
export interface FeaturePlugin<TId extends FeatureId = FeatureId> {
  readonly id: TId;
  readonly bundle: BundleId;
}

/**
 * Feature Bundle 通过模块扩展向此映射注册自身的精确插件类型。
 */
export interface FeaturePluginMap {}

/** 已经通过模块扩展声明的 Feature 标识。 */
export type RegisteredFeatureId = Extract<keyof FeaturePluginMap, FeatureId>;

/** 根据 Feature 标识取得精确插件类型，并校验其基础契约。 */
export type RegisteredFeaturePlugin<TId extends RegisteredFeatureId> =
  FeaturePluginMap[TId] & FeaturePlugin<TId>;
