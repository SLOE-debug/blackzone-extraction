/** Curve Crawler 权威姿态从模拟到 GPU 的单调版本快照。 */
export interface CurveCrawlerPoseSynchronizationSnapshot {
  readonly simulationPoseRevision: number;
  readonly packedPoseRevision: number;
  readonly gpuPoseUploadRevision: number;
  readonly forcedResynchronizationCount: number;
  readonly desynchronized: boolean;
}
