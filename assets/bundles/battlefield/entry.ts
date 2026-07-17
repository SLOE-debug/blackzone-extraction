import { featureRegistry } from '../../core/features/feature-registry';
import { battlefieldFeature } from './feature/battlefield-feature';

// Bundle 脚本加载完成时只注册战场 Feature，不直接创建场景节点或玩法状态。
featureRegistry.register(battlefieldFeature);
