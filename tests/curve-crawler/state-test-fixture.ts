import { type Material } from 'cc';
import {
  normalizeCurveCrawlerOptions,
  type CurveCrawlerDisplayOptions,
  type NormalizedCurveCrawlerPopulationOptions,
} from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-options';
import { CurveCrawlerMotionProfile } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-motion-profile';
import { CurveCrawlerLifePhase } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-life';
import { type CurveCrawlerState } from '../../assets/bundles/common-monsters/entities/curve-crawler/model/curve-crawler-state';

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

/** 让不关注出生演出的既有系统测试直接从可战斗状态开始。 */
export function completeCurveCrawlerTestEmergence(state: CurveCrawlerState): void {
  state.data.vitality.phase.fill(CurveCrawlerLifePhase.Alive);
  state.data.vitality.phaseTime.fill(0);
  state.data.animation.crackSpread.fill(0);
  state.data.animation.crackVisibility.fill(0);
  state.data.animation.eggScale.fill(0);
  state.data.animation.eggBulge.fill(0);
  state.data.animation.eggBurst.fill(1);
  state.data.animation.emergenceBodyScale.fill(1);
  state.data.animation.emergenceLegScale.fill(1);
}
