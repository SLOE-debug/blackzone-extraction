import { Texture2D } from 'cc';
import { type CurveCrawlerState } from '../../model/curve-crawler-state';
import {
  CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT,
  CurveCrawlerGpuPoseBuffer,
} from './curve-crawler-gpu-pose-layout';

/** 管理每实体 RGBA32F 姿态纹理及其 CPU SoA 打包镜像。 */
export class CurveCrawlerGpuPoseTexture {
  private readonly buffer = new CurveCrawlerGpuPoseBuffer();
  private texture: Texture2D;
  private disposed = false;

  constructor() {
    this.buffer.resize(1);
    this.texture = createPoseTexture(1);
  }

  public get asset(): Texture2D {
    this.ensureActive();
    return this.texture;
  }

  public get capacity(): number {
    return this.buffer.capacity;
  }

  /** 在批次容量变化时重建纹理；返回是否替换了 GPU 资源。 */
  public resize(entityCapacity: number): boolean {
    this.ensureActive();
    if (entityCapacity === this.buffer.capacity) {
      return false;
    }
    this.buffer.resize(entityCapacity);
    const nextTexture = createPoseTexture(entityCapacity);
    this.texture.destroy();
    this.texture = nextTexture;
    return true;
  }

  public begin(): void {
    this.ensureActive();
    this.buffer.begin();
  }

  public writeState(state: CurveCrawlerState, gpuSlotOffset: number): void {
    this.ensureActive();
    this.buffer.writeState(state, gpuSlotOffset);
  }

  /** 整体提交一帧姿态纹理，并返回上传字节数。 */
  public upload(): number {
    this.ensureActive();
    this.texture.uploadData(this.buffer.data);
    return this.buffer.data.byteLength;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.texture.destroy();
  }

  private ensureActive(): void {
    if (this.disposed) {
      throw new Error('Curve Crawler GPU 姿态纹理已经释放。');
    }
  }
}

function createPoseTexture(entityCapacity: number): Texture2D {
  const texture = new Texture2D('CurveCrawlerGpuPoseTexture');
  texture.reset({
    width: CURVE_CRAWLER_GPU_POSE_TEXEL_COUNT,
    height: entityCapacity,
    format: Texture2D.PixelFormat.RGBA32F,
    mipmapLevel: 1,
  });
  texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
  texture.setMipFilter(Texture2D.Filter.NONE);
  texture.setWrapMode(
    Texture2D.WrapMode.CLAMP_TO_EDGE,
    Texture2D.WrapMode.CLAMP_TO_EDGE,
  );
  return texture;
}
