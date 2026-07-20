import { BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG } from './battlefield-environment-config';

/** 将任意世界坐标映射到以整数倍 ChunkSize 为中心的环境 Chunk。 */
export function worldCoordinateToEnvironmentChunk(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('环境 Chunk 查询坐标必须是有限数值。');
  }
  const size = BATTLEFIELD_ENVIRONMENT_WORLD_CONFIG.chunkSize;
  return Math.floor((value + size * 0.5) / size);
}
