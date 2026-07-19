import { type Material } from 'cc';
import {
  normalizeCurveCrawlerOptions,
  type CurveCrawlerDisplayOptions,
  type NormalizedCurveCrawlerPopulationOptions,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-options';
import { CurveCrawlerMotionProfile } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-motion-profile';

const TEST_SURFACE_MATERIAL = {
  effectAsset: {},
} as unknown as Material;

/** 为不创建 Cocos 渲染资源的状态与系统测试补齐领域必需参数。 */
export function createNormalizedCurveCrawlerTestOptions(
  options: Omit<CurveCrawlerDisplayOptions, 'surfaceMaterialTemplate'>,
  motionProfile = CurveCrawlerMotionProfile.Autonomous,
): NormalizedCurveCrawlerPopulationOptions {
  return normalizeCurveCrawlerOptions({
    ...options,
    surfaceMaterialTemplate: TEST_SURFACE_MATERIAL,
  }, motionProfile);
}
