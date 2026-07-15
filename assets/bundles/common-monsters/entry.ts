import { featureRegistry } from '../../core/features/feature-registry';
import { commonMonstersFeature } from './feature/common-monsters-feature';

// Bundle 脚本加载完成时只执行 Feature 注册，不在入口创建任何实体或渲染资源。
featureRegistry.register(commonMonstersFeature);
